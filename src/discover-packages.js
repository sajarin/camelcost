#!/usr/bin/env node
/**
 * Discover popular packages from npm search that we don't have cached yet
 * Then you can run precompute on the discovered packages
 *
 * Usage:
 *   bun src/discover-packages.js                    # Discover and save to discovered.json
 *   bun src/discover-packages.js --precompute       # Discover and immediately precompute
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { analyze } from './index.js';

const NPM_SEARCH = 'https://registry.npmjs.org/-/v1/search';

function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
}

// Common search prefixes users type
const SEARCH_PREFIXES = [
  // Full package names and common prefixes
  'react', 'react-', 'react-native', 'react-router', 'react-hook', 'react-query',
  'vue', 'vue-', 'vuex', 'vue-router', 'vite', 'vitest',
  'next', 'nextjs', 'nuxt', 'nuxtjs',
  'angular', '@angular',
  'svelte', 'solid', 'solid-js', 'astro', 'remix',
  'express', 'fastify', 'koa', 'hapi', 'nest', '@nestjs',
  'lodash', 'underscore', 'ramda', 'fp-ts',
  'axios', 'fetch', 'got', 'ky', 'node-fetch', 'cross-fetch',
  'moment', 'dayjs', 'date-fns', 'luxon',
  'redux', 'mobx', 'zustand', 'jotai', 'recoil', 'pinia', 'xstate',
  'zod', 'yup', 'joi', 'ajv', 'valibot',
  'prisma', 'drizzle', 'typeorm', 'sequelize', 'mongoose', 'knex',
  'tailwind', 'postcss', 'sass', 'less', 'styled', 'emotion', '@emotion',
  '@mui', '@chakra', '@mantine', 'antd', '@ant-design', 'bootstrap',
  '@radix', 'headless', '@headlessui',
  'lucide', '@heroicons', '@fortawesome', 'react-icons',
  'framer', 'framer-motion', 'motion', 'gsap', 'anime',
  'three', 'threejs', '@react-three', 'babylon',
  'esbuild', 'swc', '@swc', 'webpack', 'rollup', 'parcel', 'turbo',
  'jest', 'vitest', 'mocha', 'chai', 'cypress', 'playwright', '@playwright',
  '@testing-library', 'enzyme',
  'eslint', 'prettier', 'typescript', 'tslint',
  'socket', 'socket.io', 'ws', 'mqtt',
  'graphql', 'apollo', '@apollo', 'urql', 'relay',
  'trpc', '@trpc',
  'firebase', '@firebase', 'supabase', '@supabase', 'aws', '@aws-sdk',
  'stripe', 'paypal', 'twilio', 'sendgrid',
  'winston', 'pino', 'bunyan', 'log4js',
  'bcrypt', 'argon', 'crypto', 'jsonwebtoken', 'jwt', 'passport',
  'sharp', 'jimp', 'canvas', 'puppeteer', 'playwright',
  'cheerio', 'jsdom', 'marked', 'markdown', 'remark', 'rehype',
  'pdf', 'xlsx', 'csv', 'xml', 'yaml', 'toml',
  'uuid', 'nanoid', 'ulid', 'cuid',
  'clsx', 'classnames', 'tailwind-merge',
  'immer', 'immutable',
  'rxjs', 'observable',
  'commander', 'yargs', 'inquirer', 'prompts', 'ora', 'chalk', 'colors',
  'glob', 'globby', 'fast-glob', 'rimraf', 'fs-extra', 'chokidar',
  'dotenv', 'config', 'convict',
  'http-proxy', 'cors', 'helmet', 'compression',
  'formik', 'react-hook-form', 'final-form',
  '@tanstack', 'tanstack',
  'swr', 'react-query',
  'i18n', 'i18next', 'react-intl', 'formatjs',
  'chart', 'chartjs', 'd3', 'recharts', 'victory', 'nivo', 'echarts',
  'table', 'ag-grid', '@ag-grid', 'tanstack-table',
  'dnd', 'react-dnd', 'dnd-kit', '@dnd-kit', 'beautiful-dnd',
  'editor', 'monaco', 'codemirror', 'slate', 'quill', 'prosemirror', 'tiptap',
  'map', 'mapbox', 'leaflet', 'react-map', 'google-maps',
  'video', 'player', 'plyr', 'video.js', 'hls',
  'carousel', 'swiper', 'slider', 'splide',
  'modal', 'dialog', 'drawer', 'popover', 'tooltip',
  'toast', 'notification', 'sonner', 'react-hot-toast', 'notistack',
  'virtual', 'virtualized', 'react-virtual', 'react-window',
  'infinite', 'scroll', 'intersection',
  'animation', 'spring', 'react-spring', 'auto-animate',
  'test', 'testing', 'mock', 'faker', '@faker-js',
  'storybook', '@storybook',
  'monorepo', 'lerna', 'nx', 'turborepo',
];

async function fetchNpmSuggestions(query, size = 10) {
  const url = `${NPM_SEARCH}?text=${encodeURIComponent(query)}&size=${size}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return (data.objects || []).map(obj => obj.package.name);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function discoverPackages(precomputedPath) {
  log('Loading existing precomputed packages...');
  const precomputed = existsSync(precomputedPath)
    ? JSON.parse(readFileSync(precomputedPath, 'utf-8'))
    : {};
  const existingPackages = new Set(Object.keys(precomputed));
  log(`Existing packages: ${existingPackages.size}`);

  const discovered = new Set();
  let completed = 0;
  let errors = 0;

  log(`Fetching suggestions for ${SEARCH_PREFIXES.length} prefixes...`);

  for (const prefix of SEARCH_PREFIXES) {
    const progress = `[${completed + 1}/${SEARCH_PREFIXES.length}]`;

    try {
      const packages = await fetchNpmSuggestions(prefix, 15);
      let newCount = 0;

      for (const pkg of packages) {
        if (!existingPackages.has(pkg) && !discovered.has(pkg)) {
          discovered.add(pkg);
          newCount++;
        }
      }

      if (newCount > 0) {
        log(`${progress} "${prefix}": +${newCount} new packages`);
      }
    } catch (e) {
      log(`${progress} "${prefix}": ERROR - ${e.message}`);
      errors++;

      // If rate limited, wait longer
      if (e.message.includes('429')) {
        log('Rate limited, waiting 5 seconds...');
        await sleep(5000);
      }
    }

    completed++;

    // Rate limit: 200ms between requests (5 req/sec)
    await sleep(200);
  }

  log('');
  log(`Discovered ${discovered.size} new packages`);
  log(`Errors: ${errors}`);

  return Array.from(discovered);
}

async function precomputePackages(packages, outputPath) {
  log(`Precomputing ${packages.length} packages...`);

  // Load existing results
  let results = {};
  if (existsSync(outputPath)) {
    results = JSON.parse(readFileSync(outputPath, 'utf-8'));
    log(`Loaded ${Object.keys(results).length} existing results`);
  }

  let completed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const pkg of packages) {
    if (results[pkg]) {
      completed++;
      continue;
    }

    const progress = `[${completed + 1}/${packages.length}]`;
    log(`${progress} Analyzing: ${pkg}`);

    try {
      const result = await Promise.race([
        analyze(pkg, { maxExports: 9999 }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 180000) // 3 min timeout
        )
      ]);

      if (!result.error) {
        results[pkg] = result;
        log(`${progress} ✓ ${pkg}: ${(result.size / 1000).toFixed(1)} KB`);
        succeeded++;
      } else {
        log(`${progress} ✗ ${pkg}: ${result.error}`);
        failed++;
      }
    } catch (e) {
      log(`${progress} ✗ ${pkg}: ${e.message}`);
      failed++;
    }

    completed++;

    // Save every 5 packages
    if (completed % 5 === 0) {
      writeFileSync(outputPath, JSON.stringify(results, null, 2));
      log(`--- Checkpoint: ${Object.keys(results).length} packages ---`);
    }

    await sleep(500);
  }

  // Final save
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  log('');
  log(`Completed: ${succeeded} succeeded, ${failed} failed`);
  log(`Total cached: ${Object.keys(results).length}`);
}

// Main
const args = process.argv.slice(2);
const shouldPrecompute = args.includes('--precompute');
const precomputedPath = '../hmr-api/priv/precomputed.json';
const discoveredPath = '../hmr-api/priv/discovered.json';

(async () => {
  // Step 1: Discover new packages from npm search
  const newPackages = await discoverPackages(precomputedPath);

  // Save discovered packages list
  writeFileSync(discoveredPath, JSON.stringify(newPackages, null, 2));
  log(`Saved ${newPackages.length} discovered packages to ${discoveredPath}`);

  if (shouldPrecompute && newPackages.length > 0) {
    log('');
    log('='.repeat(60));
    log('STARTING PRECOMPUTE');
    log('='.repeat(60));

    await precomputePackages(newPackages, precomputedPath);
  } else if (newPackages.length > 0) {
    log('');
    log('To precompute these packages, run:');
    log('  bun src/discover-packages.js --precompute');
    log('');
    log('Or add them to precompute.js and run:');
    log('  bun src/precompute.js ../hmr-api/priv/precomputed.json');
  }
})();
