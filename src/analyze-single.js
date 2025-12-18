#!/usr/bin/env node
/**
 * Analyze a single package - designed to be called by Erlang workers
 * Usage: node analyze-single.js <package-name> <worker-id>
 * Output: JSON to stdout
 */

import { analyze } from './index.js';

const packageName = process.argv[2];
const workerId = process.argv[3] || '0';

if (!packageName) {
  console.error(JSON.stringify({ error: 'No package name provided' }));
  process.exit(1);
}

// Set unique temp dir for this worker to avoid conflicts
process.env.CAMELCOST_WORKER_ID = workerId;

const TIMEOUT_MS = 120000; // 2 minutes per package (shorter for parallel)

async function run() {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
  );

  try {
    const result = await Promise.race([
      analyze(packageName, { maxExports: 9999, debug: false }),
      timeout
    ]);

    console.log(JSON.stringify({
      success: true,
      package: packageName,
      data: result
    }));
  } catch (err) {
    console.log(JSON.stringify({
      success: false,
      package: packageName,
      error: err.message
    }));
  }
}

run();
