import { describe, expect, it } from 'vitest'
import { etiquetaDeEstado, tituloDeEstado } from './estados'

// O6: el distintivo decía "Análisis" mientras el selector decía "Análisis de procesos". "Análisis" a secas, además,
// se confunde con "En análisis" (estado de una no conformidad).
describe('etiquetaDeEstado (el texto del distintivo de un estado)', () => {
  it('"Análisis de procesos" se muestra completo, como en el selector', () => {
    expect(etiquetaDeEstado('Análisis de procesos')).toBe('Análisis de procesos')
  })

  it('abrevia solo estas, que son largas (y su nombre completo queda en el título)', () => {
    expect(etiquetaDeEstado('Recopilación de información')).toBe('Recopilación')
    expect(etiquetaDeEstado('Elaboración documental')).toBe('Elaboración doc.')
    expect(etiquetaDeEstado('Requiere corrección')).toBe('Req. corrección')
    expect(etiquetaDeEstado('Pendiente de revisión')).toBe('Pend. revisión')
  })

  it('cualquier otro estado se muestra tal cual, también uno desconocido', () => {
    for (const s of ['Planificación', 'Finalizado', 'En análisis', 'Aprobado', 'Algo nuevo', '']) expect(etiquetaDeEstado(s), s).toBe(s)
  })
})

describe('tituloDeEstado (el nombre completo al pasar el cursor, solo si se abrevió)', () => {
  it('un estado abreviado trae su nombre completo', () => {
    expect(tituloDeEstado('Recopilación de información')).toBe('Recopilación de información')
    expect(tituloDeEstado('Pendiente de revisión')).toBe('Pendiente de revisión')
  })

  it('uno que se muestra completo no repite el título', () => {
    expect(tituloDeEstado('Análisis de procesos')).toBeUndefined()
    expect(tituloDeEstado('Aprobado')).toBeUndefined()
    expect(tituloDeEstado('Algo nuevo')).toBeUndefined()
  })
})
