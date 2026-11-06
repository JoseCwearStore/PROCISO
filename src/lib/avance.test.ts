import { describe, expect, it } from 'vitest'
import { avanceAl, evolucionAvance, type EntregableAvance, type TareaAvance } from './avance'

const P1 = 'p1'
const P2 = 'p2'

const tarea = (proyectoId: string, estado: TareaAvance['estado'], fechaCompletada?: string): TareaAvance =>
  ({ proyectoId, estado, fechaCompletada })
const entregable = (proyectoId: string, estado: EntregableAvance['estado'], fechaAprobacion?: string): EntregableAvance =>
  ({ proyectoId, estado, fechaAprobacion })

describe('avanceAl', () => {
  // 4 tareas (2 completadas: 10/09 y 15/10) y 2 entregables (1 aprobado el 20/10).
  const tareas = [
    tarea(P1, 'Completada', '10/09/2026'),
    tarea(P1, 'Completada', '15/10/2026'),
    tarea(P1, 'En proceso'),
    tarea(P1, 'Pendiente'),
  ]
  const entregables = [entregable(P1, 'Aprobado', '20/10/2026'), entregable(P1, 'En revisión')]

  it('usa la misma fórmula del KPI: 70 % tareas completadas + 30 % entregables aprobados', () => {
    // 0.7 · 2/4 + 0.3 · 1/2 = 35 + 15 = 50
    expect(avanceAl(tareas, entregables, '2026-11-06', '2026-11-06')).toBe(50)
  })

  it('a una fecha pasada cuenta solo lo completado o aprobado hasta ese día', () => {
    // 30/09: 1 tarea completada, ningún entregable → 0.7 · 1/4 = 17.5 → 18
    expect(avanceAl(tareas, entregables, '2026-09-30', '2026-11-06')).toBe(18)
    // 31/08: nada todavía
    expect(avanceAl(tareas, entregables, '2026-08-31', '2026-11-06')).toBe(0)
  })

  it('lo completado sin fecha cuenta solo desde hoy (el último punto coincide con el KPI)', () => {
    const sinFecha = [tarea(P1, 'Completada'), tarea(P1, 'Pendiente')]
    expect(avanceAl(sinFecha, [], '2026-10-31', '2026-11-06')).toBe(0)
    expect(avanceAl(sinFecha, [], '2026-11-06', '2026-11-06')).toBe(35)
  })

  it('un proyecto sin tareas ni entregables tiene 0 %', () => {
    expect(avanceAl([], [], '2026-11-06', '2026-11-06')).toBe(0)
  })
})

describe('evolucionAvance', () => {
  const proyectos = [{ id: P1, nombre: 'SGC Marketino' }, { id: P2, nombre: 'SGC JAZA' }]
  const tareas = [
    tarea(P1, 'Completada', '10/09/2026'),
    tarea(P1, 'Pendiente'),
    tarea(P2, 'Completada', '03/11/2026'),
    tarea(P2, 'Pendiente'),
  ]

  it('da un punto por mes, del más viejo al actual, con una serie por proyecto', () => {
    const { puntos, series } = evolucionAvance(proyectos, tareas, [], '2026-11-06', 3)

    expect(series).toEqual([{ clave: P1, nombre: 'SGC Marketino' }, { clave: P2, nombre: 'SGC JAZA' }])
    expect(puntos.map((p) => p.mes)).toEqual(['sep 26', 'oct 26', 'nov 26'])
    // Septiembre se corta el 30/09; noviembre, hoy.
    expect(puntos.map((p) => [p[P1], p[P2]])).toEqual([[35, 0], [35, 0], [35, 35]])
  })

  it('solo considera las tareas y entregables de los proyectos pedidos', () => {
    const { puntos } = evolucionAvance([proyectos[1]], tareas, [], '2026-11-06', 1)

    expect(puntos).toEqual([{ mes: 'nov 26', [P2]: 35 }])
  })
})
