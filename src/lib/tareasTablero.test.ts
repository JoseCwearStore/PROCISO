import { describe, expect, it } from 'vitest'
import type { EstadoTarea, PrioridadTarea } from '../types'
import {
  hayCambiosTarea, ordenarListaTareas, proyectosParaNuevaTarea, puedeMoverTarea, usuariosConTareas,
} from './tareas'

const HOY = '2026-11-13'
type T = { id: string; estado: EstadoTarea; prioridad: PrioridadTarea; fechaVencimiento: string }
const t = (id: string, estado: EstadoTarea, fechaVencimiento: string, prioridad: PrioridadTarea = 'Media'): T =>
  ({ id, estado, prioridad, fechaVencimiento })
const ids = (lista: T[]) => lista.map((x) => x.id)

// O26 y O27: el orden de las tarjetas de una columna y de la lista del Tablero.
describe('ordenarListaTareas', () => {
  const lista = [
    t('futura', 'Pendiente', '15/12/2026'),
    t('hecha', 'Completada', '10/09/2026'),
    t('vencida', 'Pendiente', '14/10/2026'),
    t('en-proceso', 'En proceso', '20/11/2026', 'Alta'),
    t('mas-vencida', 'En revisión', '30/09/2026', 'Baja'),
  ]

  it('por fecha: las abiertas por vencimiento (las vencidas primero) y las completadas al final (O27)', () => {
    expect(ids(ordenarListaTareas(lista, 'fechaVencimiento', HOY))).toEqual(['mas-vencida', 'vencida', 'en-proceso', 'futura', 'hecha'])
  })
  it('por prioridad: Alta, Media, Baja; con la misma prioridad conserva el orden de la lista', () => {
    expect(ids(ordenarListaTareas(lista, 'prioridad', HOY))).toEqual(['en-proceso', 'futura', 'hecha', 'vencida', 'mas-vencida'])
  })
  it('por estado: las vencidas primero, después En proceso, En revisión, Requiere corrección, Pendiente, Completada', () => {
    expect(ids(ordenarListaTareas(lista, 'estado', HOY))).toEqual(['vencida', 'mas-vencida', 'en-proceso', 'futura', 'hecha'])
  })
  it('una vencida es una abierta con la fecha anterior a hoy: una completada vieja NO cuenta como vencida', () => {
    const r = ordenarListaTareas([t('hecha', 'Completada', '01/01/2026'), t('hoy', 'Pendiente', '13/11/2026')], 'estado', HOY)
    expect(ids(r)).toEqual(['hoy', 'hecha'])
  })
  it('no modifica la lista original', () => {
    const copia = [...lista]
    ordenarListaTareas(lista, 'prioridad', HOY)
    expect(lista).toEqual(copia)
  })
})

// O28: el filtro "Usuario" solo ofrece a quien tiene tareas (elegir a otro dejaba la pantalla vacía).
describe('usuariosConTareas', () => {
  const usuarios = [
    { id: 'a', nombre: 'Ana', activo: true }, { id: 'r', nombre: 'Roberto', activo: true },
    { id: 'm', nombre: 'María', activo: true }, { id: 'i', nombre: 'Inactivo', activo: false },
  ]
  it('deja solo a quienes tienen alguna tarea, en el orden de la lista de usuarios', () => {
    expect(usuariosConTareas([{ asignadoAId: 'r' }, { asignadoAId: 'a' }, { asignadoAId: 'r' }], usuarios).map((u) => u.id)).toEqual(['a', 'r'])
  })
  it('sin tareas no ofrece a nadie', () => {
    expect(usuariosConTareas([], usuarios)).toEqual([])
  })
  it('un asignado que ya no está activo sigue apareciendo si todavía tiene tareas (se pueden filtrar)', () => {
    expect(usuariosConTareas([{ asignadoAId: 'i' }], usuarios).map((u) => u.id)).toEqual(['i'])
  })
  it('ignora a un asignado que no está en la lista de usuarios', () => {
    expect(usuariosConTareas([{ asignadoAId: 'fantasma' }], usuarios)).toEqual([])
  })
})

// O30 y O29: "Guardar cambios" solo se puede usar si algo cambió (el título también).
describe('hayCambiosTarea', () => {
  const base = { titulo: 'Redactar', descripcion: 'd', prioridad: 'Media' as PrioridadTarea, asignadoAId: 'r', fechaVencimiento: '15/09/2026', estado: 'Pendiente' as EstadoTarea }
  it('sin tocar nada no hay cambios', () => {
    expect(hayCambiosTarea({ ...base }, base)).toBe(false)
  })
  it.each([
    ['titulo', 'Otro título'], ['descripcion', 'otra'], ['prioridad', 'Alta'], ['asignadoAId', 'c'],
    ['fechaVencimiento', '16/09/2026'], ['estado', 'En proceso'],
  ] as const)('cambiar %s es un cambio', (campo, valor) => {
    expect(hayCambiosTarea({ ...base, [campo]: valor }, base)).toBe(true)
  })
  it('el título con solo espacios de más no cuenta como cambio', () => {
    expect(hayCambiosTarea({ ...base, titulo: '  Redactar  ' }, base)).toBe(false)
  })
  it('la misma fecha escrita en ISO o en dd/mm/aaaa no es un cambio', () => {
    expect(hayCambiosTarea({ ...base, fechaVencimiento: '2026-09-15' }, base)).toBe(false)
  })
})

// O31: un proyecto Finalizado no recibe tareas nuevas (la BD lo rechaza; la pantalla ni lo ofrece).
describe('proyectosParaNuevaTarea', () => {
  it('quita los proyectos Finalizados y conserva el orden', () => {
    const ps = [{ id: '1', estado: 'Finalizado' }, { id: '2', estado: 'Suspendido' }, { id: '3', estado: 'Planificación' }]
    expect(proyectosParaNuevaTarea(ps).map((p) => p.id)).toEqual(['2', '3'])
  })
})

// O32: solo se arrastra una tarjeta que esa persona puede mover.
describe('puedeMoverTarea', () => {
  it('el equipo mueve cualquier tarea', () => {
    expect(puedeMoverTarea({ estado: 'Completada', asignadoAId: 'c' }, 'r', true)).toBe(true)
  })
  it('el asignado mueve la suya mientras haya un paso que pueda dar', () => {
    expect(puedeMoverTarea({ estado: 'Pendiente', asignadoAId: 'c' }, 'c', false)).toBe(true)
  })
  it('el asignado no mueve la suya ya completada ni la que espera la revisión del equipo', () => {
    expect(puedeMoverTarea({ estado: 'Completada', asignadoAId: 'c' }, 'c', false)).toBe(false)
    expect(puedeMoverTarea({ estado: 'En revisión', asignadoAId: 'c' }, 'c', false)).toBe(false)
  })
  it('nadie mueve la tarea de otra persona si no es del equipo', () => {
    expect(puedeMoverTarea({ estado: 'Pendiente', asignadoAId: 'c' }, 'otro', false)).toBe(false)
  })
})
