import type { EstadoNC, NoConformidad } from '../types'

// Reglas de NC que la pantalla necesita conocer. La SEGURIDAD vive en la BD
// (cambiar_estado_nc y guardar_tratamiento_nc); esto solo evita mostrar
// acciones que el servidor va a rechazar.

export interface AccionNC {
  estado: EstadoNC
  etiqueta: string
  requiereVerificacion?: true
}

// Espejo de cambiar_estado_nc: el tratamiento lo avanzan equipo y cliente;
// verificar la eficacia y cerrar es solo del equipo.
export function accionesNC(nc: Pick<NoConformidad, 'estado'>, esEquipo: boolean): AccionNC[] {
  switch (nc.estado) {
    case 'Abierta':
      return [{ estado: 'En análisis', etiqueta: 'Iniciar análisis' }]
    case 'En análisis':
      return [{ estado: 'En corrección', etiqueta: 'Pasar a corrección' }]
    case 'En corrección':
      return esEquipo
        ? [
            { estado: 'Verificada', etiqueta: 'Verificar: eficaz', requiereVerificacion: true },
            { estado: 'En análisis', etiqueta: 'Verificar: no eficaz', requiereVerificacion: true },
          ]
        : []
    case 'Verificada':
      return esEquipo ? [{ estado: 'Cerrada', etiqueta: 'Cerrar no conformidad' }] : []
    case 'Cerrada':
      return []
  }
}

// La acción correctiva es texto libre: cada línea no vacía es una acción.
export function lineasDeAccion(texto: string): string[] {
  return texto.split('\n').map((linea) => linea.trim()).filter(Boolean)
}

// Corrección, causa y acción se pueden editar hasta que la NC se verifica.
export function tratamientoEditable(nc: Pick<NoConformidad, 'estado'>): boolean {
  return nc.estado !== 'Verificada' && nc.estado !== 'Cerrada'
}
