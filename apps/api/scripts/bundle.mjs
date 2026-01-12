import * as esbuild from 'esbuild';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, '..');

// Plugin to make external native modules use require() instead of import
const nativeModulePlugin = {
  name: 'native-modules',
  setup(build) {
    // Mark native modules as external but convert to require
    // These modules have native .node bindings that can't be bundled
    const nativeModules = ['sqlite3', 'better-sqlite3'];
    
    nativeModules.forEach(mod => {
      build.onResolve({ filter: new RegExp(`^${mod}$`) }, () => {
        return { path: mod, external: true, namespace: 'native-require' };
      });
    });
    
    // For external native modules, we use require() which respects NODE_PATH
    build.onLoad({ filter: /.*/, namespace: 'native-require' }, args => {
      return {
        contents: `module.exports = require("${args.path}");`,
        loader: 'js',
      };
    });
  }
};

// Banner to define __dirname/__filename for CJS compatibility
const cjsBanner = `
var __bundled_dirname = typeof __dirname !== 'undefined' ? __dirname : require('path').dirname(__filename);
var __bundled_filename = typeof __filename !== 'undefined' ? __filename : '';
`;

// Bundle the app.js for Electron (single file with all dependencies)
// All pure JS dependencies are bundled, native modules use require()
await esbuild.build({
  entryPoints: [join(apiRoot, 'dist', 'app.js')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs', // Use CommonJS so require() works for native modules
  outfile: join(apiRoot, 'dist', 'app.bundle.cjs'),
  plugins: [nativeModulePlugin],
  banner: { js: cjsBanner },
  logLevel: 'warning',
  // Define import.meta.url replacement to avoid CJS incompatibility
  define: {
    'import.meta.url': 'undefined'
  }
});

// eslint-disable-next-line no-undef
console.log('API bundled to dist/app.bundle.cjs');

// Also create a package.json in dist to mark it as ESM (for non-bundled files)
writeFileSync(
  join(apiRoot, 'dist', 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2)
);

// Create an ESM wrapper that exports the CJS bundle
// The wrapper adds the unpacked node_modules to require paths before loading
writeFileSync(
  join(apiRoot, 'dist', 'app.bundle.js'),
  `import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Add unpacked node_modules to module paths for native modules
const Module = await import('module');
const resourcesPath = dirname(dirname(dirname(dirname(__dirname)))); // Go up from apps/api/dist to resources
const unpackedNodeModules = join(resourcesPath, 'app.asar.unpacked', 'node_modules');

// Inject into global module paths if running in packaged app
if (resourcesPath.includes('app.asar')) {
  Module.default.globalPaths.unshift(unpackedNodeModules);
  // Also add directly to the node_modules beside the bundle
  Module.default.globalPaths.unshift(join(__dirname, '..', '..', '..', 'node_modules'));
}

const require = createRequire(import.meta.url);
const bundle = require('./app.bundle.cjs');
export const createApp = bundle.createApp;
export default bundle;
`
);

// eslint-disable-next-line no-undef
console.log('Created ESM wrapper at dist/app.bundle.js');
