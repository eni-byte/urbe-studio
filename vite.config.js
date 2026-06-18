import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build de production Urbe Studio : compile le code React (plus de Babel navigateur ni CDN).
// Les fichiers de public/ (studio, covers, blog, robots.txt, sitemap.xml, 404.html) sont
// copiés tels quels dans dist/.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1500,
  },
});
