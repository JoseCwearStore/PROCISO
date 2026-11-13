// Las opciones del filtro "Responsables" (O1): quienes SON responsables de algún proyecto de los que se ven. Antes se
// ofrecía a todos los consultores y administradores, aunque no fueran responsables de nada: elegirlos solo dejaba la
// pantalla vacía. Un administrador que sí es responsable de un proyecto aparece (no se excluye por su rol).
export function responsablesDeProyectos<U extends { id: string; nombre: string }>(
  proyectos: { consultorId: string }[],
  usuarios: U[],
): U[] {
  const ids = new Set(proyectos.map((proyecto) => proyecto.consultorId))
  return usuarios
    .filter((usuario) => ids.has(usuario.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}
