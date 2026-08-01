import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  publicDir: 'public',
  server: { port: 5180, host: true },
});
