// Fechas de un proyecto nuevo (O35). Espejo de `crear_proyecto` y del CHECK de la tabla: la BD decide, esto solo avisa
// antes de enviar el formulario. Las fechas llegan como yyyy-mm-dd (input type="date"), que ordena bien como texto.

export function errorDeFechasProyecto(inicio: string, fin: string): string | null {
  // Si falta una de las dos ya hay otro aviso ("la fecha es requerida"): no hay nada que comparar.
  if (!inicio || !fin) return null
  return fin < inicio ? 'La fecha fin no puede ser anterior a la de inicio' : null
}
