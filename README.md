# camelcost

Production-accurate npm bundle size analyzer.

## What it does

Measures the real cost of npm packages using the same pipeline your users experience:

1. **Rollup** bundles the package
2. **esbuild** minifies it
3. **Brotli** compresses it (level 11)

This gives you the actual bytes shipped to browsers, not theoretical estimates.

## Install

```bash
bun install
```

## Usage

### CLI

```bash
bun src/cli.js lodash
bun src/cli.js react@18.0.0
bun src/cli.js @scope/package
```

### Programmatic

```javascript
import { analyze } from './src/index.js';

const result = await analyze('lodash');
// {
//   package: 'lodash',
//   version: '4.17.21',
//   size: 25312,        // brotli bytes
//   raw: 72456,         // minified bytes
//   exports: 314,
//   exportSizes: [...], // individual export sizes
//   treeShakeable: true
// }
```

### Precompute

Analyze packages in bulk for caching:

```bash
bun src/precompute.js
```

Saves progress automatically. Resumes on crash.

## Port Mode

For integration with other services:

```bash
bun src/port.js
```

Reads JSON commands from stdin, writes results to stdout.

## License

MIT
