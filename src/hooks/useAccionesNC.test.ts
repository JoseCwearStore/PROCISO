// AUD08-M2(c): los hooks "única puerta de escritura" no tenían tests. useAccionesNC solo usa
// useApp(), así que se ejercita como función común con el contexto y el servicio reemplazados.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dispatch = vi.fn()
const showToast = vi.fn()
let estado: Record<string, unknown>

vi.mock('../context/AppContext', () => ({
  useApp: () => ({ state: estado, dispatch, showToast }),
}))

const { servicioEscritura } = vi.hoisted(() => ({
  servicioEscritura: {
    cambiarEstadoNC: vi.fn(),
    guardarTratamientoNC: vi.fn(),
    registrarNoConformidad: vi.fn(),
    editarNoConformidad: vi.fn(),
  },
}))
vi.mock('../lib/servicios', () => ({ servicioEscritura }))

import { useAccionesNC } from './useAccionesNC'
import { MENSAJES_ERROR_ESCRITURA } from '../lib/escrituras'
import type { NoConformidad, Rol } from '../types'

function conSesion(rol: Rol) {
  estado = {
    currentUser: { id: 'u1', consultoriaId: 'c1' },
    currentRole: rol,
    usuarios: [],
    proyectos: [],
  }
}
const nc = (estadoNC: NoConformidad['estado']) =>
  ({ id: 'nc1', estado: estadoNC, historial: [] }) as unknown as NoConformidad

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useAccionesNC: permisos por rol', () => {
  it.each<[Rol, boolean]>([
    ['Admin PROCISO', true],
    ['Admin Consultoría', true],
    ['Consultor', true],
    ['Usuario Cliente', false],
  ])('%s → esEquipo=%s', (rol, esperado) => {
    conSesion(rol)
    expect(useAccionesNC().esEquipo).toBe(esperado)
  })

  it('el cliente no puede verificar eficacia; el equipo sí (espejo de la BD)', () => {
    conSesion('Usuario Cliente')
    expect(useAccionesNC().acciones(nc('En corrección'))).toEqual([])
    conSesion('Consultor')
    expect(useAccionesNC().acciones(nc('En corrección')).length).toBe(2)
  })
})

describe('useAccionesNC.cambiarEstado: escritura pesimista', () => {
  it('si la BD rechaza, NO toca el estado local y avisa con el mensaje del error', async () => {
    conSesion('Consultor')
    servicioEscritura.cambiarEstadoNC.mockResolvedValue({ ok: false, error: 'sin_permiso' })

    const r = await useAccionesNC().cambiarEstado(nc('Abierta'), 'En análisis')

    expect(r).toBeNull()
    expect(dispatch).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith(MENSAJES_ERROR_ESCRITURA.sin_permiso, 'error')
  })

  it('si la BD acepta, refleja el nuevo estado con un evento de historial', async () => {
    conSesion('Consultor')
    servicioEscritura.cambiarEstadoNC.mockResolvedValue({ ok: true, valor: undefined })

    const r = await useAccionesNC().cambiarEstado(nc('Abierta'), 'En análisis')

    expect(servicioEscritura.cambiarEstadoNC).toHaveBeenCalledWith('nc1', 'En análisis', undefined)
    expect(r?.estado).toBe('En análisis')
    expect(r?.historial).toHaveLength(1)
    expect(dispatch).toHaveBeenCalledWith({ type: 'UPSERT_NC', noConformidad: r })
    expect(showToast).not.toHaveBeenCalled()
  })

  it('verificar desde "En corrección" fija la eficacia según el estado destino', async () => {
    conSesion('Consultor')
    servicioEscritura.cambiarEstadoNC.mockResolvedValue({ ok: true, valor: undefined })

    const eficaz = await useAccionesNC().cambiarEstado(nc('En corrección'), 'Verificada', 'Funcionó')
    const noEficaz = await useAccionesNC().cambiarEstado(nc('En corrección'), 'En análisis', 'Reincide')

    expect(eficaz?.eficacia).toBe('Eficaz')
    expect(eficaz?.verificacionEficacia).toBe('Funcionó')
    expect(noEficaz?.eficacia).toBe('No eficaz')
  })

  it('solo "Cerrada" fija fecha de cierre', async () => {
    conSesion('Consultor')
    servicioEscritura.cambiarEstadoNC.mockResolvedValue({ ok: true, valor: undefined })

    const cerrada = await useAccionesNC().cambiarEstado(nc('Verificada'), 'Cerrada')
    const otra = await useAccionesNC().cambiarEstado(nc('Abierta'), 'En análisis')

    expect(cerrada?.fechaCierre).toBeTruthy()
    expect(otra?.fechaCierre).toBeUndefined()
  })
})
