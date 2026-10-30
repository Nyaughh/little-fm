const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { resolve } = require('metro-resolver');
const { getDefaultConfig } = require('expo/metro-config');
const root = path.resolve(__dirname, '..');
const config = getDefaultConfig(root);
const context = {
  originModulePath: path.join(root, 'index.ts'),
  sourceExts: config.resolver.sourceExts,
  assetExts: new Set(config.resolver.assetExts),
  preferNativePlatform: true,
  redirectModulePath: p => p,
  getPackageForModule: () => null,
  fileSystemLookup: p => {
    try { const stat = fs.statSync(p); return { exists: true, type: stat.isDirectory() ? 'd' : 'f', realPath: fs.realpathSync(p) }; }
    catch { return { exists: false }; }
  },
};
const android = resolve(context, './widgets/bridge', 'android');
const web = resolve(context, './widgets/bridge', 'web');
assert.equal(android.filePath, path.join(root, 'widgets/bridge.android.tsx'));
assert.equal(web.filePath, path.join(root, 'widgets/bridge.tsx'));
assert.equal(resolve(context, './services/cover-image', 'android').filePath, path.join(root, 'services/cover-image.native.ts'));
console.log('Metro selects the Android widget registration and native cover loader.');
