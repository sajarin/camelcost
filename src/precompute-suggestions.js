#!/usr/bin/env node
/**
 * Pre-compute npm search suggestions for common search prefixes
 * This creates a static JSON file that the frontend can use for instant suggestions
 *
 * Usage: bun src/precompute-suggestions.js [outputPath]
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';

function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
}

// Common search prefixes users might type
// These are phoneme-like prefixes that will show results
const SEARCH_PREFIXES = [
  // Single letters (most common starting letters for packages)
  'r', 'l', 'c', 's', 'a', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'm',
  'n', 'o', 'p', 'q', 't', 'u', 'v', 'w', 'x', 'y', 'z',

  // Two-letter combos (common starts)
  're', 'ra', 'lo', 'la', 'ch', 'cl', 'co', 'cr', 'st', 'sw', 'su', 'se',
  'ax', 'ap', 'as', 'au', 'de', 'da', 'di', 'do', 'dr', 'es', 'ex', 'em',
  'fa', 'fi', 'fo', 'fr', 'gl', 'gr', 'gu', 'he', 'hi', 'ho', 'hu',
  'im', 'in', 'io', 'is', 'ja', 'je', 'jo', 'js', 'ju', 'ke', 'ko',
  'li', 'lu', 'ma', 'me', 'mi', 'mo', 'mu', 'na', 'ne', 'ni', 'no', 'nu',
  'ob', 'on', 'op', 'or', 'pa', 'pe', 'pi', 'pl', 'po', 'pr', 'pu',
  'qu', 'ru', 'sa', 'sc', 'sh', 'si', 'sl', 'sm', 'sn', 'so', 'sp', 'sq',
  'ta', 'te', 'th', 'ti', 'to', 'tr', 'ts', 'tw', 'ty',
  'un', 'up', 'us', 'ut', 'va', 've', 'vi', 'vu', 'we', 'wh', 'wi',
  'xe', 'ya', 'yo', 'ze', 'zo', 'zu',

  // Popular package name starts (3+ chars)
  'rea', 'vue', 'ang', 'nex', 'exp', 'lod', 'axi', 'mom', 'day', 'dat',
  'red', 'mob', 'zus', 'jot', 'rec', 'swr', 'tan', 'pri', 'dri', 'zod',
  'tai', 'pos', 'aut', 'rad', 'luc', 'her', 'fra', 'mot', 'esb', 'swc',
  'vit', 'pla', 'tes', 'nan', 'uli', 'cls', 'for', 'son', 'toa',
  'hoo', 'for', 'tab', 'vir', 'cha', 'sem', 'pri', 'blu', 'rsu', 'eve',
  'gro', 'bas', 'man', 'emo', 'sty', 'typ', 'web', 'rol', 'par', 'bab',
  'esl', 'pre', 'nod', 'npm', 'yar', 'pnp', 'bun',

  // Full popular package names (for exact matches)
  'react', 'react-', 'vue', 'angular', 'next', 'nuxt', 'express', 'lodash',
  'axios', 'moment', 'dayjs', 'date-fns', 'redux', 'mobx', 'zustand', 'jotai',
  'recoil', 'swr', '@tanstack', 'prisma', 'drizzle', 'zod', 'tailwind',
  'postcss', 'autoprefixer', '@radix', 'lucide', '@heroicons', 'framer',
  'esbuild', 'swc', 'vite', 'vitest', 'playwright', '@playwright', 'jest',
  'clsx', 'classnames', 'nanoid', 'uuid', 'date-fns', 'react-hook', 'sonner',
  'toast', 'chakra', 'mantine', '@mantine', '@mui', 'material', 'antd', '@ant',
  'three', 'tensorflow', '@tensorflow', 'firebase', 'aws', '@aws', 'monaco',
  'typescript', 'eslint', 'prettier', 'webpack', 'rollup', 'parcel', 'turbo',
  '@emotion', 'styled-', 'sass', 'less', 'graphql', 'apollo', '@apollo',
  'socket', 'ws', 'http', 'https', 'fetch', 'got', 'ky', 'node-fetch',
  'fs-extra', 'glob', 'rimraf', 'chalk', 'commander', 'yargs', 'inquirer',
  'ora', 'listr', 'execa', 'cross-', 'dotenv', 'config', 'winston', 'pino',
  'mongoose', 'mongodb', 'pg', 'mysql', 'redis', 'ioredis', 'knex', 'sequelize',
  'passport', 'bcrypt', 'jsonwebtoken', 'jwt', 'crypto', 'helmet', 'cors',
  'validator', 'joi', 'yup', 'ajv', 'json', 'xml', 'yaml', 'toml', 'csv',
  'pdf', 'excel', 'xlsx', 'image', 'sharp', 'jimp', 'canvas', 'puppeteer',
  'cheerio', 'jsdom', 'marked', 'markdown', 'highlight', 'prism', 'code',
  '@types', 'prop-types', 'classnames', 'lodash.', 'underscore', 'ramda',
  'fp-ts', 'rxjs', 'immer', 'immutable',

  // Scoped package prefixes
  '@', '@r', '@a', '@t', '@m', '@e', '@s', '@p', '@n', '@g', '@h', '@f',
  '@react', '@angular', '@vue', '@nest', '@types/', '@babel/', '@rollup/',
  '@testing', '@storybook', '@emotion/', '@chakra', '@radix-ui/', '@tanstack/',
  '@mui/', '@ant-design/', '@fortawesome/', '@heroicons/', '@mantine/',
];

const NPM_SEARCH = 'https://registry.npmjs.org/-/v1/search';

async function fetchSuggestions(query, size = 8) {
  const url = `${NPM_SEARCH}?text=${encodeURIComponent(query)}&size=${size}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();

  // Extract just what we need for suggestions
  return (data.objects || []).map(obj => ({
    name: obj.package.name,
    version: obj.package.version,
    description: obj.package.description?.slice(0, 100) || '',
  }));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function precomputeSuggestions(options = {}) {
  const {
    outputPath = 'suggestions.json',
    resume = true,
  } = options;

  log('='.repeat(60));
  log('PRECOMPUTE SUGGESTIONS STARTED');
  log(`Output: ${outputPath}`);
  log('='.repeat(60));

  // Load existing results if resuming
  let results = {};
  if (resume && existsSync(outputPath)) {
    try {
      results = JSON.parse(readFileSync(outputPath, 'utf-8'));
      log(`Loaded ${Object.keys(results).length} existing results`);
    } catch (e) {
      log('Could not load existing results, starting fresh');
    }
  }

  const toFetch = SEARCH_PREFIXES.filter(prefix => !results[prefix]);
  log(`Total prefixes: ${SEARCH_PREFIXES.length}`);
  log(`To fetch: ${toFetch.length}`);

  let completed = 0;
  let errors = 0;
  const startTime = Date.now();

  for (const prefix of toFetch) {
    const progress = `[${completed + 1}/${toFetch.length}]`;

    try {
      const suggestions = await fetchSuggestions(prefix);
      results[prefix] = suggestions;
      log(`${progress} "${prefix}": ${suggestions.length} results`);
    } catch (e) {
      log(`${progress} "${prefix}": ERROR - ${e.message}`);
      errors++;
    }

    completed++;

    // Save every 20 prefixes
    if (completed % 20 === 0) {
      writeFileSync(outputPath, JSON.stringify(results, null, 2));
      log(`--- Checkpoint saved: ${Object.keys(results).length} prefixes ---`);
    }

    // Rate limit: 100ms between requests
    await sleep(100);
  }

  // Final save
  writeFileSync(outputPath, JSON.stringify(results, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log('');
  log('='.repeat(60));
  log('PRECOMPUTE SUGGESTIONS COMPLETED');
  log(`Duration: ${elapsed}s`);
  log(`Total prefixes: ${Object.keys(results).length}`);
  log(`Errors: ${errors}`);
  log(`Output: ${outputPath}`);
  log('='.repeat(60));
}

// CLI
const args = process.argv.slice(2);
const outputPath = args[0] || 'suggestions.json';

precomputeSuggestions({ outputPath });
