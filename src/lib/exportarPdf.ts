import type { ModeloDocumento } from './exportacion'

// PDF con pdfmake. La fuente es Roboto (la que trae la librería): cubre los símbolos que
// aparecen en los documentos (≥ ÷ × • —), que las fuentes estándar de PDF no tienen.
// La librería pesa, así que se carga SOLO al exportar (import dinámico).

const COLOR_TEXTO = '#1e293b'
const COLOR_SUAVE = '#64748b'
const COLOR_ENCABEZADO = '#eef2f7'

type Celda = { text: string; bold?: boolean; fillColor?: string }

const ESTILO_TITULO = { fontSize: 13, bold: true }

// Si la tabla tiene `titulo`, va como su PRIMERA fila (sin bordes) y cuenta como encabezado.
// Así pdfmake lo mantiene con las filas siguientes (keepWithHeaderRows) y lo repite al cambiar
// de página. Se probó renderizando: un título suelto antes de la tabla (con pageBreakBefore)
// seguía quedando solo al pie de la página, porque pdfmake mide los nodos antes de partir la tabla.
function tabla(columnas: string[], filas: string[][], titulo?: string): object {
  const ancho = Math.max(columnas.length, ...filas.map((f) => f.length), 1)
  const completa = (fila: string[]) => Array.from({ length: ancho }, (_, i) => fila[i] ?? '')
  const filaTitulo: object[][] = titulo
    ? [[{ text: titulo, colSpan: ancho, ...ESTILO_TITULO, border: [false, false, false, false], margin: [0, 14, 0, 4] }, ...Array.from({ length: ancho - 1 }, () => ({}))]]
    : []
  const encabezado: Celda[][] = columnas.length
    ? [completa(columnas).map((c) => ({ text: c, bold: true, fillColor: COLOR_ENCABEZADO }))]
    : []
  return {
    table: {
      headerRows: filaTitulo.length + encabezado.length,
      ...(titulo ? { keepWithHeaderRows: 1 } : {}),
      dontBreakRows: true,
      widths: Array<string>(ancho).fill('*'),
      body: [...filaTitulo, ...encabezado, ...filas.map((fila) => completa(fila).map((c): Celda => ({ text: c })))],
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
      color: COLOR_SUAVE,
      margin: [0, 18, 0, 0],
    }),
    content: [
      { text: modelo.titulo, fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
      tabla([], conDato.map(([campo, valor]) => [campo, valor])),
      ...modelo.avisos.map((aviso) => ({ text: aviso, italics: true, color: '#92400e', margin: [0, 0, 0, 6] })),
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
