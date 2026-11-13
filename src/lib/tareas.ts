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

// ─── Tablero de tareas (O26–O32) ─────────────────────────────────────────────

export type CriterioLista = 'fechaVencimiento' | 'prioridad' | 'estado'

const ORDEN_PRIORIDAD: Record<Tarea['prioridad'], number> = { Alta: 0, Media: 1, Baja: 2 }
const ORDEN_ESTADO: Record<EstadoTarea, number> = {
  'En proceso': 1, 'En revisión': 2, 'Requiere corrección': 3, Pendiente: 4, Completada: 5,
}

// El orden de la lista del Tablero y de las tarjetas de cada columna del Kanban (O26, O27).
// · fecha: primero lo que urge (las vencidas, y la más atrasada de todas, arriba) y las completadas al final.
// · prioridad: Alta, Media, Baja.
// · estado: las vencidas primero y después el avance del trabajo.
// Lo que empata conserva el orden en que venía (el sort es estable). No modifica la lista original.
export function ordenarListaTareas<T extends Pick<Tarea, 'estado' | 'prioridad' | 'fechaVencimiento'>>(
  tareas: T[],
  criterio: CriterioLista,
  hoy: string = hoyLocal(),
): T[] {
  if (criterio === 'fechaVencimiento') return ordenarTareasDeProyecto(tareas)
  const rango = criterio === 'prioridad'
    ? (t: T) => ORDEN_PRIORIDAD[t.prioridad]
    : (t: T) => (estaVencida(t, hoy) ? 0 : ORDEN_ESTADO[t.estado])
  return [...tareas].sort((a, b) => rango(a) - rango(b))
}

// El filtro "Usuario": solo quienes tienen alguna tarea (elegir a otro dejaba la pantalla vacía), en el orden de la
// lista de usuarios. Un asignado que ya no está activo sigue apareciendo mientras conserve tareas.
export function usuariosConTareas<U extends { id: string }>(tareas: Pick<Tarea, 'asignadoAId'>[], usuarios: U[]): U[] {
  const asignados = new Set(tareas.map((t) => t.asignadoAId))
  return usuarios.filter((u) => asignados.has(u.id))
}

// ¿Cambió algo respecto de la tarea tal como se abrió? "Guardar cambios" solo se habilita si sí (O30).
type CamposEditables = Pick<Tarea, 'titulo' | 'descripcion' | 'prioridad' | 'asignadoAId' | 'fechaVencimiento' | 'estado'>
export function hayCambiosTarea(editada: CamposEditables, original: CamposEditables): boolean {
  return (
    editada.titulo.trim() !== original.titulo.trim() ||
    editada.descripcion !== original.descripcion ||
    editada.prioridad !== original.prioridad ||
    editada.asignadoAId !== original.asignadoAId ||
    fechaISO(editada.fechaVencimiento) !== fechaISO(original.fechaVencimiento) ||
    editada.estado !== original.estado
  )
}

// Espejo de validar_tarea (O31): a un proyecto Finalizado no se le agregan tareas.
export function proyectosParaNuevaTarea<P extends { estado: string }>(proyectos: P[]): P[] {
  return proyectos.filter((p) => p.estado !== 'Finalizado')
}

// ¿Se puede arrastrar esta tarjeta? Solo si esa persona tiene un estado al que moverla (O32): al cliente no se le
// ofrece arrastrar su tarea ya completada ni la que espera la revisión del equipo.
export function puedeMoverTarea(tarea: Pick<Tarea, 'estado' | 'asignadoAId'>, usuarioId: string | undefined, esEquipo: boolean): boolean {
  return transicionesPermitidas(tarea, usuarioId, esEquipo).length > 0
}
