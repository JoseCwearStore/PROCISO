import type { EntradaHistorial } from '../types'

// Los eventos que pertenecen a una empresa: los de la empresa misma, los de sus proyectos y los de lo que
// vive dentro de esos proyectos (tareas, documentos, evidencias...), que se reconocen por su proyectoId:
// el entidadId de una tarea es el de la tarea, no el del proyecto ni el de la empresa (E2).
export function historialDeEmpresa(
  entradas: EntradaHistorial[],
  empresaId: string,
  proyectoIds: string[],
): EntradaHistorial[] {
  const proyectos = new Set(proyectoIds)
  return entradas.filter((h) => {
    if (h.entidadTipo === 'empresa') return h.entidadId === empresaId
    if (h.entidadTipo === 'proyecto' && proyectos.has(h.entidadId)) return true
    return h.proyectoId !== undefined && proyectos.has(h.proyectoId)
  })
}
