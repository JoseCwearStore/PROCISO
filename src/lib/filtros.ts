// ¿Hay algún filtro puesto en una pantalla de listado? (O12) Sirve para decidir si se ofrece "Limpiar filtros" cuando
// no hay resultados: sin filtros, que no haya resultados es que todavía no hay nada, y limpiar no cambiaría nada.
// Un valor vacío es "sin filtro"; un texto en blanco ("   ") sí filtra, porque las pantallas buscan con includes.
export function hayFiltrosActivos(filtros: Record<string, string>): boolean {
  return Object.values(filtros).some((valor) => valor !== '')
}
