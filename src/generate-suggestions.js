#!/usr/bin/env node
/**
 * Generate search suggestions from precomputed packages
 * This ensures all suggestions lead to packages we have data for!
 *
 * Usage: bun src/generate-suggestions.js <precomputed.json> [output.json]
 */

import { writeFileSync, readFileSync } from 'fs';

// Generate all useful prefixes from a package name
function getPrefixes(name, maxLength = 8) {
  const prefixes = new Set();

  // Add prefixes of different lengths
  for (let len = 1; len <= Math.min(name.length, maxLength); len++) {
    prefixes.add(name.slice(0, len).toLowerCase());
  }

  // For scoped packages, also add prefixes of the package part
  if (name.startsWith('@')) {
    const parts = name.split('/');
    if (parts.length > 1) {
      const pkgPart = parts[1];
      for (let len = 1; len <= Math.min(pkgPart.length, maxLength); len++) {
        prefixes.add(pkgPart.slice(0, len).toLowerCase());
      }
    }
  }

  return Array.from(prefixes);
}

function generateSuggestions(precomputedPath, outputPath = 'suggestions.json') {
  console.log('Loading precomputed packages...');
  const precomputed = JSON.parse(readFileSync(precomputedPath, 'utf-8'));
  const packages = Object.keys(precomputed);
  console.log(`Loaded ${packages.length} packages`);

  // Build a map of prefix -> matching packages
  const prefixMap = new Map();

  for (const pkg of packages) {
    const data = precomputed[pkg];
    const prefixes = getPrefixes(pkg);

    for (const prefix of prefixes) {
      if (!prefixMap.has(prefix)) {
        prefixMap.set(prefix, []);
      }
      prefixMap.get(prefix).push({
        name: pkg,
        version: data.version || 'unknown',
        size: data.size || 0,  // This is already the brotli/gzip size
      });
    }
  }

  // Sort each prefix's packages by relevance (exact match first, then by size/popularity)
  for (const [prefix, pkgs] of prefixMap) {
    pkgs.sort((a, b) => {
      // Exact match first
      if (a.name.toLowerCase() === prefix) return -1;
      if (b.name.toLowerCase() === prefix) return 1;

      // Then starts with prefix (shorter names first)
      const aStarts = a.name.toLowerCase().startsWith(prefix);
      const bStarts = b.name.toLowerCase().startsWith(prefix);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Then by name length (shorter = more likely to be the main package)
      return a.name.length - b.name.length;
    });

    // Keep only top 8 suggestions per prefix
    prefixMap.set(prefix, pkgs.slice(0, 8).map(p => ({
      name: p.name,
      version: p.version,
      description: `${(p.size / 1024).toFixed(1)} KB`,
    })));
  }

  // Convert to object
  const result = {};
  for (const [prefix, pkgs] of prefixMap) {
    if (pkgs.length > 0) {
      result[prefix] = pkgs;
    }
  }

  console.log(`Generated suggestions for ${Object.keys(result).length} prefixes`);

  // Add some common search patterns that might not have direct matches
  // These will show "no results" gracefully
  const commonPrefixes = [
    '@', '@r', '@a', '@t', '@m', '@e', '@s', '@p', '@n', '@g', '@h', '@f',
  ];
  for (const prefix of commonPrefixes) {
    if (!result[prefix]) {
      // Find any packages starting with this prefix
      const matches = packages
        .filter(p => p.toLowerCase().startsWith(prefix.toLowerCase()))
        .slice(0, 8)
        .map(name => ({
          name,
          version: precomputed[name]?.version || 'unknown',
          description: `${((precomputed[name]?.size || 0) / 1024).toFixed(1)} KB`,
        }));
      if (matches.length > 0) {
        result[prefix] = matches;
      }
    }
  }

  writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`Saved to ${outputPath}`);

  // Stats
  const totalSuggestions = Object.values(result).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`Total unique prefixes: ${Object.keys(result).length}`);
  console.log(`Total suggestions: ${totalSuggestions}`);
}

// CLI
const args = process.argv.slice(2);
const precomputedPath = args[0] || '../hmr-api/priv/precomputed.json';
const outputPath = args[1] || '../hmr-api/priv/suggestions.json';

generateSuggestions(precomputedPath, outputPath);
