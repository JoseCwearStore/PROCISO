import { describe, expect, it } from 'vitest'
import { canAccess, PAGE_PERMISSIONS } from '../config/permissions'
import { matrizDePermisos, NOMBRES_PANTALLA, PANTALLAS_SIN_FILA, ROLES_MATRIZ } from './permisosPantallas'

// AUD07-M3 (L5c, D7): la matriz de permisos que ve quien decide roles e invitaciones se escribía a
// mano y contradecía permissions.ts (decía que el cliente tiene Proyectos y Procesos, y omitía
// Revisiones, Tareas, No conformidades e Indicadores). Ahora se DERIVA de permissions.ts.
describe('matrizDePermisos', () => {
  const matriz = matrizDePermisos()
  const fila = (nombre: string) => matriz.find((f) => f.nombre === nombre)

  it('coincide con canAccess para cada pantalla y cada rol (no puede desfasarse)', () => {
    for (const f of matriz) {
      for (const rol of ROLES_MATRIZ) {
        expect(f.roles[rol], `${f.nombre} · ${rol}`).toBe(canAccess(f.id, rol))
      }
    }
  })

  it('tiene una fila por cada pantalla de permissions.ts (salvo las de detalle y alias)', () => {
    const esperadas = Object.keys(PAGE_PERMISSIONS).filter((id) => !PANTALLAS_SIN_FILA.includes(id as never))
    expect(matriz.map((f) => f.id).sort()).toEqual([...esperadas].sort())
  })

  it('toda pantalla con permisos tiene un nombre (una pantalla nueva no puede quedar fuera de la matriz)', () => {
    for (const id of Object.keys(PAGE_PERMISSIONS)) {
      if (PANTALLAS_SIN_FILA.includes(id as never)) continue
      expect(NOMBRES_PANTALLA[id as keyof typeof NOMBRES_PANTALLA], id).toBeTruthy()
    }
  })

  it('el Usuario Cliente NO tiene Proyectos ni Procesos y SÍ tiene Revisiones, Tareas, No conformidades e Indicadores', () => {
    for (const sin of ['Proyectos', 'Procesos', 'Empresas cliente', 'Usuarios y permisos', 'Configuración']) {
      expect(fila(sin)?.roles['Usuario Cliente'], sin).toBe(false)
    }
    for (const con of ['Revisiones y aprobaciones', 'Tablero de tareas', 'No conformidades', 'Indicadores e informes', 'Evidencias', 'Documentación']) {
      expect(fila(con)?.roles['Usuario Cliente'], con).toBe(true)
    }
  })

  it('el Consultor no administra usuarios ni la configuración; el Admin Consultoría sí', () => {
    expect(fila('Usuarios y permisos')?.roles).toMatchObject({ 'Consultor': false, 'Admin Consultoría': true, 'Admin PROCISO': true })
    expect(fila('Configuración')?.roles).toMatchObject({ 'Consultor': false, 'Admin Consultoría': true })
  })

  it('Evidencias la ven los cuatro roles: solo el Admin PROCISO elimina y reactiva, y necesita entrar a la pantalla', () => {
    expect(fila('Evidencias')?.roles).toEqual({
      'Admin PROCISO': true,
      'Admin Consultoría': true,
      'Consultor': true,
      'Usuario Cliente': true,
    })
  })

  it('las pantallas de todos (Inicio, Notificaciones, Ayuda) aparecen para los cuatro roles', () => {
    for (const nombre of ['Inicio', 'Notificaciones', 'Ayuda y soporte']) {
      expect(Object.values(fila(nombre)?.roles ?? {}), nombre).toEqual([true, true, true, true])
    }
  })
})
