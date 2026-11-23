const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
// Web and native deliberately execute the same bounded station state machine.
config.watchFolders = [path.resolve(__dirname, '..')];
// The web root uses a different React release. Shared source is watched, but
// every native import (including the renderer and JSX runtime) must share the
// mobile React dispatcher. A second React copy crashes real-device hook calls.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const target = moduleName === 'react' || moduleName.startsWith('react/')
    ? require.resolve(moduleName, { paths: [__dirname] }) : moduleName;
  return context.resolveRequest(context, target, platform);
};
module.exports = config;
