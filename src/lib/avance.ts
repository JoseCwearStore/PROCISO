import type { Entregable, Tarea } from '../types'
import { fechaISO } from './tareas'

export type TareaAvance = Pick<Tarea, 'proyectoId' | 'estado' | 'fechaCompletada'>
export type EntregableAvance = Pick<Entregable, 'proyectoId' | 'estado' | 'fechaAprobacion'>

// ¿Estaba terminado al corte? Con fecha, si es de ese día o antes. Sin fecha
// (datos viejos), solo desde hoy: así el último punto coincide con el KPI.
function terminadoAl(terminado: boolean, fecha: string | undefined, corte: string, hoy: string): boolean {
  if (!terminado) return false
  return fecha ? fechaISO(fecha) <= corte : corte >= hoy
}

// El avance de un proyecto: 70 % tareas completadas + 30 % entregables aprobados, mirando solo lo que estaba
// terminado a la fecha de corte. Si falta una de las dos partes (O4), su peso se reparte en la que sí hay: un proyecto
// sin tareas y con todos sus entregables aprobados está al 100 %, no al 30 % (el 70 % de las tareas contaba como 0
// aunque no hubiera tareas). Sin ninguna de las dos, 0 %.
// Aproximación: el total es el de hoy (una tarea creada después cuenta como pendiente antes).
export function avanceAl(tareas: TareaAvance[], entregables: EntregableAvance[], corte: string, hoy: string): number {
  if (tareas.length === 0 && entregables.length === 0) return 0
  const completadas = tareas.filter((t) => terminadoAl(t.estado === 'Completada', t.fechaCompletada, corte, hoy)).length
  const aprobados = entregables.filter((e) => terminadoAl(e.estado === 'Aprobado', e.fechaAprobacion, corte, hoy)).length
  if (entregables.length === 0) return Math.round((completadas / tareas.length) * 100)
  if (tareas.length === 0) return Math.round((aprobados / entregables.length) * 100)
  return Math.round(0.7 * (completadas / tareas.length) * 100 + 0.3 * (aprobados / entregables.length) * 100)
}

// Propias y no de Intl: las abreviaturas de Intl cambian según la versión de ICU ("sep"/"sept").
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const dos = (n: number) => String(n).padStart(2, '0')

export interface PuntoEvolucion {
  mes: string
  [proyectoId: string]: string | number
}

// Un punto por mes (cortado al último día; el mes actual, hoy) y una serie por
// proyecto. La clave de cada serie es el id del proyecto: un nombre con puntos
// ("S.A.") se leería como una ruta anidada en el gráfico.
export function evolucionAvance(
  proyectos: { id: string; nombre: string }[],
  tareas: TareaAvance[],
  entregables: EntregableAvance[],
  hoy: string,
  meses = 6,
): { puntos: PuntoEvolucion[]; series: { clave: string; nombre: string }[] } {
  const [anioHoy, mesHoy] = hoy.split('-').map(Number)
  const puntos: PuntoEvolucion[] = []

  for (let i = meses - 1; i >= 0; i--) {
    const base = new Date(Date.UTC(anioHoy, mesHoy - 1 - i, 1))
    const anio = base.getUTCFullYear()
    const mes = base.getUTCMonth() // 0-11
    const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate()
    const corte = i === 0 ? hoy : `${anio}-${dos(mes + 1)}-${dos(ultimoDia)}`

    const punto: PuntoEvolucion = { mes: `${MESES[mes]} ${String(anio).slice(2)}` }
    for (const p of proyectos) {
      punto[p.id] = avanceAl(
        tareas.filter((t) => t.proyectoId === p.id),
        entregables.filter((e) => e.proyectoId === p.id),
        corte,
        hoy,
      )
    }
    puntos.push(punto)
  }

  return { puntos, series: proyectos.map((p) => ({ clave: p.id, nombre: p.nombre })) }
}
