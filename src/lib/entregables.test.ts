import { describe, expect, it } from 'vitest'
import type { Documento, Entregable } from '../types'
import { accionesEntregable, documentoListo } from './entregables'

const P1 = 'p1'
const doc = (id: string, estado: Documento['estado'], codigo?: string, proyectoId = P1) =>
  ({ id, estado, codigo, proyectoId }) as Documento
const ent = (estado: Entregable['estado'], documentoId?: string) => ({ estado, documentoId, proyectoId: P1 }) as Entregable

// Espejo de decidir_entregable: sirve para no ofrecer "Aprobar" cuando el servidor lo va a rechazar.
describe('documentoListo', () => {
  it('sin documento vinculado, no hay nada que esperar', () => {
    expect(documentoListo(ent('En revisión'), [])).toBe(true)
  })

  it('con el documento vinculado aprobado, está listo', () => {
    expect(documentoListo(ent('En revisión', 'd1'), [doc('d1', 'Aprobado', 'PRO-1')])).toBe(true)
  })

  it('con el documento en revisión, no está listo', () => {
    expect(documentoListo(ent('En revisión', 'd1'), [doc('d1', 'Pendiente de revisión', 'PRO-1')])).toBe(false)
  })

  it('si se aprobó una versión posterior (mismo código, mismo proyecto), está listo', () => {
    expect(documentoListo(ent('En revisión', 'd1'), [doc('d1', 'Obsoleto', 'PRO-1'), doc('d2', 'Aprobado', 'PRO-1')])).toBe(true)
  })

  it('una versión aprobada con el mismo código pero de OTRO proyecto no cuenta', () => {
    expect(documentoListo(ent('En revisión', 'd1'), [doc('d1', 'Obsoleto', 'PRO-1'), doc('d9', 'Aprobado', 'PRO-1', 'p2')])).toBe(false)
  })
})

describe('accionesEntregable', () => {
  it('el equipo entrega lo pendiente o lo rechazado; no aprueba', () => {
    expect(accionesEntregable(ent('Pendiente'), true)).toEqual(['En revisión'])
    expect(accionesEntregable(ent('Rechazado'), true)).toEqual(['En revisión'])
    expect(accionesEntregable(ent('En revisión'), true)).toEqual([])
  })

  it('el cliente aprueba o rechaza lo que está en revisión; no entrega', () => {
    expect(accionesEntregable(ent('En revisión'), false)).toEqual(['Aprobado', 'Rechazado'])
    expect(accionesEntregable(ent('Pendiente'), false)).toEqual([])
    expect(accionesEntregable(ent('Aprobado'), false)).toEqual([])
  })
})
