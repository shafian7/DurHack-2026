import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// index.html belongs to lane C (B40). Until it lands, build src/main.ts on its
// own so `npm run build` passes on the bare scaffold. Once index.html exists it
// is the entry and this fallback is never used.
const entry = existsSync('index.html') ? 'index.html' : 'src/main.ts';

export default defineConfig({
  // Relative asset paths, so the built site runs from any folder or file server.
  base: './',
  build: {
    rollupOptions: { input: entry },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // Node by default. A test that needs a DOM puts
    // `// @vitest-environment jsdom` on its first line.
    environment: 'node',
  },
});
