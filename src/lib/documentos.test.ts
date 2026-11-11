import { describe, expect, it } from 'vitest'
import type { EstadoDocumento } from '../types'
import {
  contenidoEditable,
  documentoVisibleParaRol,
  estadosVisiblesParaRol,
  ESTADOS_INTERNOS,
  puedeRedactarDocumentos,
  siguienteVersion,
  versionParaEnviar,
} from './documentos'

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

describe('siguienteVersion', () => {
  it.each([
    ['0.1', '0.2'],
    ['1.0', '1.1'],
    ['1.9', '1.10'],
    ['2', '2.1'],
  ])('%s → %s', (actual, esperada) => {
    expect(siguienteVersion(actual)).toBe(esperada)
  })
})

// L2 (AUD02-H1): la instantánea de una versión enviada no se pisa; reenviar exige versión nueva.
describe('versionParaEnviar', () => {
  const instantanea = (version: string) => ({ version }) as never

  it('sin instantáneas, se envía la versión actual', () => {
    expect(versionParaEnviar({ version: '0.1', historialVersiones: [] })).toBe('0.1')
  })

  it('si esa versión ya se envió, el reenvío sube la versión', () => {
    expect(versionParaEnviar({ version: '0.1', historialVersiones: [instantanea('0.1')] })).toBe('0.2')
  })

  it('una instantánea de OTRA versión no obliga a subirla', () => {
    expect(versionParaEnviar({ version: '0.2', historialVersiones: [instantanea('0.1')] })).toBe('0.2')
  })
})

// El contenido solo se edita donde el servidor lo acepta (espejo de guardar_documento).
describe('contenidoEditable', () => {
  const editables: EstadoDocumento[] = ['Borrador', 'En elaboración', 'En corrección', 'Rechazado']
  const congelados: EstadoDocumento[] = ['Pendiente de revisión', 'Aprobado', 'Obsoleto']

  it.each(editables)('%s se puede editar', (estado) => {
    expect(contenidoEditable({ estado, bloqueado: false })).toBe(true)
  })

  it.each(congelados)('%s está congelado', (estado) => {
    expect(contenidoEditable({ estado, bloqueado: false })).toBe(false)
  })

  it('un documento bloqueado no se edita aunque su estado lo permitiera', () => {
    expect(contenidoEditable({ estado: 'Borrador', bloqueado: true })).toBe(false)
  })
})
