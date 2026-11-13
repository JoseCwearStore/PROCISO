import type { Usuario } from '../types'

export interface OpcionResponsable {
  id: string
  etiqueta: string
}

type UsuarioMinimo = Pick<Usuario, 'id' | 'nombre' | 'rol' | 'empresaId' | 'activo'>

// Quién se ofrece como responsable de un proceso: el equipo del proyecto y los usuarios
// cliente activos de su empresa (el responsable de un proceso suele ser alguien de la
// empresa, no de la consultoría). Sin repetidos, y el responsable ACTUAL siempre aparece
// aunque ya no cumpla las reglas: si no, el selector mostraría "Selecciona" y al guardar
// se perdería sin avisar (caso de un proceso a medias con un cliente como responsable).
export function opcionesDeResponsable(
  proyecto: { empresaId: string; equipoIds: string[] } | undefined,
  responsableActualId: string,
  usuarios: UsuarioMinimo[],
): OpcionResponsable[] {
  const porId = new Map(usuarios.map((u) => [u.id, u]))
  const ids: string[] = []
  const agregar = (id: string) => {
    if (porId.has(id) && !ids.includes(id)) ids.push(id)
  }
  if (proyecto) {
    proyecto.equipoIds.forEach(agregar)
    usuarios
      .filter((u) => u.rol === 'Usuario Cliente' && u.activo && u.empresaId === proyecto.empresaId)
      .forEach((u) => agregar(u.id))
  }
  if (responsableActualId) agregar(responsableActualId)
  return ids.map((id) => {
    const u = porId.get(id)!
    return { id, etiqueta: u.rol === 'Usuario Cliente' ? `${u.nombre} · Cliente` : u.nombre }
  })
}
