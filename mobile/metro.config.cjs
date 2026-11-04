const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
// Web and native deliberately execute the same bounded station state machine.
config.watchFolders = [path.resolve(__dirname, '..')];
module.exports = config;
