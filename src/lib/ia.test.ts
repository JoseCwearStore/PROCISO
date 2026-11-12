import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { criteriosSugeridos, clausulasSugeridas, fuenteAnalizada, NOTA_CONTENIDO_NO_CONFIABLE } from './ia'
import type { CriterioEvaluacion } from '../types'

// AUD04-M1 (c), L5f: lo que sube la empresa evaluada entra al prompt de la IA y esa empresa tiene interés en que
// salga "Cubierto". La defensa técnica (nonce, datos no confiables) ya está en las Edge Functions (L4); esto le
// dice a quien lee el resultado de dónde sale lo que se analizó, para que no lo tome como un dictamen.
describe('nota sobre el contenido analizado (AUD04-M1 c)', () => {
  it('advierte que el contenido puede venir de la empresa evaluada y que busque influir en el resultado', () => {
    expect(NOTA_CONTENIDO_NO_CONFIABLE).toMatch(/empresa evaluada/i)
    expect(NOTA_CONTENIDO_NO_CONFIABLE).toMatch(/influir/i)
  })

  it('aclara que no es un dictamen y que hay que revisarla', () => {
    expect(NOTA_CONTENIDO_NO_CONFIABLE).toMatch(/no es un dictamen/i)
    expect(NOTA_CONTENIDO_NO_CONFIABLE).toMatch(/rev[ií]s/i)
  })

  it('dice qué se analizó según la fuente', () => {
    expect(fuenteAnalizada('documento')).toMatch(/documento/i)
    expect(fuenteAnalizada('evidencia')).toMatch(/evidencia/i)
    expect(fuenteAnalizada('evidencia')).not.toBe(fuenteAnalizada('documento'))
  })

  it('una evidencia se describe como un archivo cargado a la plataforma (puede venir de la empresa)', () => {
    expect(fuenteAnalizada('evidencia')).toMatch(/cargad/i)
  })

  it('el panel de preevaluación muestra la nota y la fuente de cada análisis (no queda sin cablear)', () => {
    const panel = readFileSync(resolve(__dirname, '..', 'components', 'PanelAnalisisIA.tsx'), 'utf8')
    // Se exige el USO dentro del JSX (el nombre solo en el import no alcanza).
    expect(panel).toMatch(/\{NOTA_CONTENIDO_NO_CONFIABLE\}/)
    expect(panel).toMatch(/\{fuenteAnalizada\(/)
  })
})

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
