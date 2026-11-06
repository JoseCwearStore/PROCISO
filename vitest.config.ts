import { defineConfig } from 'vitest/config'

// Configuración propia para los tests: no hereda los plugins de Figma Make de vite.config.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
