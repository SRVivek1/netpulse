// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',

  integrations: [
    react(),
  ],

  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
});
