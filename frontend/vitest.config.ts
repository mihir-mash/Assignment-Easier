import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'frontend',
  test: { environment: 'jsdom', setupFiles: './src/testSetup.ts' }
});
