import type { ModeloDocumento } from './exportacion'
import { PALETA, hex } from './paletaExportacion'

// PDF con pdfmake. La fuente es Roboto (la que trae la librería): cubre los símbolos que
// aparecen en los documentos (≥ ÷ × • —), que las fuentes estándar de PDF no tienen.
// La librería pesa, así que se carga SOLO al exportar (import dinámico). Misma paleta que Word.

const COLOR_TEXTO = '#1e293b'

type Celda = { text: string; bold?: boolean; fillColor?: string; color?: string }

const ESTILO_TITULO = { fontSize: 13, bold: true, color: hex(PALETA.seccion) }

// Si la tabla tiene `titulo`, va como su PRIMERA fila (sin bordes) y cuenta como encabezado.
// Así pdfmake lo mantiene con las filas siguientes (keepWithHeaderRows) y lo repite al cambiar
// de página. Se probó renderizando: un título suelto antes de la tabla (con pageBreakBefore)
// seguía quedando solo al pie de la página, porque pdfmake mide los nodos antes de partir la tabla.
function tabla(columnas: string[], filas: string[][], titulo?: string): object {
  const ancho = Math.max(columnas.length, ...filas.map((f) => f.length), 1)
  const completa = (fila: string[]) => Array.from({ length: ancho }, (_, i) => fila[i] ?? '')
  const filaTitulo: object[][] = titulo
    ? [[{ text: titulo, colSpan: ancho, ...ESTILO_TITULO, border: [false, false, false, false], margin: [-5, 14, 0, 4] }, ...Array.from({ length: ancho - 1 }, () => ({}))]]
    : []
  // Encabezado: azul marino con texto blanco. Filas de datos: la 2.ª, 4.ª… en gris azulado claro.
  const encabezado: Celda[][] = columnas.length
    ? [completa(columnas).map((c) => ({ text: c, bold: true, fillColor: hex(PALETA.titulo), color: hex(PALETA.textoEncabezado) }))]
    : []
  return {
    // Con título, la línea de ARRIBA de la tabla no se dibuja (índice 0): el título no es parte
    // de la grilla. Se anula acá y no por celda porque pdfmake sí dibujaba el borde superior de
    // las celdas que ocupa el colSpan (raya suelta sobre el título, vista en un PDF real).
    // El layout parcial se completa con los valores por defecto (1 pt, negro).
    ...(titulo ? { layout: { hLineWidth: (i: number) => (i === 0 ? 0 : 1) } } : {}),
    table: {
      headerRows: filaTitulo.length + encabezado.length,
      ...(titulo ? { keepWithHeaderRows: 1 } : {}),
      dontBreakRows: true,
      widths: Array<string>(ancho).fill('*'),
      body: [
        ...filaTitulo,
        ...encabezado,
        ...filas.map((fila, j) => completa(fila).map((c): Celda => ({ text: c, ...(j % 2 === 1 ? { fillColor: hex(PALETA.cebra) } : {}) }))),
      ],
    },
    fontSize: 9,
    margin: [0, 0, 0, 12],
  }
}

// El título de un texto va en un grupo indivisible con su primer párrafo: no puede quedar solo.
function bloqueTexto(titulo: string, parrafos: string[]): object[] {
  const [primero, ...resto] = parrafos
  const encabezado = { text: titulo, ...ESTILO_TITULO, margin: [0, 14, 0, 6] }
  return [
    { unbreakable: true, stack: [encabezado, ...(primero ? [{ text: primero, margin: [0, 0, 0, 4] }] : [])] },
    ...resto.map((parrafo) => ({ text: parrafo, margin: [0, 0, 0, 4] })),
  ]
}

// La DEFINICIÓN del documento (lo que pdfmake dibuja) se arma aparte de la generación: así se
// prueba al detalle sin renderizar nada.
export function armarDefinicionPdf(modelo: ModeloDocumento): { pageSize: string; defaultStyle: object; footer: unknown; content: unknown[] } & Record<string, unknown> {
  const metadatos: [string, string][] = [
    ['Código', modelo.codigo],
    ['Versión', modelo.version],
    ['Estado', modelo.estado],
    ['Fecha', modelo.fecha],
    ['Tipo', modelo.tipo],
    ['Organización', modelo.organizacion],
    ['Proyecto', modelo.proyecto],
    ['Referencia normativa', modelo.referenciaNormativa],
  ]
  const conDato = metadatos.filter(([, valor]) => valor)

  return {
    pageSize: 'LETTER',
    pageMargins: [56, 56, 56, 64],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: COLOR_TEXTO, lineHeight: 1.25 },
    footer: (pagina: number, total: number) => ({
      text: `${[modelo.codigo, `v${modelo.version}`].filter(Boolean).join(' · ')} · Página ${pagina} de ${total}`,
      alignment: 'center',
      fontSize: 8,
      color: hex(PALETA.suave),
      margin: [0, 18, 0, 0],
    }),
    content: [
      { text: modelo.titulo, fontSize: 18, bold: true, color: hex(PALETA.titulo), margin: [0, 0, 0, 10] },
      tabla(['Campo', 'Información'], conDato.map(([campo, valor]) => [campo, valor])),
      ...modelo.avisos.map((aviso) => ({ text: aviso, italics: true, color: hex(PALETA.aviso), margin: [0, 0, 0, 6] })),
      ...modelo.bloques.flatMap((bloque) =>
        bloque.tipo === 'texto' ? bloqueTexto(bloque.titulo, bloque.parrafos) : [tabla(bloque.columnas, bloque.filas, bloque.titulo)],
      ),
    ],
  }
}

export async function generarPdf(modelo: ModeloDocumento): Promise<Blob> {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ])
  pdfMake.addVirtualFileSystem(vfs)
  const bytes = await pdfMake.createPdf(armarDefinicionPdf(modelo)).getBuffer()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}
