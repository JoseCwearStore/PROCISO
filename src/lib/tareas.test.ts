import { describe, expect, it } from 'vitest'
import type { EstadoTarea, Tarea } from '../types'
import { estaVencida, fechaISO, hoyLocal, ordenarTareasDeProyecto, transicionesPermitidas } from './tareas'

const CARLOS = 'aaaaaaaa-0000-0000-0000-000000000005'
const ROBERTO = 'aaaaaaaa-0000-0000-0000-000000000003'

const tarea = (estado: EstadoTarea, fechaVencimiento = '15/09/2026'): Pick<Tarea, 'estado' | 'fechaVencimiento' | 'asignadoAId'> => ({
  estado,
  fechaVencimiento,
  asignadoAId: CARLOS,
})

describe('fechaISO', () => {
  it('convierte dd/mm/aaaa a aaaa-mm-dd y deja pasar lo que ya es ISO', () => {
    expect(fechaISO('05/09/2026')).toBe('2026-09-05')
    expect(fechaISO('2026-09-05')).toBe('2026-09-05')
  })
})

describe('hoyLocal', () => {
  it('usa la fecha LOCAL, no la UTC (a las 23:30 en México ya es mañana en UTC)', () => {
    expect(hoyLocal(new Date(2026, 10, 5, 23, 30))).toBe('2026-11-05')
  })
})

describe('estaVencida', () => {
  const HOY = '2026-09-10'

  it('una tarea abierta con la fecha límite pasada está vencida', () => {
    expect(estaVencida(tarea('En proceso', '09/09/2026'), HOY)).toBe(true)
  })

  it('el día del vencimiento todavía no está vencida', () => {
    expect(estaVencida(tarea('Pendiente', '10/09/2026'), HOY)).toBe(false)
  })

  it('una tarea completada nunca está vencida', () => {
    expect(estaVencida(tarea('Completada', '01/01/2020'), HOY)).toBe(false)
  })
})

// Espejo de cambiar_estado_tarea en la BD: sirve para no mostrar botones que el
// servidor va a rechazar. La seguridad real está en el servidor.
// O7: la pestaña Tareas de un proyecto mostraba las tareas sin orden, con las "Pendientes" ya vencidas mezcladas.
describe('ordenarTareasDeProyecto (primero lo que urge)', () => {
  type T ={ id: string; estado: EstadoTarea; fechaVencimiento?: string }
  const t = (id: string, estado: EstadoTarea, fechaVencimiento?: string): T => ({ id, estado, fechaVencimiento })
  const ids = (xs: T[]) => xs.map((x) => x.id)

  it('primero las vencidas (la más atrasada primero), luego las abiertas por fecha, al final las completadas', () => {
    const tareas = [
      t('hecha', 'Completada', '2026-10-01'),
      t('futura', 'Pendiente', '2026-12-01'),
      t('vencida-reciente', 'En proceso', '2026-11-10'),
      t('proxima', 'En revisión', '2026-11-20'),
      t('vencida-vieja', 'Pendiente', '2026-09-01'),
    ]
    expect(ids(ordenarTareasDeProyecto(tareas))).toEqual(['vencida-vieja', 'vencida-reciente', 'proxima', 'futura', 'hecha'])
  })

  it('una completada con fecha pasada NO es vencida: va con las completadas', () => {
    expect(ids(ordenarTareasDeProyecto([t('hecha', 'Completada', '2026-01-01'), t('abierta', 'Pendiente', '2026-12-01')]))).toEqual(['abierta', 'hecha'])
  })

  it('entre dos abiertas, la que vence antes va primero', () => {
    expect(ids(ordenarTareasDeProyecto([t('hoy', 'Pendiente', '2026-11-12'), t('ayer', 'Pendiente', '2026-11-11')]))).toEqual(['ayer', 'hoy'])
  })

  it('compara fechas en formato día/mes/año como fechas, no como texto', () => {
    // Como texto "15/01/2027" va antes que "20/12/2026"; como fecha va después (cruza el año).
    const tareas = [t('b', 'Pendiente', '15/01/2027'), t('a', 'Pendiente', '20/12/2026'), t('v', 'Pendiente', '05/09/2026')]
    expect(ids(ordenarTareasDeProyecto(tareas))).toEqual(['v', 'a', 'b'])
  })

  it('las completadas también van por fecha, la más antigua primero', () => {
    expect(ids(ordenarTareasDeProyecto([t('x', 'Completada', '2026-11-05'), t('y', 'Completada', '2026-10-05')]))).toEqual(['y', 'x'])
  })

  it('sin fecha de vencimiento: al final de su grupo', () => {
    const tareas = [t('sin', 'Pendiente'), t('con', 'Pendiente', '2026-12-01'), t('sin-hecha', 'Completada'), t('hecha', 'Completada', '2026-11-01')]
    expect(ids(ordenarTareasDeProyecto(tareas))).toEqual(['con', 'sin', 'hecha', 'sin-hecha'])
  })

  it('una fecha vacía cuenta como "sin fecha" (así se guarda una tarea sin vencimiento), no como la más urgente', () => {
    const tareas = [t('vacia', 'Pendiente', ''), t('con', 'Pendiente', '2026-12-01'), t('vacia-hecha', 'Completada', ''), t('hecha', 'Completada', '2026-11-01')]
    expect(ids(ordenarTareasDeProyecto(tareas))).toEqual(['con', 'vacia', 'hecha', 'vacia-hecha'])
  })

  it('con la misma fecha conserva el orden que traían (orden estable)', () => {
    const tareas = [t('1', 'Pendiente', '2026-12-01'), t('2', 'En proceso', '2026-12-01'), t('3', 'Pendiente', '2026-12-01')]
    expect(ids(ordenarTareasDeProyecto(tareas))).toEqual(['1', '2', '3'])
  })

  it('no modifica la lista original', () => {
    const tareas = [t('b', 'Pendiente', '2026-12-01'), t('a', 'Pendiente', '2026-11-20')]
    ordenarTareasDeProyecto(tareas)
    expect(ids(tareas)).toEqual(['b', 'a'])
  })

  it('sin tareas devuelve una lista vacía', () => {
    expect(ordenarTareasDeProyecto([])).toEqual([])
  })
})

describe('transicionesPermitidas', () => {
  it('el equipo puede mover la tarea a cualquier otro estado', () => {
    expect(transicionesPermitidas(tarea('En revisión'), ROBERTO, true)).toEqual([
      'Pendiente', 'En proceso', 'Requiere corrección', 'Completada',
    ])
  })

  it('el asignado avanza Pendiente → En proceso → En revisión', () => {
    expect(transicionesPermitidas(tarea('Pendiente'), CARLOS, false)).toEqual(['En proceso'])
    expect(transicionesPermitidas(tarea('En proceso'), CARLOS, false)).toEqual(['En revisión'])
  })

  it('el asignado retoma una tarea devuelta', () => {
    expect(transicionesPermitidas(tarea('Requiere corrección'), CARLOS, false)).toEqual(['En proceso'])
  })

  it('el asignado no cierra ni devuelve: eso es del equipo', () => {
    expect(transicionesPermitidas(tarea('En revisión'), CARLOS, false)).toEqual([])
    expect(transicionesPermitidas(tarea('Completada'), CARLOS, false)).toEqual([])
  })

  it('alguien que no es el asignado ni del equipo no mueve nada', () => {
    expect(transicionesPermitidas(tarea('Pendiente'), 'otro', false)).toEqual([])
  })
})
