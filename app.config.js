require('dotenv').config();

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    mapTilerKey: process.env.EXPO_PUBLIC_MAPTILER_KEY,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
