import { describe, expect, it } from 'vitest'
import { errorDeValorObservado } from './indicadores'

// O36: el formulario de indicadores guardaba cualquier texto en "Valor observado" ("abc %").
describe('errorDeValorObservado', () => {
  it.each(['', '   ', '88', '0', '100', '12.5', '12,5', '-3', '-0,5', ' 94 '])('"%s" es válido (vacío = sin datos)', (valor) => {
    expect(errorDeValorObservado(valor)).toBeNull()
  })

  it.each(['abc', '88%', '12.5.3', '1,2,3', '--3', '3-', '1e3', '12 34', 'N/A', '.5', '5.'])('"%s" no es un número', (valor) => {
    expect(errorDeValorObservado(valor)).toBe('El valor observado debe ser un número (con punto o coma para los decimales) o quedar vacío')
  })
})
