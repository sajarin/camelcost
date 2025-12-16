#!/usr/bin/env node
/**
 * camelcost CLI
 * Usage: camelcost <package-name> [--json]
 */

import { analyze } from './index.js';

function formatBytes(bytes) {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 10000) return `${(bytes / 1000).toFixed(2)} KB`;
  return `${(bytes / 1000).toFixed(1)} KB`;
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const packageName = args.find(a => !a.startsWith('--'));

  if (!packageName) {
    console.error('Usage: camelcost <package-name> [--json]');
    process.exit(1);
  }

  if (!jsonOutput) {
    console.log(`\nAnalyzing ${packageName}...`);
  }

  try {
    const result = await analyze(packageName);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (result.error) {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`${packageName}@${result.version}`);
    console.log('═'.repeat(50));
    console.log(`\nSize:    ${formatBytes(result.size)} (brotli)`);
    console.log(`Raw:     ${formatBytes(result.raw)}`);
    console.log(`Exports: ${result.exports}`);

    if (result.exportSizes.length > 0) {
      console.log(`\nTop exports by size:`);
      console.log('─'.repeat(40));

      for (const exp of result.exportSizes.slice(0, 10)) {
        const pct = ((exp.size / result.size) * 100).toFixed(0);
        console.log(`  ${exp.name.padEnd(25)} ${formatBytes(exp.size).padStart(8)} (${pct}%)`);
      }
    }

    console.log('\n' + '─'.repeat(40));
    if (result.treeShakeable) {
      console.log(`Tree-shakeable: Individual imports save up to ${((1 - result.exportSizes[0].size / result.size) * 100).toFixed(0)}%`);
    } else {
      console.log('Not tree-shakeable: Every import costs the full package');
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

main();
