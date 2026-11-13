import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  esperarDuracion, estadoDuracionVideo, formatearDuracion, MAX_VIDEO_SEGUNDOS, motivoSubidaVideo, RECOMENDADO_VIDEO_SEGUNDOS,
} from './duracionVideo'

// Espejo de supabase/functions/_compartido/duracion-video.ts (la regla la aplica el servidor; esto es solo UX).
// Decisión del usuario (13/11, cambió la del 12/11): tope de 10 minutos por video y 5 minutos RECOMENDADOS; a partir de ahí
// puede aparecer el aviso de tiempo excedido.

describe('MAX_VIDEO_SEGUNDOS y RECOMENDADO_VIDEO_SEGUNDOS', () => {
  it('el tope es de 10 minutos, igual que en el servidor', () => {
    expect(MAX_VIDEO_SEGUNDOS).toBe(600)
  })

  it('lo recomendado es de 5 minutos', () => {
    expect(RECOMENDADO_VIDEO_SEGUNDOS).toBe(300)
  })
})

describe('formatearDuracion', () => {
  it.each([
    [0, '0 s'],
    [45, '45 s'],
    [60, '1 min'],
    [59.6, '1 min'],
    [90, '1 min 30 s'],
    [300, '5 min'],
    [301, '5 min 1 s'],
    [631.3, '10 min 31 s'],
  ])('%s s se lee "%s"', (segundos, texto) => {
    expect(formatearDuracion(segundos)).toBe(texto)
  })
})

describe('estadoDuracionVideo (el botón "Analizar video")', () => {
  it('mientras el reproductor no leyó la duración, espera: no habilita ni acusa', () => {
    for (const aun of [null, undefined]) {
      expect(estadoDuracionVideo(aun)).toEqual({ permitido: false, leyendo: true, motivo: null, advertencia: null })
    }
  })

  it.each([[1], [120], [299.9], [300], [300.4]])('con %s s (hasta 5 min, lo recomendado) permite analizar sin avisos', (segundos) => {
    expect(estadoDuracionVideo(segundos)).toEqual({ permitido: true, leyendo: false, motivo: null, advertencia: null })
  })

  it.each([[301], [420], [600], [600.4]])('con %s s (entre 5 y 10 min) permite analizar pero advierte del tiempo excedido', (segundos) => {
    const estado = estadoDuracionVideo(segundos)
    expect(estado.permitido).toBe(true)
    expect(estado.leyendo).toBe(false)
    expect(estado.motivo).toBeNull()
    expect(estado.advertencia).toMatch(/5 minutos recomendados/)
    expect(estado.advertencia).toMatch(/tiempo de espera/i)
    expect(estado.advertencia).toMatch(/reintent/i)
  })

  it('la advertencia dice cuánto dura el video', () => {
    expect(estadoDuracionVideo(430)?.advertencia).toContain('7 min 10 s')
  })

  it('pasado de 10 minutos bloquea y dice cuánto dura y cuál es el máximo', () => {
    const estado = estadoDuracionVideo(631)
    expect(estado.permitido).toBe(false)
    expect(estado.leyendo).toBe(false)
    expect(estado.motivo).toMatch(/10 min 31 s/)
    expect(estado.motivo).toMatch(/máximo/i)
    expect(estado.motivo).toMatch(/10 minutos/)
    expect(estado.advertencia).toBeNull()
  })

  it('justo en el borde: 600,6 s ya no entra (redondea a 601)', () => {
    expect(estadoDuracionVideo(600.6).permitido).toBe(false)
  })

  it.each([[NaN], [Infinity], [0], [-4]])('si la duración es inválida (%s) bloquea y lo explica sin hablar del máximo', (valor) => {
    const estado = estadoDuracionVideo(valor)
    expect(estado.permitido).toBe(false)
    expect(estado.leyendo).toBe(false)
    expect(estado.motivo).toMatch(/duración/i)
    expect(estado.motivo).not.toMatch(/máximo/i)
    expect(estado.advertencia).toBeNull()
  })
})

describe('motivoSubidaVideo (al elegir el archivo en "Capturar evidencia")', () => {
  it('bloquea un video de más de 10 minutos con su duración', () => {
    const motivo = motivoSubidaVideo(780)
    expect(motivo).toMatch(/13 min/)
    expect(motivo).toMatch(/10 minutos/)
  })

  it.each([[1], [300], [480], [600], [600.4]])('deja subir %s s (el aviso de más de 5 min se da al analizar, no al subir)', (segundos) => {
    expect(motivoSubidaVideo(segundos)).toBeNull()
  })

  it.each([[null], [undefined], [NaN], [Infinity], [0]])(
    'si no se pudo leer la duración (%s) NO bloquea la subida: el análisis la volverá a pedir',
    (valor) => {
      expect(motivoSubidaVideo(valor)).toBeNull()
    },
  )
})

// Un reproductor falso: un EventTarget con duration y currentTime, como el <video> del navegador.
class ReproductorFalso extends EventTarget {
  duration = NaN
  currentTime = 0
}

describe('esperarDuracion (lee la duración de un <video>)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('si ya la conoce, la devuelve enseguida', async () => {
    const v = new ReproductorFalso()
    v.duration = 120.5
    await expect(esperarDuracion(v)).resolves.toBe(120.5)
  })

  it('si todavía no la conoce, espera a loadedmetadata', async () => {
    const v = new ReproductorFalso()
    const pedida = esperarDuracion(v)
    v.duration = 75
    v.dispatchEvent(new Event('loadedmetadata'))
    await expect(pedida).resolves.toBe(75)
  })

  it('si el archivo no trae duración (Infinity), fuerza el cálculo saltando al final y vuelve a 0', async () => {
    const v = new ReproductorFalso()
    v.duration = Infinity
    const pedida = esperarDuracion(v)
    v.dispatchEvent(new Event('loadedmetadata'))
    expect(v.currentTime).toBeGreaterThan(1e6)
    v.duration = 42
    v.dispatchEvent(new Event('durationchange'))
    await expect(pedida).resolves.toBe(42)
    expect(v.currentTime).toBe(0)
  })

  it('si el reproductor falla, devuelve null', async () => {
    const v = new ReproductorFalso()
    const pedida = esperarDuracion(v)
    v.dispatchEvent(new Event('error'))
    await expect(pedida).resolves.toBeNull()
  })

  it('si no llega a tiempo, devuelve null en vez de colgarse', async () => {
    const v = new ReproductorFalso()
    const pedida = esperarDuracion(v, 8000)
    await vi.advanceTimersByTimeAsync(8000)
    await expect(pedida).resolves.toBeNull()
  })

  it('una duración 0 no vale: sigue esperando', async () => {
    const v = new ReproductorFalso()
    const pedida = esperarDuracion(v, 8000)
    v.duration = 0
    v.dispatchEvent(new Event('loadedmetadata'))
    v.duration = 33
    v.dispatchEvent(new Event('durationchange'))
    await expect(pedida).resolves.toBe(33)
  })

  it('después de resolver deja de escuchar (no acumula oyentes)', async () => {
    const v = new ReproductorFalso()
    const quitados: string[] = []
    const original = v.removeEventListener.bind(v)
    v.removeEventListener = ((tipo: string, ...resto: unknown[]) => {
      quitados.push(tipo)
      return (original as (...a: unknown[]) => void)(tipo, ...resto)
    }) as typeof v.removeEventListener
    const pedida = esperarDuracion(v)
    v.duration = 10
    v.dispatchEvent(new Event('loadedmetadata'))
    await pedida
    expect(quitados).toEqual(expect.arrayContaining(['loadedmetadata', 'durationchange', 'error']))
  })
})
