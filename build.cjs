const esbuild = require('esbuild');
const { esbuildPluginTsc } = require('esbuild-plugin-tsc');

esbuild.build({
  entryPoints: ['src/server/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist/server.cjs',
  external: [
    // Node.js built-ins
    'crypto',
    'zlib',
    'readline',
    'fs',
    'path',
    'url',
    'http',
    'https',
    'stream',
    'util',
    'events',
    'buffer',
    'querystring',
    'os',
    // NPM packages
    '@upstash/redis',
    'express',
    'cors',
    'dotenv',
    'express-rate-limit',
    'express-slow-down',
    'node-fetch',
    'cheerio',
    'crypto-js',
    'hls-parser',
    'tough-cookie',
    'undici',
    'unpacker',
    'cookie',
    'form-data',
    'set-cookie-parser',
    'iso-639-1',
    'json5',
    'nanoid',
    'abort-controller'
  ],
  plugins: [
    esbuildPluginTsc({
      force: true
    })
  ],
  logLevel: 'info',
  sourcemap: false,
  minify: true
}).catch(() => process.exit(1));
