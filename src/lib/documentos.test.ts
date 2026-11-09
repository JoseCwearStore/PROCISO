import { describe, expect, it } from 'vitest'
import type { EstadoDocumento } from '../types'
import { documentoVisibleParaRol, estadosVisiblesParaRol, ESTADOS_INTERNOS, puedeRedactarDocumentos } from './documentos'

const TODOS: EstadoDocumento[] = [
  'Borrador',
  'En elaboración',
  'Pendiente de revisión',
  'En corrección',
  'Aprobado',
  'Rechazado',
  'Obsoleto',
]

describe('documentoVisibleParaRol', () => {
  it('el cliente ve todo menos los estados internos', () => {
    const visibles = TODOS.filter((estado) => documentoVisibleParaRol({ estado }, 'Usuario Cliente'))
    expect(visibles).toEqual(['Pendiente de revisión', 'En corrección', 'Aprobado', 'Rechazado', 'Obsoleto'])
  })

  it('el cliente ve lo que tiene que aprobar', () => {
    expect(documentoVisibleParaRol({ estado: 'Pendiente de revisión' }, 'Usuario Cliente')).toBe(true)
  })

  it.each(['Admin PROCISO', 'Admin Consultoría', 'Consultor'] as const)('%s ve los 7 estados', (rol) => {
    expect(TODOS.every((estado) => documentoVisibleParaRol({ estado }, rol))).toBe(true)
  })

  it('el selector de estado del cliente no ofrece los internos; el del equipo ofrece los 7', () => {
    expect(estadosVisiblesParaRol('Usuario Cliente')).toEqual([
      'Pendiente de revisión',
      'En corrección',
      'Aprobado',
      'Rechazado',
      'Obsoleto',
    ])
    expect(estadosVisiblesParaRol('Consultor')).toEqual(TODOS)
  })

  it('redactan el equipo y el admin de la plataforma; el cliente solo lee, comenta y decide en Revisiones', () => {
    expect(puedeRedactarDocumentos('Consultor')).toBe(true)
    expect(puedeRedactarDocumentos('Admin Consultoría')).toBe(true)
    expect(puedeRedactarDocumentos('Admin PROCISO')).toBe(true)
    expect(puedeRedactarDocumentos('Usuario Cliente')).toBe(false)
  })

  it('los estados internos son Borrador y En elaboración', () => {
    expect([...ESTADOS_INTERNOS]).toEqual(['Borrador', 'En elaboración'])
  })
})
