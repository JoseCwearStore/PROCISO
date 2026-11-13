import { describe, expect, it } from 'vitest'
import { formatearDuracion, MAX_VIDEO_SEGUNDOS, motivoDuracionInvalida } from './duracion-video.ts'

// Decisión del usuario (12/11): un video se analiza como máximo con 5 minutos. Medido ese día: un video de 10 min 31 s
// completó en 99 s en una corrida y venció a los 141 s en otra (plazo de la función: 140 s), así que 10 min no es confiable.

describe('MAX_VIDEO_SEGUNDOS', () => {
  it('es de 5 minutos', () => {
    expect(MAX_VIDEO_SEGUNDOS).toBe(300)
  })
})

describe('formatearDuracion', () => {
  it.each([
    [0, '0 s'],
    [0.4, '0 s'],
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

describe('motivoDuracionInvalida', () => {
  it.each([[1], [120], [299.9], [300], [300.4]])('acepta %s s (hasta 5 min, redondeado al segundo)', (segundos) => {
    expect(motivoDuracionInvalida(segundos)).toBeNull()
  })

  it('rechaza lo que pasa de 5 minutos y dice cuánto dura y cuál es el máximo', () => {
    const motivo = motivoDuracionInvalida(300.6)
    expect(motivo).toMatch(/5 min 1 s/)
    expect(motivo).toMatch(/máximo/i)
    expect(motivo).toMatch(/5 minutos/)
  })

  it('un video de 10 min 31 s se rechaza con su duración', () => {
    expect(motivoDuracionInvalida(631)).toMatch(/10 min 31 s/)
  })

  it.each([[undefined], [null], ['120'], [NaN], [Infinity], [-Infinity], [0], [-5], [{}]])(
    'no acepta %s como duración: pide volver a intentar, sin hablar del máximo',
    (valor) => {
      const motivo = motivoDuracionInvalida(valor)
      expect(motivo).toMatch(/duración/i)
      expect(motivo).not.toMatch(/máximo/i)
    },
  )
})
