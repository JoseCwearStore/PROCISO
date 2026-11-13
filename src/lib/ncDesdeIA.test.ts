import { describe, expect, it } from 'vitest'
import { NC_DESDE_IA, ncDesdeResultadoIA, precargaDesdeParams, puedeCrearNCDesdeResultado } from './ncDesdeIA'

const criterio = { clausula: '7.5', titulo: 'Información documentada' }
const resultado = { criterioId: 'c1', estado: 'Hueco' as const, hallazgos: 'No hay control de versiones.', sugerencias: 'Agregar un registro de cambios.' }

describe('puedeCrearNCDesdeResultado', () => {
  it('solo el equipo, y solo para Hueco o Parcial', () => {
    expect(puedeCrearNCDesdeResultado('Hueco', true)).toBe(true)
    expect(puedeCrearNCDesdeResultado('Parcial', true)).toBe(true)
    for (const e of ['Cubierto', 'No evaluable', 'No aplica'] as const) expect(puedeCrearNCDesdeResultado(e, true)).toBe(false)
  })
  it('nunca para el cliente', () => {
    expect(puedeCrearNCDesdeResultado('Hueco', false)).toBe(false)
    expect(puedeCrearNCDesdeResultado('Parcial', false)).toBe(false)
  })
})

describe('ncDesdeResultadoIA', () => {
  const fuenteDoc = { tipo: 'documento' as const, id: 'd1', proyectoId: 'p1', nombre: 'Manual de calidad' }
  const fuenteEv = { tipo: 'evidencia' as const, id: 'e1', proyectoId: 'p1', nombre: 'Acta de revisión' }

  it('precarga proyecto, cláusula, hallazgo, sugerencia y origen en la descripción', () => {
    const p = ncDesdeResultadoIA(fuenteDoc, criterio, resultado)
    expect(p.proyectoId).toBe('p1')
    expect(p.titulo).toContain('7.5')
    expect(p.descripcion).toContain('7.5 · Información documentada')
    expect(p.descripcion).toContain('Hueco')
    expect(p.descripcion).toContain('Hallazgo de la IA: No hay control de versiones.')
    expect(p.descripcion).toContain('Sugerencia de la IA: Agregar un registro de cambios.')
    expect(p.descripcion).toContain('Manual de calidad')
  })

  it('deja escrito que es una preevaluación de IA a revisar', () => {
    expect(ncDesdeResultadoIA(fuenteDoc, criterio, resultado).descripcion).toMatch(/preevaluación.*IA.*revis/i)
  })

  it('una evidencia se vincula; un documento no (solo se nombra en "detectada en")', () => {
    const ev = ncDesdeResultadoIA(fuenteEv, criterio, resultado)
    expect(ev.evidenciaId).toBe('e1')
    expect(ev.detectadaEn).toContain('Acta de revisión')
    expect(ev.detectadaEn).toContain('Preevaluación con IA')
    const doc = ncDesdeResultadoIA(fuenteDoc, criterio, resultado)
    expect(doc.evidenciaId).toBeUndefined()
    expect(doc.detectadaEn).toContain('Manual de calidad')
  })

  it('sin hallazgo o sugerencia no deja líneas vacías ni "undefined"', () => {
    const p = ncDesdeResultadoIA(fuenteDoc, criterio, { criterioId: 'c1', estado: 'Parcial' })
    expect(p.descripcion).not.toContain('undefined')
    expect(p.descripcion).not.toContain('Hallazgo')
    expect(p.descripcion).not.toContain('Sugerencia')
    expect(p.descripcion).toContain('Parcial')
  })
})

describe('precargaDesdeParams', () => {
  it('ida y vuelta por los parámetros de navegación', () => {
    const origen = ncDesdeResultadoIA({ tipo: 'evidencia', id: 'e1', proyectoId: 'p1', nombre: 'X' }, criterio, resultado)
    expect(precargaDesdeParams(origen)).toEqual(origen)
  })
  it('sin la marca de origen no hay precarga', () => {
    expect(precargaDesdeParams({})).toBeNull()
    expect(precargaDesdeParams({ id: 'abc' })).toBeNull()
    expect(precargaDesdeParams({ proyectoId: 'p1', descripcion: 'x' })).toBeNull() // proyecto sin la marca
    expect(precargaDesdeParams({ [NC_DESDE_IA]: '1' })).toBeNull() // marca sin proyecto
  })
})
