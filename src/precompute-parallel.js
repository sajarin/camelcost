#!/usr/bin/env node
/**
 * Parallel precompute for discovered packages
 * Runs multiple analyses concurrently for faster processing
 *
 * Usage: bun src/precompute-parallel.js [discovered.json] [concurrency]
 */

import { analyze } from './index.js';
import { writeFileSync, existsSync, readFileSync } from 'fs';

function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function analyzeWithTimeout(pkg, timeoutMs = 180000) {
  return Promise.race([
    analyze(pkg, { maxExports: 9999 }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    )
  ]);
}

async function precomputeParallel(options = {}) {
  const {
    discoveredPath = '../hmr-api/priv/discovered.json',
    outputPath = '../hmr-api/priv/precomputed.json',
    concurrency = 4,
  } = options;

  log('='.repeat(60));
  log('PARALLEL PRECOMPUTE');
  log(`Concurrency: ${concurrency}`);
  log('='.repeat(60));

  // Load discovered packages
  if (!existsSync(discoveredPath)) {
    log(`ERROR: ${discoveredPath} not found. Run discover-packages.js first.`);
    process.exit(1);
  }

  const discovered = JSON.parse(readFileSync(discoveredPath, 'utf-8'));
  log(`Discovered packages: ${discovered.length}`);

  // Load existing results
  let results = {};
  let failed = {};
  const failedPath = outputPath.replace('.json', '.failed.json');

  if (existsSync(outputPath)) {
    results = JSON.parse(readFileSync(outputPath, 'utf-8'));
    log(`Existing cached: ${Object.keys(results).length}`);
  }

  if (existsSync(failedPath)) {
    failed = JSON.parse(readFileSync(failedPath, 'utf-8'));
    log(`Previously failed: ${Object.keys(failed).length}`);
  }

  // Filter to packages we haven't processed
  const toProcess = discovered.filter(pkg => !results[pkg] && !failed[pkg]);
  log(`To process: ${toProcess.length}`);
  log('');

  if (toProcess.length === 0) {
    log('Nothing to process!');
    return;
  }

  let completed = 0;
  let succeeded = 0;
  let errors = 0;
  const startTime = Date.now();
  let lastSave = Date.now();

  // Process in batches
  for (let i = 0; i < toProcess.length; i += concurrency) {
    const batch = toProcess.slice(i, i + concurrency);
    const batchNum = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(toProcess.length / concurrency);

    log(`Batch ${batchNum}/${totalBatches}: ${batch.join(', ')}`);

    const promises = batch.map(async (pkg) => {
      try {
        const result = await analyzeWithTimeout(pkg);
        if (!result.error) {
          results[pkg] = result;
          log(`  ✓ ${pkg}: ${(result.size / 1000).toFixed(1)} KB`);
          succeeded++;
        } else {
          log(`  ✗ ${pkg}: ${result.error}`);
          failed[pkg] = { error: result.error, time: new Date().toISOString() };
          errors++;
        }
      } catch (e) {
        log(`  ✗ ${pkg}: ${e.message}`);
        failed[pkg] = { error: e.message, time: new Date().toISOString() };
        errors++;
      }
      completed++;
    });

    await Promise.all(promises);

    // Save checkpoint every 30 seconds or every 20 packages
    const now = Date.now();
    if (now - lastSave > 30000 || completed % 20 === 0) {
      writeFileSync(outputPath, JSON.stringify(results, null, 2));
      writeFileSync(failedPath, JSON.stringify(failed, null, 2));
      const elapsed = ((now - startTime) / 1000 / 60).toFixed(1);
      const rate = (completed / ((now - startTime) / 1000)).toFixed(2);
      log(`--- Checkpoint: ${Object.keys(results).length} cached, ${elapsed}min elapsed, ${rate} pkg/s ---`);
      lastSave = now;
    }

    // Small delay between batches to avoid overwhelming the system
    await sleep(500);
  }

  // Final save
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  writeFileSync(failedPath, JSON.stringify(failed, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  log('');
  log('='.repeat(60));
  log('PRECOMPUTE COMPLETED');
  log(`Duration: ${elapsed} minutes`);
  log(`Processed: ${completed}`);
  log(`Succeeded: ${succeeded}`);
  log(`Failed: ${errors}`);
  log(`Total cached: ${Object.keys(results).length}`);
  log('='.repeat(60));
}

// CLI
const args = process.argv.slice(2);
const discoveredPath = args[0] || '../hmr-api/priv/discovered.json';
const concurrency = parseInt(args[1]) || 4;

precomputeParallel({ discoveredPath, concurrency });
