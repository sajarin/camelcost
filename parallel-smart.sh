#!/bin/bash
# Smart parallel precomputation - skips already analyzed packages
# Uses xargs -P for parallel execution
# Now with early tree-shakeability check to save time on non-tree-shakeable packages

WORKERS=${1:-6}
BASEDIR="/Users/sajarin/Desktop/Code/hmreacts/camelcost"
EXISTING="$BASEDIR/precomputed.json"
OUTPUT="$BASEDIR/precomputed_new.json"

cd "$BASEDIR"

# Create results directory
rm -rf results && mkdir -p results

# Get list of already analyzed packages
DONE=$(node -e "console.log(Object.keys(require('$EXISTING')).join('\n'))" 2>/dev/null)

# All packages to analyze - expanded list of popular npm packages
ALL_PACKAGES=(
  # Core utilities
  lodash chalk react express debug async fs-extra moment prop-types react-dom
  bluebird underscore vue axios tslib mkdirp glob yargs classnames uuid jquery
  through2 core-js semver cheerio rimraf q js-yaml redux object-assign handlebars
  ora node-fetch socket.io ws chokidar co nan optimist promise morgan less qs
  loader-utils marked mime meow styled-components resolve reflect-metadata
  jsonwebtoken extend cookie-parser whatwg-fetch mysql joi minimatch node-uuid
  es6-promise cross-spawn uglify-js cors npm koa isomorphic-fetch prompt angular
  execa browserify opn validator vuex prettier invariant jsdom redux-thunk pg got
  ajv xtend nodemailer source-map-support express-session d3 passport grunt
  path-to-regexp mustache inherits tmp md5 crypto-js through connect progress
  iconv-lite bunyan ncp lodash.merge lru-cache moment-timezone figlet history
  pluralize url log4js cli-table archiver clone jsonfile shortid querystring
  serve-static pug config source-map concat-stream lodash.get serve-favicon
  stylus date-fns esprima bindings events graceful-fs mime-types warning
  bignumber.js eventemitter3 strip-ansi cli-color form-data camelcase merge
  http-proxy multer deep-equal dateformat sinon which markdown-it tar js-beautify
  log-symbols rollup nodemon boom xmldom ini pify command-line-args vinyl mz
  lodash.debounce html-minifier nconf clean-css hoek cookie when nunjucks acorn
  amqplib color ms js-cookie temp simple-git cssnano reselect yamljs ioredis
  escape-string-regexp bn.js escodegen babelify helmet nopt knex assert global
  npmlog backbone graphql-tag vinyl-fs lodash.throttle passport-local eventemitter2
  mqtt buffer jszip node-notifier hammerjs htmlparser2 filesize consolidate
  pkginfo clear should json5 change-case app-root-path pump babylon mobx adm-zip
  deep-extend rc yallist safe-buffer level pixi.js howler tone matter-js p5
  chart.js echarts fabric konva leaflet mapbox-gl gsap anime velocity scrollreveal
  aos swiper glide clsx zustand jotai valtio immer zod yup fp-ts neverthrow
  hotscript nanoid cuid ulid ksuid dayjs luxon date-fns-tz spacetime chrono-node
  ms pretty-ms humanize-duration timeago.js moment-duration-format accounting
  numeral currency.js dinero.js big.js decimal.js fraction.js mathjs numeric
  ml-matrix simple-statistics jstat probability-distributions random-js seedrandom
  uuid-random nanoid-dictionary hashids sqids short-uuid cuid2 hyperid flake-idgen
  pino winston bunyan log4js signale consola debug loglevel roarr

  # React ecosystem
  react-router react-router-dom react-query @tanstack/react-query swr
  react-hook-form formik react-select downshift react-table @tanstack/react-table
  react-spring framer-motion react-transition-group react-modal react-tooltip
  react-toastify react-hot-toast sonner react-icons lucide-react @heroicons/react
  react-dropzone react-dnd react-beautiful-dnd @dnd-kit/core react-virtualized
  react-window react-virtuoso react-intersection-observer react-use usehooks-ts
  @headlessui/react @radix-ui/react-dialog @radix-ui/react-dropdown-menu
  @radix-ui/react-popover @radix-ui/react-tooltip @radix-ui/react-tabs
  @radix-ui/react-accordion @radix-ui/react-checkbox @radix-ui/react-slider
  @radix-ui/react-switch @radix-ui/react-select @radix-ui/react-alert-dialog

  # State management
  redux redux-toolkit @reduxjs/toolkit recoil mobx-react-lite effector
  xstate @xstate/react nanostores @nanostores/react

  # CSS-in-JS
  styled-components emotion @emotion/react @emotion/styled styled-jsx
  linaria @vanilla-extract/css tailwind-merge class-variance-authority

  # Build tools & bundlers
  webpack esbuild vite rollup parcel swc terser babel-core @babel/core
  @babel/preset-env @babel/preset-react @babel/preset-typescript
  postcss autoprefixer cssnano sass less stylus

  # Testing
  jest mocha chai jasmine vitest @testing-library/react @testing-library/dom
  cypress playwright puppeteer sinon nock msw supertest enzyme

  # HTTP & APIs
  axios fetch-mock node-fetch ky got superagent request needle
  graphql @apollo/client urql graphql-request

  # Database & ORM
  prisma typeorm sequelize mongoose knex pg mysql2 sqlite3 redis ioredis

  # Auth & Security
  jsonwebtoken bcrypt argon2 passport passport-jwt helmet cors

  # Utilities
  lodash-es ramda remeda underscore fp-ts io-ts effect
  date-fns dayjs luxon moment moment-timezone
  zod yup joi superstruct valibot arktype typebox
  uuid nanoid cuid ulid ksuid

  # Node.js specific
  express koa fastify hapi restify polka
  socket.io ws faye primus
  commander yargs meow cac clipanion oclif
  dotenv config convict
  pino winston bunyan morgan debug

  # Frontend frameworks
  vue @vue/reactivity @vue/runtime-core svelte solid-js preact lit alpine
  angular @angular/core @angular/common @angular/forms

  # Animation & Graphics
  gsap anime.js motion popmotion framer-motion
  three @react-three/fiber @react-three/drei babylon
  d3 chart.js recharts victory nivo @nivo/core

  # Rich text & Markdown
  marked markdown-it remark unified rehype
  prosemirror-state prosemirror-view tiptap @tiptap/core
  slate draft-js quill lexical

  # Forms & Validation
  react-hook-form formik final-form vest
  zod yup joi superstruct valibot

  # Internationalization
  i18next react-i18next intl-messageformat

  # Date pickers & Calendars
  react-datepicker react-day-picker @fullcalendar/core

  # Tables & Data grids
  @tanstack/react-table ag-grid-community react-data-grid

  # Maps
  leaflet mapbox-gl @react-google-maps/api react-map-gl

  # File handling
  file-saver jszip archiver pdfkit jspdf xlsx papaparse

  # Image processing
  sharp jimp canvas fabric

  # WebGL & 3D
  three babylonjs phaser pixi.js

  # Additional popular packages
  rxjs ramda immutable seamless-immutable
  path-to-regexp url-pattern route-parser
  query-string qs querystring
  he entities html-entities
  dompurify sanitize-html xss
  highlight.js prism-react-renderer shiki
  codemirror @codemirror/state monaco-editor
  react-syntax-highlighter
  copy-to-clipboard clipboard
  qrcode qrcode.react
  barcode jsbarcode
  pdf-lib pdfmake jspdf
  docx mammoth
  exceljs xlsx
  papaparse csv-parse d3-dsv
  socket.io-client
  mqtt
  eventemitter3 mitt tiny-emitter
  deepmerge lodash.merge
  fast-deep-equal lodash.isequal
  debounce lodash.debounce
  throttle lodash.throttle
  memoize-one lodash.memoize
  object-hash hash-sum
  spark-md5 js-md5 crypto-js
  tweetnacl libsodium-wrappers
  ua-parser-js bowser detect-browser
  mobile-detect
  is-mobile
  classnames clsx cva
  tailwind-merge twMerge
  match-sorter fuse.js fuzzysort minisearch
  flexsearch lunr elasticlunr
  typesense meilisearch
  algoliasearch
  react-instantsearch
  use-debounce
  react-error-boundary
  sentry @sentry/react @sentry/browser
  datadog-metrics
  @segment/analytics-next
  mixpanel-browser
  amplitude-js
  posthog-js
  heap-api
  hotjar
  fullstory
  logrocket
)

echo "=== SMART PARALLEL PRECOMPUTE ==="
echo "Workers: $WORKERS"
echo "Base dir: $BASEDIR"
echo ""

# Filter out already done packages
TODO=()
for pkg in "${ALL_PACKAGES[@]}"; do
  if ! echo "$DONE" | grep -qx "$pkg"; then
    TODO+=("$pkg")
  fi
done

echo "Already done: $(echo "$DONE" | wc -l | tr -d ' ')"
echo "To analyze: ${#TODO[@]}"
echo ""

if [ ${#TODO[@]} -eq 0 ]; then
  echo "Nothing to do!"
  exit 0
fi

# Progress counter
TOTAL=${#TODO[@]}
COUNT=0

# Analyze function
analyze() {
  local pkg="$1"
  local result_file="results/${pkg//\//_}.json"

  timeout 120 node src/analyze-single.js "$pkg" $$ > "$result_file" 2>/dev/null

  if [ -s "$result_file" ] && grep -q '"success":true' "$result_file"; then
    local size=$(grep -o '"size":[0-9]*' "$result_file" | head -1 | cut -d: -f2)
    local tree=$(grep -o '"treeShakeable":[a-z]*' "$result_file" | head -1 | cut -d: -f2)
    local kb=$(awk "BEGIN {printf \"%.1f\", $size/1024}")
    if [ "$tree" = "true" ]; then
      echo "✓ $pkg: ${kb} KB (tree-shakeable)"
    else
      echo "○ $pkg: ${kb} KB"
    fi
  else
    echo "✗ $pkg"
    rm -f "$result_file"
  fi
}

export -f analyze

# Run in parallel using xargs
printf '%s\n' "${TODO[@]}" | xargs -P $WORKERS -I {} bash -c 'analyze "$@"' _ {}

echo ""
echo "=== MERGING RESULTS ==="

# Merge with existing data
node -e "
const fs = require('fs');
const path = require('path');

// Load existing
let existing = {};
try {
  existing = JSON.parse(fs.readFileSync('$EXISTING', 'utf-8'));
} catch (e) {
  console.log('No existing file, starting fresh');
}
console.log('Existing:', Object.keys(existing).length);

// Load new results
const files = fs.readdirSync('results').filter(f => f.endsWith('.json'));
let added = 0;
let treeShakeable = 0;

for (const f of files) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join('results', f), 'utf-8'));
    if (data.success && data.data && data.package) {
      existing[data.package] = data.data;
      added++;
      if (data.data.treeShakeable) treeShakeable++;
    }
  } catch (e) {}
}

console.log('Added:', added, '(' + treeShakeable + ' tree-shakeable)');
console.log('Total:', Object.keys(existing).length);

fs.writeFileSync('$OUTPUT', JSON.stringify(existing, null, 2));
console.log('Written to: $OUTPUT');
"

echo ""
echo "=== DONE ==="
