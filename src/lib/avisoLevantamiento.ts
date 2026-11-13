// Aviso rojo "Completa los campos obligatorios" del asistente de Levantamiento (E6).
// El aviso recuerda a qué paso pertenece y solo se muestra en ese paso: antes era una lista suelta
// que seguía a la vista al cambiar de paso, también en pasos donde no corresponde.

export interface AvisoPaso {
  paso: number
  faltantes: string[]
}

export function avisoDelPaso(paso: number, faltantes: string[]): AvisoPaso | null {
  return faltantes.length > 0 ? { paso, faltantes } : null
}

export function faltantesVisibles(aviso: AvisoPaso | null, pasoActual: number): string[] {
  return aviso && aviso.paso === pasoActual ? aviso.faltantes : []
}
