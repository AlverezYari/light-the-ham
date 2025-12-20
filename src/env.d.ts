/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// Leaflet global (loaded from CDN)
declare global {
  interface Window {
    L: typeof import('leaflet');
  }
}

export {};
