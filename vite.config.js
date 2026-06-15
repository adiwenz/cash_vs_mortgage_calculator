import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['test_*.js', 'test_*.jsx'],
    exclude: ['tests/**', 'node_modules/**'],
    setupFiles: ['./vitest.setup.js']
  }
})
