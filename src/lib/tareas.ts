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
