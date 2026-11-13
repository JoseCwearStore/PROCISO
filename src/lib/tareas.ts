import type { EstadoTarea, Tarea } from '../types'

// Reglas de tareas que la pantalla necesita conocer. La SEGURIDAD vive en la BD
// (cambiar_estado_tarea); esto solo evita mostrar acciones que el servidor rechaza.

export const ESTADOS_TAREA: EstadoTarea[] = ['Pendiente', 'En proceso', 'En revisión', 'Requiere corrección', 'Completada']

// '05/09/2026' → '2026-09-05'. Si ya es ISO, la deja igual.
export function fechaISO(fecha: string): string {
  if (fecha.includes('-')) return fecha.slice(0, 10)
  const [dia, mes, anio] = fecha.split('/')
  return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
}

// La fecha del calendario de quien usa la app (no la UTC: en México, después de las
// ~18 h, toISOString() ya devuelve "mañana").
export function hoyLocal(ahora: Date = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`
}

// "Vencida" no es un estado guardado: es una tarea abierta con la fecha límite pasada.
export function estaVencida(tarea: Pick<Tarea, 'estado' | 'fechaVencimiento'>, hoy: string = hoyLocal()): boolean {
  return tarea.estado !== 'Completada' && !!tarea.fechaVencimiento && fechaISO(tarea.fechaVencimiento) < hoy
}

// El orden de la lista de tareas de un proyecto (O7): primero lo que urge. Las abiertas por fecha de vencimiento (las
// que no tienen fecha, al final) y las completadas al final de todo, también por fecha. Como una tarea vencida es una
// abierta con fecha ANTERIOR a hoy, al ordenar por fecha las vencidas salen primero y la más atrasada de todas. Con la
// misma fecha conserva el orden en que venían (el orden de Array.sort es estable). No modifica la lista original.
export function ordenarTareasDeProyecto<T extends { estado: Tarea['estado']; fechaVencimiento?: string }>(tareas: T[]): T[] {
  const grupo = (t: T) => (t.estado === 'Completada' ? 1 : 0)
  const fecha = (t: T) => (t.fechaVencimiento ? fechaISO(t.fechaVencimiento) : '9999-12-31')
  return [...tareas].sort((a, b) => grupo(a) - grupo(b) || fecha(a).localeCompare(fecha(b)))
}

// Espejo de cambiar_estado_tarea: el equipo mueve a cualquier estado; el asignado
// solo avanza su trabajo (cerrar o devolver es del equipo).
export function transicionesPermitidas(
  tarea: Pick<Tarea, 'estado' | 'asignadoAId'>,
  usuarioId: string | undefined,
  esEquipo: boolean,
): EstadoTarea[] {
  if (esEquipo) return ESTADOS_TAREA.filter((estado) => estado !== tarea.estado)
  if (!usuarioId || tarea.asignadoAId !== usuarioId) return []
  if (tarea.estado === 'Pendiente' || tarea.estado === 'Requiere corrección') return ['En proceso']
  if (tarea.estado === 'En proceso') return ['En revisión']
  return []
}
