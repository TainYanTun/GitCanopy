import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const cspPlugin = () => ({
  name: 'html-csp',
  transformIndexHtml(html: string, ctx: any) {
    if (ctx.server) {
      // Dev mode: Allow localhost
      return html.replace(
        '<meta name="csp-placeholder">',
        '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: https://www.gravatar.com; connect-src \'self\' http://localhost:3000 ws://localhost:3000;">'
      );
    }
    // Prod mode: Strict CSP
    return html.replace(
      '<meta name="csp-placeholder">',
      '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: https://www.gravatar.com; connect-src \'self\';">'
    );
  }
});

export default defineConfig(({ mode }) => ({
  plugins: [react(), cspPlugin()],
  root: './src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    // No source maps in production — keeps bundle lean and prevents source exposure
    sourcemap: mode === 'development',
    // Use terser for better minification and dead code elimination in production
    minify: mode === 'production' ? 'terser' : false,
    terserOptions: mode === 'production' ? {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    } : undefined,
    // Inline assets smaller than 4KB as base64 to save round trips
    assetsInlineLimit: 4096,
    // Warn when a chunk exceeds 1MB (after splitting)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@src': resolve(__dirname, 'src'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@main': resolve(__dirname, 'src/main'),
      '@preload': resolve(__dirname, 'src/preload'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
}));

