import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('phaser')) {
            return 'phaser';
          }
          if (id.includes('monaco-editor')) {
            return 'monaco';
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  // Ensure pixel art stays crisp
  css: {
    modules: false,
  },
});
