// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  // Output mode: 'static' with adapter allows hybrid rendering
  // Pages are static by default, but can opt into SSR with:
  //   export const prerender = false;
  output: 'static',

  // Node adapter for SSR pages and API routes
  adapter: node({
    mode: 'standalone'  // Runs as standalone Node server
  }),

  // Vite configuration
  vite: {
    plugins: [tailwindcss()],

    // Ensure better-sqlite3 is treated as external (native module)
    optimizeDeps: {
      exclude: ['better-sqlite3']
    }
  }
});
