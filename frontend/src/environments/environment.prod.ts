/**
 * Production environment configuration.
 * Values injected at build time via CI/CD.
 */
export const environment = {
  production: true,
  debugLogging: false,
  supabaseUrl: 'https://ogfsahwwsiuwxowsstpa.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nZnNhaHd3c2l1d3hvd3NzdHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NzIwODMsImV4cCI6MjA4NjU0ODA4M30.3Gbw3eizyhHbuo9hJ5yL3dfGYp-jxMlrd_8PYCUVIo8',
  wsUrl: 'wss://ws.wigma.app',
};
