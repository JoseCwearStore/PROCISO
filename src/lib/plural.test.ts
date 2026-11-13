import { describe, expect, it } from 'vitest'
import { conCantidad } from './plural'

// O33: la tarjeta de una lista de verificación decía "1 hallazgos" y "1 preguntas".
describe('conCantidad', () => {
  it('con uno usa el singular', () => {
    expect(conCantidad(1, 'hallazgo', 'hallazgos')).toBe('1 hallazgo')
  })
  it('con cero usa el plural (cero hallazgos)', () => {
    expect(conCantidad(0, 'hallazgo', 'hallazgos')).toBe('0 hallazgos')
  })
  it('con más de uno usa el plural', () => {
    expect(conCantidad(5, 'pregunta', 'preguntas')).toBe('5 preguntas')
  })
  it('no confunde 1 con 10 ni con 11', () => {
    expect(conCantidad(10, 'pregunta', 'preguntas')).toBe('10 preguntas')
    expect(conCantidad(11, 'pregunta', 'preguntas')).toBe('11 preguntas')
  })
})
