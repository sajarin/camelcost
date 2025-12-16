#!/usr/bin/env node
/**
 * Pre-compute sizes for popular npm packages
 * Uses static list of top 1000 most depended-upon packages
 * Outputs JSON that can be loaded into the cache
 *
 * BULLETPROOF MODE: Designed to run unattended overnight
 * - Auto-saves every 5 packages
 * - Retries failed packages up to 3 times
 * - Handles crashes gracefully with resume
 */

import { analyze } from './index.js';
import { writeFileSync, existsSync, readFileSync } from 'fs';

// Logging helper - just console.log with timestamp (nohup redirects to file)
function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
}

// Top 1000 most depended-upon npm packages (from anvaka's analysis)
// Source: https://gist.github.com/anvaka/8e8fa57c7ee1350e3491
const TOP_1000_PACKAGES = [
  'lodash', 'chalk', 'request', 'commander', 'react', 'express', 'debug', 'async',
  'fs-extra', 'moment', 'prop-types', 'react-dom', 'bluebird', 'underscore', 'vue',
  'axios', 'tslib', 'mkdirp', 'glob', 'yargs', 'colors', 'inquirer', 'webpack',
  'uuid', 'classnames', 'minimist', 'body-parser', 'rxjs', 'babel-runtime', 'jquery',
  'yeoman-generator', 'through2', 'babel-core', 'core-js', 'semver', 'babel-loader',
  'cheerio', 'rimraf', 'q', 'eslint', 'css-loader', 'shelljs', 'dotenv', 'typescript',
  '@types/node', '@angular/core', 'js-yaml', 'style-loader', 'winston', '@angular/common',
  'redux', 'object-assign', 'zone.js', 'babel-eslint', 'gulp', 'gulp-util', 'file-loader',
  'ora', 'node-fetch', '@angular/platform-browser', '@babel/runtime', 'handlebars',
  'eslint-plugin-import', '@angular/compiler', 'eslint-plugin-react', 'aws-sdk', 'yosay',
  'url-loader', '@angular/forms', 'webpack-dev-server', '@angular/platform-browser-dynamic',
  'mocha', 'html-webpack-plugin', 'socket.io', 'ws', 'babel-preset-es2015', 'postcss-loader',
  'node-sass', 'ember-cli-babel', 'babel-polyfill', '@angular/router', 'ramda', 'react-redux',
  '@babel/core', '@angular/http', 'ejs', 'coffee-script', 'superagent', 'request-promise',
  'autoprefixer', 'path', 'mongodb', 'chai', 'mongoose', 'xml2js', 'bootstrap', 'jest',
  'sass-loader', 'redis', 'vue-router', 'chokidar', 'co', 'eslint-plugin-jsx-a11y', 'nan',
  'optimist', 'promise', '@angular/animations', 'postcss', 'morgan', 'less', 'immutable',
  'qs', 'loader-utils', 'fs', 'extract-text-webpack-plugin', 'marked', 'mime', '@alifd/next',
  'meow', 'styled-components', 'resolve', 'reflect-metadata', 'babel-preset-react',
  'jsonwebtoken', 'react-router-dom', 'extend', 'cookie-parser', 'whatwg-fetch',
  'babel-preset-env', 'babel-jest', 'mysql', 'joi', 'minimatch', 'eslint-loader',
  'react-dev-utils', 'node-uuid', 'es6-promise', 'cross-spawn',
  'case-sensitive-paths-webpack-plugin', 'uglify-js', 'cors', 'eslint-plugin-flowtype',
  'react-router', '@babel/preset-env', 'deepmerge', 'socket.io-client', 'npm',
  'webpack-manifest-plugin', 'koa', 'isomorphic-fetch', 'babel-cli', 'del',
  'postcss-flexbugs-fixes', 'compression', 'update-notifier', 'babel-preset-react-app',
  'jade', 'prompt', 'gulp-rename', 'angular', 'underscore.string', 'graphql', 'execa',
  'browserify', 'opn', 'validator', 'eslint-config-react-app', 'vuex', 'prettier',
  'invariant', 'jsdom', '@types/react', 'redux-thunk', 'mini-css-extract-plugin', 'globby',
  'pg', 'got', 'ajv', 'xtend', 'ember-cli-htmlbars', 'babel-plugin-transform-runtime',
  'nodemailer', 'source-map-support', 'express-session', 'd3', 'less-loader', 'fsevents',
  'babel-preset-stage-0', 'download-git-repo', 'query-string', 'font-awesome', 'open',
  'passport', '@types/lodash', 'grunt', 'path-to-regexp', 'mustache', 'inherits', 'tmp',
  'md5', 'dotenv-expand', 'crypto-js', 'request-promise-native', 'through', 'connect',
  'raf', 'react-scripts', 'readable-stream', 'highlight.js', '@babel/polyfill', 'progress',
  'optimize-css-assets-webpack-plugin', 'iconv-lite', 'bunyan', 'gulp-uglify', 'koa-router',
  'ncp', 'lodash.merge', 'lru-cache', 'moment-timezone', 'figlet', 'history', 'readline-sync',
  'pluralize', 'url', 'log4js', 'cli-table', 'webpack-merge', 'archiver', 'babel-register',
  'eslint-config-airbnb', 'clone', 'jsonfile', 'puppeteer', 'shortid',
  '@babel/plugin-proposal-class-properties', 'querystring', 'serve-static', 'tslint', 'pug',
  'config', 'source-map', 'antd', 'concat-stream', 'element-ui', 'lodash.get',
  '@babel/preset-react', 'serve-favicon', 'stylus', 'date-fns', 'esprima', 'sequelize',
  'babel-plugin-transform-object-rest-spread', 'bindings', 'events', 'graceful-fs',
  'normalize.css', 'crypto', 'cross-env', 'mime-types', 'event-stream',
  'hoist-non-react-statics', 'gulp-concat', 'terser-webpack-plugin', 'json-loader',
  'warning', 'bignumber.js', 'eventemitter3', 'webpack-cli', 'strip-ansi', 'cli-color',
  'form-data', 'web3', 'gulp-sourcemaps', 'webpack-dev-middleware', 'ip', 'camelcase',
  'sw-precache-webpack-plugin', 'merge', 'http-proxy', 'react-transition-group', 'multer',
  'deep-equal', 'browser-sync', 'babel', 'dateformat', 'postcss-preset-env',
  'uglifyjs-webpack-plugin', '@polymer/polymer', 'sinon', 'eslint-config-prettier',
  'gulp-sass', 'identity-obj-proxy', 'ts-loader', 'react-hot-loader', 'sqlite3', 'popper.js',
  'which', 'markdown-it', 'tar', 'vue-template-compiler', 'babel-plugin-transform-class-properties',
  'js-beautify', 'log-symbols', 'webpack-hot-middleware', 'rollup', 'copy-webpack-plugin',
  'nodemon', 'boom', 'xmldom', 'recompose', 'util', 'ini', 'pify', 'command-line-args',
  'vinyl', 'mz', 'lodash.debounce', 'html-minifier', 'ts-node', 'nconf', 'recursive-readdir',
  'vue-loader', '@types/express', 'datafire', '@types/react-dom',
  'babel-plugin-transform-decorators-legacy', 'clean-css', 'hoek', 'cookie',
  '@babel/plugin-transform-runtime', 'when', 'babel-plugin-named-asset-import',
  'postcss-safe-parser', 'bcrypt', '@material-ui/core', '@babel/plugin-syntax-dynamic-import',
  'nunjucks', 'eslint-plugin-promise', 'react-native', 'lodash.isequal',
  'workbox-webpack-plugin', 'acorn', 'amqplib', '@svgr/webpack', 'color', 'ms', 'js-cookie',
  'temp', 'simple-git', 'cssnano', 'reselect', 'yamljs', 'ioredis', 'koa-static',
  'react-app-polyfill', 'react-select', 'escape-string-regexp', 'firebase', 'bn.js',
  'escodegen', 'react-bootstrap', 'babelify', 'helmet', 'nopt', 'eslint-plugin-prettier',
  'jest-resolve', 'knex', 'pnp-webpack-plugin', 'gulp-if', 'assert', 'global', 'npmlog',
  'backbone', 'graphql-tag', 'raw-loader', 'run-sequence', 'lodash.clonedeep',
  '@oclif/command', 'http-proxy-middleware', 'gulp-babel', '@oclif/config', 'vinyl-fs',
  'lodash.throttle', 'passport-local', 'eventemitter2', 'mqtt', 'unique-random-array',
  'buffer', 'redux-saga', 'react-router-redux', 'jszip', 'koa-bodyparser', 'async-validator',
  'babel-preset-stage-2', 'node-notifier', 'eslint-config-airbnb-base', 'material-ui',
  'validate-npm-package-name', 'clean-webpack-plugin', 'hammerjs', 'redux-logger',
  'htmlparser2', 'html-loader', 'filesize', 'gulp-plumber', 'consolidate', 'pkginfo',
  'serialport', 'clear', 'should', 'json5', 'change-case',
  '@babel/plugin-proposal-object-rest-spread', 'eslint-plugin-node', 'app-root-path',
  'create-react-class', 'postcss-import', '@angular/cdk', 'webpack-bundle-analyzer',
  'JSONStream', 'pump', 'babylon', 'mobx', 'adm-zip', 'deep-extend', 'rc', 'http',
  '@angular/material', 'eslint-config-standard', 'eslint-plugin-standard', 'once', 'numeral',
  '@typescript-eslint/parser', 'prismjs', 'hapi', 'apollo-server', 'immer', 'oauth',
  '@angular/cli', 'ansi-colors', 'swig', 'ansi-styles', 'aws-amplify', 'dompurify',
  'react-intl', 'connect-history-api-fallback', 'bcryptjs', 'image-webpack-loader',
  '@nestjs/common', 'slash', 'normalize-path', 'string', '@oclif/plugin-help', 'fancy-log',
  'cheerio-select', 'localforage', 'errno', 'gulp-autoprefixer', 'busboy', 'levelup',
  'aws-serverless-express', 'stylus-loader', 'toastr', 'restify', 'fluent-ffmpeg',
  '@types/jest', 'gzip-size', 'fast-glob', 'wrap-ansi', 'electron', 'stream',
  '@babel/plugin-proposal-decorators', 'classlist-polyfill', 'uuid-validate',
  'babel-plugin-import', 'recursive-copy', 'react-loadable', 'parse5', '@hapi/joi',
  'gulp-less', 'exceljs', 'find-up', '@types/mocha', 'file-saver', 'next', 'regenerator-runtime',
  '@babel/plugin-transform-modules-commonjs', 'plist', 'split', 'commander-plus', 'svg-sprite',
  'parse-json', 'loader', 'ember-cli-test-loader', 'async-limiter', 'qrcode', 'write-file-atomic',
  'raw-body', 'fast-json-stable-stringify', 'sift', 'commander-cli', 'uglify-es', 'base',
  'react-addons-css-transition-group', 'vue-class-component', 'babel-plugin-syntax-jsx',
  'vue-property-decorator', 'lerna', '@babel/traverse', 'cron', 'vuepress', 'babel-helper-vue-jsx-merge-props',
  '@babel/generator', 'table', 'common-tags', 'pako', 'parse', 'mobx-react', 'docopt',
  'load-json-file', 'ignore', 'karma-jasmine', 'brace-expansion', 'gulp-imagemin',
  'resolve-from', 'terser', '@babel/helper-module-imports', 'exenv', '@babel/types',
  '@angular/language-service', 'boxen', 'cpy', 'string-width', 'follow-redirects',
  'rxjs-compat', 'unzip', 'http-errors', 'path-exists', 'nock', 'enzyme', 'base64-js',
  'wordwrap', 'envinfo', 'resolve-url-loader', 'codelyzer', 'react-markdown', 'sax',
  'arg', 'fast-levenshtein', 'lodash.isplainobject', 'gulp-clean-css', 'expect', 'xlsx',
  'redux-devtools-extension', 'type-is', 'tar-fs', '@fortawesome/fontawesome-svg-core',
  '@fortawesome/react-fontawesome', '@fortawesome/free-solid-svg-icons', 'get-stdin',
  'husky', '@babel/parser', 'body', 'vary', 'strip-json-comments', 'find-root', 'flat',
  '@grpc/proto-loader', 'babel-plugin-dynamic-import-node', 'redux-actions', 'arg-parser',
  'hbs', 'yup', 'supports-color', '@storybook/react', 'storybook', 'yallist', 'portfinder',
  'semver-compare', 'async-each', 'apollo-client', 'grpc', 'process', 'brace', 'velocity-animate',
  'ansi-regex', 'imagemin', 'pkg-dir', 'commander-tabtab', 'supertest', 'emitter-listener',
  'voca', 'wordcloud', 'vue-i18n', 'uniqid', 'ffi', 'bytes', 'copy-to-clipboard', 'estraverse',
  'lodash.pick', 'needle', 'yargs-parser', 'squel', 'async-foreach', 'cz-conventional-changelog',
  'cache-manager', 'retry', '@typescript-eslint/eslint-plugin', 'async-storage', 'cli-spinners',
  'npm-run-all', 'sprintf-js', 'tiny-emitter', 'xml-js', 'readable-blob-stream', 'cuid',
  'babel-plugin-react-transform', 'svgo', 'tar-stream', 'moment-locales-webpack-plugin',
  'lint-staged', 'commander-plugin-autocomplete', 'ast-types', 'uuid-by-string', 'jest-cli',
  '@storybook/addon-actions', 'socket.io-adapter', 'is-glob', 'chardet', 'npm-registry-fetch',
  'gulp-watch', 'commander-spawnargs', 'jsonify', 'object.assign', 'webpack-node-externals',
  'unist-util-visit', 'angular-mocks', 'babel-template', '@hapi/boom', 'decamelize',
  '@commitlint/cli', '@commitlint/config-conventional', 'dom-serializer', 'lodash.template',
  'sentry', 'lodash.assign', 'tsconfig-paths', 'stacktrace-js', 'nativescript', 'emitter',
  'react-test-renderer', '@emotion/core', 'emotion', 'stream-combiner', 'vue-server-renderer',
  'toml', 'eth-lib', 'map-stream', 'get-value', '@webcomponents/webcomponentsjs', 'http2',
  'npm-check-updates', 'espree', 'p-limit', 'isstream', 'sharp', 'tiny-invariant', 'react-motion',
  'angular-translate', 'xss', 'enzyme-adapter-react-16', 'uuid-random', 'listr', 'split2',
  '@storybook/addon-links', 'ref', 'lodash.isempty', 'is-number', 'html-entities', 'leven',
  'intl', 'command-exists', 'i18n', 'replace-in-file', 'twilio', 'is-windows', 'axios-mock-adapter',
  'archy', 'oauth2orize', 'uuid-parser', 'lodash.flatten', 'address', 'eth-sig-util',
  'ecc-jsbn', 'react-helmet', 'swagger-jsdoc', 'jwt-decode', 'libphonenumber-js', 'recharts',
  'formidable', 'semantic-ui-react', 'fastify', 'mobx-react-lite', 'diff', 'jshint', 'hashids',
  'rsvp', 'natural', 'string_decoder', 'react-dnd', 'on-finished', 'semver-regex', 'redux-form',
  'caniuse-lite', 'p-try', 'duplexify', 'is-stream', 'memfs', 'swagger-ui-express', 'prettier-eslint',
  'ember-source', 'cldr', 'jimp', 'react-dropzone', 'lodash.omit', 'indent-string', 'remark',
  'prop-types-extra', 'babel-plugin-module-resolver', 'swagger-parser', '@nestjs/core',
  'mssql', 'lodash.camelcase', 'node-gyp', '@testing-library/react', 'fp-ts', 'puppeteer-core',
  'chart.js', 'is-plain-object', 'ethereumjs-util', 'pdfkit', 'cross-fetch', 'react-color',
  'angular-ui-router', 'esm', 'firebase-admin', 'inquirer-autocomplete-prompt', 'neo-async',
  'vee-validate', 'is-function', 'apollo-boost', 'dom-helpers', 'react-virtualized', 'tiny-warning',
  'fast-xml-parser', 'object-keys', 'mout', 'aws-sdk-mock', 'mimic-fn', 'pkg-up', 'p-map',
  'os-locale', 'glob-parent', 'luxon', 'humanize', 'url-parse', 'chroma-js', 'twig', 'traverse',
  'pidtree', 'mock-fs', 'object.omit', 'whatwg-url', 'es6-promisify', 'prosemirror-state',
  'multipipe', 'aws-lambda', 'gulp-postcss', 'esbuild', 'decko', 'data-urls', 'anymatch',
  'babel-plugin-styled-components', 'object-hash', 'picomatch', 'nan-packager',
  'babel-plugin-add-module-exports', 'angular-resource', 'swagger-client', 'globule',
  'eslint-import-resolver-webpack', 'lodash.defaults', 'fuse.js', 'preact', 'apollo-link',
  'lowdb', 'angular2-template-loader', 'cosmiconfig', 'merge-stream', 'i18next', 'immutability-helper',
  '@ngtools/webpack', 'braces', 'phin', 'prosemirror-view', 'hasha', 'array-flatten',
  'require-directory', 'node-dir', 'rollup-plugin-node-resolve', 'chownr', 'prosemirror-model',
  'prosemirror-transform', 'dayjs', 'mitt', '@hapi/hoek', 'loud-rejection', 'p-finally', 'zen-observable',
];

// Additional modern packages not in the 2019 list
const MODERN_PACKAGES = [
  // Modern frameworks & tools
  'next', 'nuxt', 'svelte', 'solid-js', 'astro', 'remix', 'vite',
  // Modern state management
  'zustand', 'jotai', 'recoil', 'pinia', '@tanstack/react-query', 'swr',
  // Modern utilities
  'zod', 'trpc', 'prisma', '@prisma/client', 'drizzle-orm',
  'tailwindcss', 'postcss', 'autoprefixer',
  // Modern UI
  '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select',
  'lucide-react', '@heroicons/react', 'framer-motion', 'motion',
  // Modern tools
  'esbuild', 'swc', '@swc/core', 'turbo', 'turborepo',
  'vitest', 'playwright', '@playwright/test',
  // Modern validation
  'valibot', 'superstruct', 'arktype',
  // Utility libraries
  'clsx', 'tailwind-merge', 'class-variance-authority', 'cva',
  'nanoid', 'ulid', 'ky', 'ofetch',
  'date-fns', 'date-fns-tz',
  // React ecosystem
  'react-hook-form', '@tanstack/react-table', '@tanstack/react-form',
  'react-hot-toast', 'sonner', '@tanstack/react-virtual',
  // Testing
  '@testing-library/jest-dom', '@testing-library/user-event',
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get all packages to analyze
function getPackagesToAnalyze() {
  const packages = new Set(TOP_1000_PACKAGES);
  for (const pkg of MODERN_PACKAGES) {
    packages.add(pkg);
  }
  return Array.from(packages);
}

// Analyze with timeout and retries
async function analyzeWithRetry(pkg, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create a timeout promise
      const timeoutMs = 120000; // 2 minutes per package
      const result = await Promise.race([
        analyze(pkg, options),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        )
      ]);
      return result;
    } catch (e) {
      if (attempt < maxRetries) {
        log(`  Retry ${attempt}/${maxRetries} for ${pkg}: ${e.message}`);
        await sleep(2000 * attempt); // Exponential backoff
      } else {
        throw e;
      }
    }
  }
}

async function precompute(options = {}) {
  const {
    outputPath = 'precomputed.json',
    maxPackages = 1200,
    maxExports = 50,
    resume = true,
  } = options;

  log('='.repeat(60));
  log('PRECOMPUTE STARTED');
  log(`Output: ${outputPath}, Max packages: ${maxPackages}`);
  log('='.repeat(60));

  // Load existing results if resuming
  let results = {};
  let failed = {};  // Track failed packages to skip on resume
  const failedPath = outputPath.replace('.json', '.failed.json');

  if (resume && existsSync(outputPath)) {
    try {
      results = JSON.parse(readFileSync(outputPath, 'utf-8'));
      log(`Loaded ${Object.keys(results).length} existing results from ${outputPath}`);
    } catch (e) {
      log('Could not load existing results, starting fresh');
    }
  }

  if (resume && existsSync(failedPath)) {
    try {
      failed = JSON.parse(readFileSync(failedPath, 'utf-8'));
      log(`Loaded ${Object.keys(failed).length} previously failed packages to skip`);
    } catch (e) {}
  }

  // Get packages to analyze from static list
  const allPackages = getPackagesToAnalyze().slice(0, maxPackages);
  const toAnalyze = allPackages.filter(pkg => !results[pkg] && !failed[pkg]);

  log(`\nTotal packages in list: ${allPackages.length}`);
  log(`Packages to analyze: ${toAnalyze.length}`);
  log(`Already cached: ${Object.keys(results).length}`);
  log(`Previously failed: ${Object.keys(failed).length}`);
  log('');

  let completed = 0;
  let succeeded = 0;
  let errors = 0;
  const startTime = Date.now();

  for (const pkg of toAnalyze) {
    const progress = `[${completed + 1}/${toAnalyze.length}]`;
    log(`${progress} Analyzing: ${pkg}`);

    try {
      const result = await analyzeWithRetry(pkg, { maxExports });
      if (!result.error) {
        results[pkg] = result;
        log(`${progress} ✓ ${pkg}: ${(result.size / 1000).toFixed(1)} KB (${result.exports} exports)`);
        succeeded++;
      } else {
        log(`${progress} ✗ ${pkg}: ${result.error}`);
        failed[pkg] = { error: result.error, time: new Date().toISOString() };
        errors++;
      }
    } catch (e) {
      log(`${progress} ✗ ${pkg}: ${e.message}`);
      failed[pkg] = { error: e.message, time: new Date().toISOString() };
      errors++;
    }

    completed++;

    // Save every 5 packages (more frequent for safety)
    if (completed % 5 === 0) {
      writeFileSync(outputPath, JSON.stringify(results, null, 2));
      writeFileSync(failedPath, JSON.stringify(failed, null, 2));
      log(`--- Checkpoint saved: ${Object.keys(results).length} packages ---`);
    }

    // Small delay between packages to avoid overwhelming npm
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
  log(`Total cached: ${Object.keys(results).length} packages`);
  log(`This run: ${succeeded} succeeded, ${errors} failed`);
  log(`Output: ${outputPath}`);
  log('='.repeat(60));
}

// CLI
const args = process.argv.slice(2);
const outputPath = args[0] || 'precomputed.json';
const maxPackages = parseInt(args[1]) || 1200;

precompute({ outputPath, maxPackages });
