#!/usr/bin/env node
/**
 * Retry failed packages from precompute
 */

import { analyze } from './index.js';
import { writeFileSync, readFileSync, existsSync } from 'fs';

const CACHE_FILE = '/tmp/hmr-v2/hmr-api/priv/precomputed.json';
const FAILED_FILE = '/tmp/hmr-v2/hmr-api/priv/precomputed.failed.json';

function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
}

async function main() {
  // Load existing cache and failed list
  const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) : {};
  const failed = existsSync(FAILED_FILE) ? JSON.parse(readFileSync(FAILED_FILE, 'utf-8')) : {};

  const failedPackages = Object.keys(failed);
  log(`Found ${failedPackages.length} failed packages to retry`);

  let successCount = 0;
  let stillFailed = {};

  for (let i = 0; i < failedPackages.length; i++) {
    const pkg = failedPackages[i];
    log(`[${i + 1}/${failedPackages.length}] Retrying: ${pkg}`);

    try {
      const result = await analyze(pkg, { timeout: 120000 });

      if (result.error) {
        log(`  ✗ ${pkg}: ${result.error}`);
        stillFailed[pkg] = { error: result.error, time: new Date().toISOString() };
      } else {
        log(`  ✓ ${pkg}: ${(result.size / 1000).toFixed(1)} KB (${result.exports} exports)`);
        cache[pkg] = result;
        successCount++;

        // Save progress every 5 successes
        if (successCount % 5 === 0) {
          writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
          writeFileSync(FAILED_FILE, JSON.stringify(stillFailed, null, 2));
          log(`--- Saved progress: ${successCount} new packages ---`);
        }
      }
    } catch (e) {
      log(`  ✗ ${pkg}: ${e.message}`);
      stillFailed[pkg] = { error: e.message, time: new Date().toISOString() };
    }
  }

  // Final save
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  writeFileSync(FAILED_FILE, JSON.stringify(stillFailed, null, 2));

  log(`\n=== COMPLETE ===`);
  log(`Recovered: ${successCount} packages`);
  log(`Still failing: ${Object.keys(stillFailed).length} packages`);
  log(`Total cached: ${Object.keys(cache).length} packages`);
}

main().catch(console.error);
