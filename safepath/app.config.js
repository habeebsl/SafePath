require('dotenv').config();

module.exports = ({ config }) => ({
  ...config,
  extra: {
    mapTilerKey: process.env.EXPO_PUBLIC_MAPTILER_KEY,
  },
});
