import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const restTarget = 'http://8.217.182.207:8888';
const wsNode1Target = 'ws://8.217.182.207:8081';
const wsNode2Target = 'ws://8.217.182.207:8082';

const proxy = {
  '/static': { target: restTarget, changeOrigin: true },
  '/api': {
    target: restTarget,
    changeOrigin: true,
  },
  '/omnios-ws-node-1': {
    target: wsNode1Target,
    changeOrigin: true,
    ws: true,
    rewrite: (path: string) => path.replace(/^\/omnios-ws-node-1/, ''),
  },
  '/omnios-ws-node-2': {
    target: wsNode2Target,
    changeOrigin: true,
    ws: true,
    rewrite: (path: string) => path.replace(/^\/omnios-ws-node-2/, ''),
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const projectDirectory = fileURLToPath(new URL('.', import.meta.url));
  const referenceDirectory = fileURLToPath(new URL('../OmniOS-main-1008/', import.meta.url));
  // Only import the basemap key. Never inherit the reference project's backend credentials.
  const projectKey = loadEnv(mode, projectDirectory, 'VITE_CARTO_API_KEY').VITE_CARTO_API_KEY?.trim();
  const referenceKey = projectKey ? undefined : loadEnv(mode, referenceDirectory, 'VITE_CARTO_API_KEY').VITE_CARTO_API_KEY?.trim();
  const cartoKey = projectKey || referenceKey;
  if (cartoKey) {
    console.info(`[maps] CARTO key loaded from ${projectKey ? 'this project/environment' : 'OmniOS-main-1008'}. Key value is not logged.`);
  } else {
    console.warn('[maps] VITE_CARTO_API_KEY is missing in this project and OmniOS-main-1008. CARTO basemaps cannot render without an authorized key. Request one at https://carto.com/basemaps/apikey/');
  }
  return {
    base: '/OminiOS/',
    define: cartoKey ? { 'import.meta.env.VITE_CARTO_API_KEY': JSON.stringify(cartoKey) } : {},
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-i18next', 'i18next'],
            'echarts-vendor': ['echarts', 'echarts-for-react'],
            'map-vendor': ['leaflet'],
            'xlsx-vendor': ['xlsx'],
          },
        },
      },
    },
  };
});
