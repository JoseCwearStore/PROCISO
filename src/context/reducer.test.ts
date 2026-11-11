// AUD08-M2(c): el reducer de la app no tenía ningún test. Cubre lo que más duele si se rompe:
// que el logout NO deje datos del usuario anterior (AUD-05) y la forma de los upserts.
import { describe, expect, it, vi } from 'vitest'

// El reducer es puro: no debe arrastrar el cliente real de Supabase (que exige .env).
vi.mock('../lib/servicios', () => ({
  cargarFilasDeSesion: vi.fn(),
  llegoDesdeEnlaceDeRecuperacion: false,
  servicioArchivos: {},
  servicioAuth: {},
}))

import { estadoInicial, reducer } from './AppContext'
import type { NoConformidad, Notificacion } from '../types'

const base = estadoInicial()
const nc = (id: string, titulo = 'x') => ({ id, titulo }) as unknown as NoConformidad

describe('reducer: sesión', () => {
  it('LOGOUT vacía TODOS los datos cargados y vuelve al login', () => {
    const lleno = {
      ...base,
      currentUser: { id: 'u1', nombre: 'A', email: 'a@x', rol: 'Consultor' as const },
      empresas: [{ id: 'e' }],
      proyectos: [{ id: 'p' }],
      tareas: [{ id: 't' }],
      documentos: [{ id: 'd' }],
      usuarios: [{ id: 'u' }],
      noConformidades: [nc('n1')],
      notificaciones: [{ id: 'no' }],
      auditoria: [{ id: 'h' }],
      comentariosGlobales: [{ id: 'c' }],
      analisisIA: [{ id: 'a' }],
      datosSesion: 'listo' as const,
      currentPage: 'tareas' as const,
    } as unknown as typeof base

    const despues = reducer(lleno, { type: 'LOGOUT' })

    expect(despues.currentUser).toBeNull()
    expect(despues.authScreen).toBe('login')
    expect(despues.datosSesion).toBe('pendiente')
    expect(despues.currentPage).toBe('inicio')
    // Todas las colecciones de negocio quedan vacías: nada del usuario anterior.
    const colecciones = [
      'empresas', 'proyectos', 'tareas', 'entregables', 'procesos', 'evidencias', 'documentos',
      'usuarios', 'noConformidades', 'listasVerificacion', 'indicadores', 'comentariosGlobales',
      'criterios', 'analisisIA', 'auditoria', 'consultorias', 'notificaciones',
    ] as const
    for (const clave of colecciones) expect(despues[clave], clave).toEqual([])
  })

  it('LOGIN_SUCCESS con contraseña temporal manda a cambiarla', () => {
    const usuario = { id: 'u', nombre: 'A', email: 'a@x', rol: 'Usuario Cliente' as const, passwordTemp: true }
    const s = reducer(base, { type: 'LOGIN_SUCCESS', user: usuario })
    expect(s.authScreen).toBe('change-password')
    expect(s.loginReason).toBe('temp-password')
    expect(s.currentRole).toBe('Usuario Cliente')
  })

  it('LOGIN_SUCCESS normal entra a la app y limpia el error', () => {
    const conError = { ...base, loginAttempts: 3, loginError: 'mal' }
    const usuario = { id: 'u', nombre: 'A', email: 'a@x', rol: 'Consultor' as const }
    const s = reducer(conError, { type: 'LOGIN_SUCCESS', user: usuario })
    expect(s.authScreen).toBe('app')
    expect(s.loginAttempts).toBe(0)
    expect(s.loginError).toBeNull()
  })

  it('LOGIN_FAIL cuenta los intentos fallidos', () => {
    const s = reducer(reducer(base, { type: 'LOGIN_FAIL', error: 'e' }), { type: 'LOGIN_FAIL', error: 'e2' })
    expect(s.loginAttempts).toBe(2)
    expect(s.loginError).toBe('e2')
  })
})

describe('reducer: carga de datos', () => {
  it('DATOS_CARGADOS renombra historial como auditoria y marca la sesión lista', () => {
    const datos = {
      historial: [{ id: 'h1' }],
      empresas: [{ id: 'e1' }],
    } as unknown as Parameters<typeof reducer>[1] extends { type: 'DATOS_CARGADOS'; datos: infer D } ? D : never
    const s = reducer(base, { type: 'DATOS_CARGADOS', datos })
    expect(s.auditoria).toEqual([{ id: 'h1' }])
    expect(s.empresas).toEqual([{ id: 'e1' }])
    expect(s.datosSesion).toBe('listo')
    expect(s).not.toHaveProperty('historial')
  })

  it('DATOS_REINTENTAR vuelve a pendiente y cuenta el intento (dispara la recarga)', () => {
    const s = reducer({ ...base, datosSesion: 'error', intentoCarga: 1 }, { type: 'DATOS_REINTENTAR' })
    expect(s.datosSesion).toBe('pendiente')
    expect(s.intentoCarga).toBe(2)
  })
})

describe('reducer: upserts', () => {
  it('UPSERT_NC reemplaza la existente sin duplicarla', () => {
    const s0 = { ...base, noConformidades: [nc('a', 'viejo'), nc('b')] }
    const s = reducer(s0, { type: 'UPSERT_NC', noConformidad: nc('a', 'nuevo') })
    expect(s.noConformidades).toHaveLength(2)
    expect(s.noConformidades.find((n) => n.id === 'a')?.titulo).toBe('nuevo')
  })

  it('UPSERT_NC agrega la nueva al principio', () => {
    const s = reducer({ ...base, noConformidades: [nc('a')] }, { type: 'UPSERT_NC', noConformidad: nc('z') })
    expect(s.noConformidades.map((n) => n.id)).toEqual(['z', 'a'])
  })

  it('ADD_ANALISIS_IA no duplica el mismo análisis', () => {
    const a = { id: 'x', resumen: '1' } as never
    const b = { id: 'x', resumen: '2' } as never
    const s = reducer(reducer(base, { type: 'ADD_ANALISIS_IA', analisis: a }), { type: 'ADD_ANALISIS_IA', analisis: b })
    expect(s.analisisIA).toHaveLength(1)
    expect((s.analisisIA[0] as unknown as { resumen: string }).resumen).toBe('2')
  })

  it('MARCAR_LEIDAS marca solo las pedidas', () => {
    const n = (id: string) => ({ id, leida: false }) as unknown as Notificacion
    const s = reducer({ ...base, notificaciones: [n('1'), n('2'), n('3')] }, { type: 'MARCAR_LEIDAS', ids: ['1', '3'] })
    expect(s.notificaciones.map((x) => x.leida)).toEqual([true, false, true])
  })

  it('una acción desconocida no cambia el estado', () => {
    // @ts-expect-error acción inexistente a propósito
    expect(reducer(base, { type: 'NO_EXISTE' })).toBe(base)
  })
})
