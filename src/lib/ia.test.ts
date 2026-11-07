import { describe, expect, it } from 'vitest'
import { criteriosSugeridos, clausulasSugeridas } from './ia'
import type { CriterioEvaluacion } from '../types'

const criterio = (clausula: string, orden: number): CriterioEvaluacion => ({
  id: `c-${clausula}`, clausula, titulo: clausula, intencion: '', evidenciaEsperada: [], preguntas: [],
  senalesDeHueco: [], puedeNoAplicar: false, orden,
})

describe('clausulasSugeridas', () => {
  it('sugiere las cláusulas que corresponden al tipo de documento', () => {
    expect(clausulasSugeridas('Política')).toEqual(['5.2.1', '5.2.2'])
    expect(clausulasSugeridas('Procedimiento')).toEqual(['7.5.2', '7.5.3', '8.1'])
    expect(clausulasSugeridas('Lista de verificación')).toEqual(['9.2.1', '9.2.2'])
  })

  it('para una evidencia no adivina: el consultor elige', () => {
    expect(clausulasSugeridas(null)).toEqual([])
  })
})

describe('criteriosSugeridos', () => {
  it('convierte las cláusulas sugeridas en ids del catálogo, en el orden del catálogo', () => {
    const catalogo = [criterio('5.2.2', 8), criterio('4.1', 1), criterio('5.2.1', 7)]

    expect(criteriosSugeridos('Política', catalogo)).toEqual(['c-5.2.1', 'c-5.2.2'])
  })

  it('ignora una cláusula sugerida que el catálogo no tenga (no rompe si el Excel cambia)', () => {
    expect(criteriosSugeridos('Política', [criterio('5.2.1', 7)])).toEqual(['c-5.2.1'])
  })
})
