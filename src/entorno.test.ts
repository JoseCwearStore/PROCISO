// AUD08-M1: el servidor de desarrollo no debe abrirse a la red por defecto.
// Abrirlo es opt-in (FIGMA_DEV_SERVER_HOST), no el comportamiento de fábrica.
import { afterEach, describe, expect, it, vi } from 'vitest'

async function cargarConfig() {
  vi.resetModules()
  const modulo = await import('../vite.config')
  const fabrica = modulo.default as (env: { mode: string; command: string }) => {
    server: { host: string }
    preview: { host: string }
  }
  return fabrica({ mode: 'development', command: 'serve' })
}

describe('título de la pestaña (AUD08-B7)', () => {
  it('es el nombre del producto, no el del scaffold de Figma Make', async () => {
    const sitio = (await import('../.figma/make/site.json')).default as { title?: string }
    expect(sitio.title).toBe('PROCISO')
  })
})

describe('vite.config: exposición del servidor', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('escucha solo en localhost por defecto (dev y preview)', async () => {
    vi.stubEnv('FIGMA_DEV_SERVER_HOST', '')
    const config = await cargarConfig()
    expect(config.server.host).toBe('localhost')
    expect(config.preview.host).toBe('localhost')
  })

  it('permite abrir a la red solo si se pide explícitamente', async () => {
    vi.stubEnv('FIGMA_DEV_SERVER_HOST', '0.0.0.0')
    const config = await cargarConfig()
    expect(config.server.host).toBe('0.0.0.0')
  })
})
