// Búsqueda y orden del listado de Documentación (O16). Antes la tabla (13 columnas) no se podía buscar por texto ni
// ordenar; con 10 o más documentos había que recorrerla a ojo.

export interface Orden {
  clave: string
  direccion: 'asc' | 'desc'
}

// Sin mayúsculas, sin acentos y sin espacios alrededor: "politica" encuentra "Política".
const normalizar = (texto: string): string => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

// `textoDe` dice qué texto de cada documento se busca (código, título, empresa…): lo sabe la pantalla. Conserva el orden.
export function buscarDocumentos<T>(items: T[], texto: string, textoDe: (item: T) => string): T[] {
  const buscado = normalizar(texto)
  if (!buscado) return items
  return items.filter((item) => normalizar(textoDe(item)).includes(buscado))
}

// Compara los números dentro del texto como números ("1.9" antes que "1.10") y no distingue acentos ni mayúsculas.
const comparador = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

// `valorDe(clave)` devuelve cómo leer esa columna de un documento. Los vacíos van siempre al final, sea cual sea la
// dirección: un documento sin código no debe quedar primero al invertir el orden. No modifica la lista; es estable.
export function ordenarDocumentos<T>(items: T[], orden: Orden | null, valorDe: (clave: string) => (item: T) => string): T[] {
  if (!orden) return items
  const leer = valorDe(orden.clave)
  const signo = orden.direccion === 'asc' ? 1 : -1
  return items
    .map((item, indice) => ({ item, indice, valor: leer(item) }))
    .sort((a, b) => {
      if (!a.valor && !b.valor) return a.indice - b.indice
      if (!a.valor) return 1
      if (!b.valor) return -1
      return signo * comparador.compare(a.valor, b.valor) || a.indice - b.indice
    })
    .map(({ item }) => item)
}

// Clic en el encabezado de una columna: ascendente → descendente → sin orden. Otra columna empieza en ascendente.
export function siguienteOrden(actual: Orden | null, clave: string): Orden | null {
  if (!actual || actual.clave !== clave) return { clave, direccion: 'asc' }
  return actual.direccion === 'asc' ? { clave, direccion: 'desc' } : null
}
