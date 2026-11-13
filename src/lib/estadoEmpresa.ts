// Estado de una empresa tal como se muestra. Una sola fuente para la lista y la ficha.
export function etiquetaEstadoEmpresa(activa: boolean): 'Activa' | 'Archivada' {
  return activa ? 'Activa' : 'Archivada'
}
