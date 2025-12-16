#!/usr/bin/env node
/**
 * camelcost Erlang port interface
 * Reads JSON commands from stdin, writes JSON responses to stdout
 *
 * Protocol:
 *   Input:  { "cmd": "analyze", "package": "lodash" }
 *   Output: { "ok": true, "data": {...} } or { "ok": false, "error": "..." }
 */

import { analyze } from './index.js';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function respond(data) {
  console.log(JSON.stringify(data));
}

rl.on('line', async (line) => {
  let request;

  try {
    request = JSON.parse(line);
  } catch (e) {
    respond({ ok: false, error: 'Invalid JSON' });
    return;
  }

  const { cmd, package: packageName, ...options } = request;

  if (cmd === 'analyze') {
    if (!packageName) {
      respond({ ok: false, error: 'Missing package name' });
      return;
    }

    try {
      const result = await analyze(packageName, options);
      if (result.error) {
        respond({ ok: false, error: result.error });
      } else {
        respond({ ok: true, data: result });
      }
    } catch (e) {
      respond({ ok: false, error: e.message });
    }
  } else if (cmd === 'ping') {
    respond({ ok: true, data: 'pong' });
  } else {
    respond({ ok: false, error: `Unknown command: ${cmd}` });
  }
});

rl.on('close', () => {
  process.exit(0);
});

// Signal ready
respond({ ok: true, data: 'ready' });
