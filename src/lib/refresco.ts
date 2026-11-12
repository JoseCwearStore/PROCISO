// Refresco de los datos de la sesión (AUD06-M1, L5e). La app cargaba todo UNA vez al iniciar sesión: con
// una sesión larga el usuario veía (y podía aprobar) una copia desactualizada. Ahora se relee al volver
// a la pestaña y justo antes de decidir.

import type { Documento, Entregable } from '../types'

// Mínimo entre dos lecturas: volver a la pestaña varias veces seguidas no repite la carga completa.
export const MINIMO_ENTRE_LECTURAS_MS = 60_000

// ¿Toca releer? `ultimaLecturaMs` es null mientras no hubo una primera carga (la hace la carga inicial).
export function debeRefrescar(ultimaLecturaMs: number | null, ahoraMs: number, minimoMs = MINIMO_ENTRE_LECTURAS_MS): boolean {
  if (ultimaLecturaMs === null) return false
  return ahoraMs - ultimaLecturaMs >= minimoMs
}

// Lo que el usuario tiene abierto (`antes`) contra lo que hay ahora (`despues`). Si ya no existe, cambió.
export function documentoCambio(antes: Documento, despues: Documento | undefined): boolean {
  if (!despues) return true
  return antes.version !== despues.version || antes.estado !== despues.estado || antes.fechaModificacion !== despues.fechaModificacion
}

export function entregableCambio(antes: Entregable, despues: Entregable | undefined): boolean {
  if (!despues) return true
  return antes.estado !== despues.estado || antes.documentoId !== despues.documentoId || antes.fechaEntrega !== despues.fechaEntrega
}
