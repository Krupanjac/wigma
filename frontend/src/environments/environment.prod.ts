/**
 * Production environment configuration.
 * Values injected at build time via CI/CD.
 */
export const environment = {
  production: true,
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_ANON_KEY',
  wsUrl: 'wss://ws.wigma.app',
};
