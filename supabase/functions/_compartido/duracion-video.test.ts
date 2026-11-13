import { describe, expect, it } from 'vitest'
import { formatearDuracion, MAX_VIDEO_SEGUNDOS, motivoDuracionInvalida, RECOMENDADO_VIDEO_SEGUNDOS } from './duracion-video.ts'

// Decisión del usuario (13/11, cambió la del 12/11): tope de 10 minutos por video, con 5 minutos RECOMENDADOS. Medido: un video
// de 10 min 31 s tardó 57, 84, 99 y 120 s, y venció a los 140 s en otras corridas (plazo de la función): a 10 minutos el aviso
// de tiempo excedido puede aparecer, por eso la recomendación es de 5.

describe('MAX_VIDEO_SEGUNDOS', () => {
  it('es de 10 minutos', () => {
    expect(MAX_VIDEO_SEGUNDOS).toBe(600)
  })

  it('el que se recomienda es la mitad: 5 minutos', () => {
    expect(RECOMENDADO_VIDEO_SEGUNDOS).toBe(300)
    expect(RECOMENDADO_VIDEO_SEGUNDOS * 2).toBe(MAX_VIDEO_SEGUNDOS)
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
  it.each([[1], [120], [300], [301], [599.9], [600], [600.4]])('acepta %s s (hasta 10 min, redondeado al segundo; lo que pasa de 5 min solo se recomienda evitar)', (segundos) => {
    expect(motivoDuracionInvalida(segundos)).toBeNull()
  })

  it('rechaza lo que pasa de 10 minutos y dice cuánto dura y cuál es el máximo', () => {
    const motivo = motivoDuracionInvalida(600.6)
    expect(motivo).toMatch(/10 min 1 s/)
    expect(motivo).toMatch(/máximo/i)
    expect(motivo).toMatch(/10 minutos/)
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
