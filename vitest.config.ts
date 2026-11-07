import { defineConfig } from 'vitest/config'

// Configuración propia para los tests: no hereda los plugins de Figma Make de vite.config.ts.
export default defineConfig({
  test: {
    environment: 'node',
    // También la lógica pura que comparten las Edge Functions (sin APIs de Deno).
    include: ['src/**/*.test.ts', 'supabase/functions/_compartido/**/*.test.ts'],
  },
})
