// AUD06-M1 (L5e): antes de decidir un entregable se relee la BD; si cambió desde que el usuario lo abrió,
// no se decide (en la BD no hay control de versión para entregables: lo único que protege es esta guarda).
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dispatch = vi.fn()
const showToast = vi.fn()
const refrescarDatos = vi.fn()
let estado: Record<string, unknown>

vi.mock('../context/AppContext', () => ({
  useApp: () => ({ state: estado, dispatch, showToast, refrescarDatos }),
}))

const { servicioEscritura } = vi.hoisted(() => ({ servicioEscritura: { decidirEntregable: vi.fn() } }))
vi.mock('../lib/servicios', () => ({ servicioEscritura }))

import { useAccionesEntregable } from './useAccionesEntregable'
import type { Entregable } from '../types'

const ABIERTO = { id: 'e1', nombre: 'Manual', proyectoId: 'p1', tipo: 'Manual', estado: 'En revisión', documentoId: 'd1', fechaEntrega: '10/11/2026' } as Entregable

beforeEach(() => {
  vi.clearAllMocks()
  estado = { currentUser: { id: 'carlos', consultoriaId: 'c1' }, currentRole: 'Usuario Cliente', documentos: [] }
  servicioEscritura.decidirEntregable.mockResolvedValue({ ok: true, valor: undefined })
})

describe('useAccionesEntregable.decidir: relee antes de decidir', () => {
  it('si NO cambió, decide y refleja el resultado', async () => {
    refrescarDatos.mockResolvedValue({ entregables: [{ ...ABIERTO }] })

    expect(await useAccionesEntregable().decidir(ABIERTO, 'Aprobado')).toBe(true)

    expect(servicioEscritura.decidirEntregable).toHaveBeenCalledWith('e1', 'Aprobado', undefined)
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'UPDATE_ENTREGABLE', id: 'e1' }))
  })

  it.each([
    ['cambió de estado', { estado: 'Pendiente' }],
    ['le cambiaron el documento vinculado', { documentoId: 'd2' }],
  ])('si %s mientras estaba abierto, NO decide y avisa', async (_caso, cambios) => {
    refrescarDatos.mockResolvedValue({ entregables: [{ ...ABIERTO, ...cambios }] })

    expect(await useAccionesEntregable().decidir(ABIERTO, 'Aprobado')).toBe(false)

    expect(servicioEscritura.decidirEntregable).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/cambió desde que lo abriste/i), 'warning')
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('si el entregable ya no existe, NO decide y avisa', async () => {
    refrescarDatos.mockResolvedValue({ entregables: [] })

    expect(await useAccionesEntregable().decidir(ABIERTO, 'Rechazado', 'No cumple')).toBe(false)
    expect(servicioEscritura.decidirEntregable).not.toHaveBeenCalled()
  })

  it('si la relectura falla (sin red) igual intenta decidir: la BD tiene la última palabra', async () => {
    refrescarDatos.mockResolvedValue(null)

    expect(await useAccionesEntregable().decidir(ABIERTO, 'Aprobado')).toBe(true)
    expect(servicioEscritura.decidirEntregable).toHaveBeenCalled()
  })

  it('un rechazo de la BD se muestra con su mensaje y no refleja nada', async () => {
    refrescarDatos.mockResolvedValue({ entregables: [{ ...ABIERTO }] })
    servicioEscritura.decidirEntregable.mockResolvedValue({ ok: false, error: 'datos_invalidos', detalle: 'El documento vinculado todavía no está aprobado' })

    expect(await useAccionesEntregable().decidir(ABIERTO, 'Aprobado')).toBe(false)
    expect(showToast).toHaveBeenCalledWith('El documento vinculado todavía no está aprobado', 'error')
    expect(dispatch).not.toHaveBeenCalled()
  })
})
