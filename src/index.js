/**
 * camelcost - Production-accurate bundle size analyzer
 * Pipeline: Rollup (bundle) → esbuild (minify) → Brotli
 */

import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import json from '@rollup/plugin-json';
import { transform } from 'esbuild';
import { brotliCompressSync, constants } from 'zlib';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const BROTLI_LEVEL = 11;

// Validate package name against npm naming rules
// Prevents command injection and path traversal
function validatePackageName(name) {
  // npm package name rules:
  // - max 214 chars
  // - lowercase
  // - can contain hyphens, underscores, dots
  // - scoped packages start with @
  // - no spaces or special shell characters

  if (!name || typeof name !== 'string') {
    throw new Error('Invalid package name');
  }

  if (name.length > 214) {
    throw new Error('Package name too long');
  }

  // Block shell metacharacters and path traversal
  const dangerous = /[;&|`$(){}[\]<>\\!#*?"'\n\r\t]|\.\.\/|^\s|\s$/;
  if (dangerous.test(name)) {
    throw new Error('Invalid characters in package name');
  }

  // Must match valid npm package pattern
  // Scoped: @scope/name or @scope/name@version
  // Regular: name or name@version
  const validPattern = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[a-z0-9.-]+)?$/i;
  if (!validPattern.test(name)) {
    throw new Error('Invalid package name format');
  }

  return true;
}

// Parse package specifier into name and version
// e.g., "react@18.0.0" -> { name: "react", spec: "react@18.0.0" }
// e.g., "@scope/pkg@1.0.0" -> { name: "@scope/pkg", spec: "@scope/pkg@1.0.0" }
function parsePackageSpec(packageSpec) {
  // Validate first to prevent injection
  validatePackageName(packageSpec);

  // Handle scoped packages like @scope/pkg@version
  if (packageSpec.startsWith('@')) {
    const slashIdx = packageSpec.indexOf('/');
    const afterSlash = packageSpec.slice(slashIdx + 1);
    const atIdx = afterSlash.indexOf('@');
    if (atIdx > 0) {
      return { name: packageSpec.slice(0, slashIdx + 1 + atIdx), spec: packageSpec };
    }
    return { name: packageSpec, spec: packageSpec };
  }
  // Handle regular packages like pkg@version
  const atIdx = packageSpec.indexOf('@');
  if (atIdx > 0) {
    return { name: packageSpec.slice(0, atIdx), spec: packageSpec };
  }
  return { name: packageSpec, spec: packageSpec };
}

export async function analyze(packageName, options = {}) {
  const { maxExports = 9999, tmpDir: customTmpDir, debug = false } = options;
  const tmpDir = customTmpDir || `/tmp/camelcost-${process.pid}-${Date.now()}`;
  const { name: pkgName, spec: pkgSpec } = parsePackageSpec(packageName);

  try {
    mkdirSync(tmpDir, { recursive: true });

    // Install package (use full spec with version)
    execSync(`bun add ${pkgSpec} --ignore-scripts 2>/dev/null`, {
      cwd: tmpDir,
      timeout: 60000
    });

    // Get package info (use just the name, not the version)
    const pkgJsonPath = join(tmpDir, 'node_modules', pkgName, 'package.json');
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));

    // Measure full package (use name without version for imports)
    const full = await measureFullPackage(pkgName, tmpDir);
    if (full.error) {
      return { error: full.error, package: pkgName };
    }

    // Get exports
    const exports = await getExports(pkgName, tmpDir);

    // EARLY TREE-SHAKEABILITY CHECK
    // Measure just ONE export first to determine if package is tree-shakeable
    // This saves time by not computing all exports for non-tree-shakeable packages
    if (exports.length === 0) {
      // No named exports = not tree-shakeable
      if (debug) console.error(`[${pkgName}] No named exports - not tree-shakeable`);
      return {
        package: pkgName,
        version: pkgJson.version,
        size: full.brotli,
        raw: full.raw,
        exports: 0,
        exportSizes: [],
        treeShakeable: false
      };
    }

    // Test first export to check tree-shakeability
    const firstExport = exports[0];
    const firstResult = await measureExport(pkgName, firstExport, tmpDir);

    if (firstResult.error || firstResult.brotli >= full.brotli * 0.5) {
      // First export is >= 50% of full bundle = not tree-shakeable
      // Skip measuring remaining exports
      if (debug) console.error(`[${pkgName}] First export is ${Math.round(firstResult.brotli / full.brotli * 100)}% of full - not tree-shakeable`);
      return {
        package: pkgName,
        version: pkgJson.version,
        size: full.brotli,
        raw: full.raw,
        exports: exports.length,
        exportSizes: [],
        treeShakeable: false
      };
    }

    // Package IS tree-shakeable - measure all exports
    if (debug) console.error(`[${pkgName}] Tree-shakeable! Measuring ${Math.min(exports.length, maxExports)} exports...`);

    const exportSizes = [{ name: firstExport, size: firstResult.brotli }];
    const sample = exports.slice(1, maxExports); // Skip first, already measured

    for (const exp of sample) {
      const result = await measureExport(pkgName, exp, tmpDir);
      if (!result.error) {
        exportSizes.push({ name: exp, size: result.brotli });
      }
    }

    exportSizes.sort((a, b) => a.size - b.size);

    return {
      package: pkgName,
      version: pkgJson.version,
      size: full.brotli,
      raw: full.raw,
      exports: exports.length,
      exportSizes,
      treeShakeable: true
    };
  } finally {
    if (!customTmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true });
    }
  }
}

async function getExports(packageName, tmpDir) {
  const script = `
    import * as pkg from '${packageName}';
    const named = Object.keys(pkg).filter(k => k !== 'default');
    // If no named exports but has default, include 'default'
    if (named.length === 0 && 'default' in pkg) {
      console.log(JSON.stringify(['default']));
    } else {
      console.log(JSON.stringify(named));
    }
  `;
  writeFileSync(join(tmpDir, 'detect.mjs'), script);

  try {
    const result = execSync('node detect.mjs', {
      cwd: tmpDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000
    });
    return JSON.parse(result.trim());
  } catch {
    return [];
  }
}

async function bundleWithRollup(entryCode, tmpDir, externals = []) {
  const entryFile = join(tmpDir, 'entry.js');
  writeFileSync(entryFile, entryCode);

  const bundle = await rollup({
    input: entryFile,
    plugins: [
      replace({
        'process.env.NODE_ENV': JSON.stringify('production'),
        preventAssignment: true
      }),
      nodeResolve({ browser: true, preferBuiltins: false }),
      commonjs(),
      json(),
    ],
    external: externals,
    onwarn: () => {},
  });

  const { output } = await bundle.generate({ format: 'esm', compact: true });
  await bundle.close();
  return output[0].code;
}

async function minify(code) {
  const result = await transform(code, {
    minify: true,
    target: 'esnext',
    format: 'esm',
  });
  return result.code;
}

function compress(code) {
  const buffer = Buffer.from(code, 'utf-8');
  return {
    raw: buffer.length,
    brotli: brotliCompressSync(buffer, {
      params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_LEVEL }
    }).length,
  };
}

async function measureFullPackage(packageName, tmpDir) {
  const entryCode = `import * as pkg from '${packageName}';\nconsole.log(pkg);`;

  try {
    const bundled = await bundleWithRollup(entryCode, tmpDir);
    const minified = await minify(bundled);
    return compress(minified);
  } catch (e) {
    // Try with common externals
    try {
      const bundled = await bundleWithRollup(entryCode, tmpDir, ['react', 'react-dom']);
      const minified = await minify(bundled);
      return compress(minified);
    } catch {
      return { error: e.message };
    }
  }
}

async function measureExport(packageName, exportName, tmpDir) {
  // Handle default export differently
  const entryCode = exportName === 'default'
    ? `import pkg from '${packageName}';\nconsole.log(pkg);`
    : `import { ${exportName} } from '${packageName}';\nconsole.log(${exportName});`;

  try {
    const bundled = await bundleWithRollup(entryCode, tmpDir);
    const minified = await minify(bundled);
    return compress(minified);
  } catch (e) {
    try {
      const bundled = await bundleWithRollup(entryCode, tmpDir, ['react', 'react-dom']);
      const minified = await minify(bundled);
      return compress(minified);
    } catch {
      return { error: e.message };
    }
  }
}

export { getExports, measureFullPackage, measureExport };
