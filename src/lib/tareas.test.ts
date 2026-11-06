import { describe, expect, it } from 'vitest'
import type { EstadoTarea, Tarea } from '../types'
import { estaVencida, fechaISO, hoyLocal, transicionesPermitidas } from './tareas'

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
