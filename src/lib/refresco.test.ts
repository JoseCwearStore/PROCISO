import { describe, expect, it } from 'vitest'
import { debeRefrescar, documentoCambio, entregableCambio, MINIMO_ENTRE_LECTURAS_MS } from './refresco'
import type { Documento, Entregable } from '../types'

// AUD06-M1 (L5e): la app carga los datos UNA vez al iniciar sesión. El cliente podía aprobar un documento
// o un entregable que ya había cambiado, sin enterarse. Ahora se relee al volver a la pestaña (con un
// mínimo entre lecturas) y justo antes de decidir.
describe('debeRefrescar', () => {
  const T0 = 1_000_000

  it('refresca cuando pasó el mínimo desde la última lectura', () => {
    expect(debeRefrescar(T0, T0 + MINIMO_ENTRE_LECTURAS_MS)).toBe(true)
    expect(debeRefrescar(T0, T0 + MINIMO_ENTRE_LECTURAS_MS * 10)).toBe(true)
  })

  it('no refresca si la última lectura es reciente (volver a la pestaña dos veces seguidas no repite la carga)', () => {
    expect(debeRefrescar(T0, T0 + MINIMO_ENTRE_LECTURAS_MS - 1)).toBe(false)
    expect(debeRefrescar(T0, T0)).toBe(false)
  })

  it('si nunca se leyó (todavía cargando o sin sesión) no refresca: lo hace la carga inicial', () => {
    expect(debeRefrescar(null, T0)).toBe(false)
  })

  it('un reloj que retrocede no dispara lecturas en bucle', () => {
    expect(debeRefrescar(T0, T0 - 5_000)).toBe(false)
  })

  it('el mínimo es de un minuto', () => {
    expect(MINIMO_ENTRE_LECTURAS_MS).toBe(60_000)
  })
})

const DOC = { id: 'd1', version: '1.1', estado: 'Pendiente de revisión', fechaModificacion: '10/11/2026' } as unknown as Documento
const ENT = { id: 'e1', estado: 'En revisión', documentoId: 'd1', fechaEntrega: '10/11/2026' } as unknown as Entregable

describe('documentoCambio (lo que el usuario abrió vs lo que hay ahora)', () => {
  it('no hay cambio si es la misma versión y el mismo estado', () => {
    expect(documentoCambio(DOC, { ...DOC })).toBe(false)
  })

  it.each([
    ['otra versión', { version: '1.2' }],
    ['otro estado (lo retiraron de revisión)', { estado: 'Borrador' }],
    ['otra fecha de modificación', { fechaModificacion: '11/11/2026' }],
  ])('hay cambio si hay %s', (_caso, cambios) => {
    expect(documentoCambio(DOC, { ...DOC, ...cambios } as Documento)).toBe(true)
  })

  it('hay cambio si el documento ya no existe (lo borraron o dejó de ser visible)', () => {
    expect(documentoCambio(DOC, undefined)).toBe(true)
  })
})

describe('entregableCambio', () => {
  it('no hay cambio si estado, documento y fecha son los mismos', () => {
    expect(entregableCambio(ENT, { ...ENT })).toBe(false)
  })

  it.each([
    ['otro estado', { estado: 'Aprobado' }],
    ['otro documento vinculado', { documentoId: 'd2' }],
    ['otra fecha de entrega', { fechaEntrega: '20/11/2026' }],
  ])('hay cambio si hay %s', (_caso, cambios) => {
    expect(entregableCambio(ENT, { ...ENT, ...cambios } as Entregable)).toBe(true)
  })

  it('hay cambio si el entregable ya no existe', () => {
    expect(entregableCambio(ENT, undefined)).toBe(true)
  })
})
