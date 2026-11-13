// ¿El documento que se ve tiene cambios que todavía no se guardaron? (O17) La preevaluación con IA lee el documento
// desde la BD: analiza la última versión GUARDADA, no lo que la persona está escribiendo. El editor escribe directo
// al estado, así que para poder avisar se compara el contenido de ahora con una "firma" del contenido guardado.

import type { SeccionDocumento } from '../types'

export const AVISO_CAMBIOS_SIN_GUARDAR =
  'Tienes cambios sin guardar. La preevaluación con IA analiza la última versión guardada, no lo que ves ahora: ' +
  'guarda el borrador antes de analizar si quieres que los incluya.'

// Resume lo que la IA analiza (las secciones, en orden, con su título, tipo, texto y filas). No incluye lo que no
// cambia el análisis (fechas de modificación, comentarios, historial, ni el id interno de cada sección). Es un texto:
// dos contenidos iguales dan la misma firma.
export function firmaDeContenido(secciones: SeccionDocumento[] | undefined): string {
  return JSON.stringify((secciones ?? []).map((s) => [s.titulo, s.tipo, s.contenido, s.filas ?? null]))
}

// Sin saber qué se guardó (documento que no se abrió desde acá) no se inventa una alarma.
export function hayCambiosSinGuardar(firmaGuardada: string | undefined, firmaActual: string): boolean {
  return firmaGuardada !== undefined && firmaGuardada !== firmaActual
}
