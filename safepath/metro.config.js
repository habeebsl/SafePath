const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for .mjs files
config.resolver.sourceExts.push('mjs');

// Configure resolver to handle package exports
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
