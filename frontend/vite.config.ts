/** Configuration Vite, TanStack Start, Tailwind et proxy serveur des routes API relatives. */
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vite';

// Permet de pointer le proxy vers un backend isolé pendant les vérifications locales.
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({ server: { entry: 'server' } }),
    react(),
  ],
  resolve: { tsconfigPaths: true },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
