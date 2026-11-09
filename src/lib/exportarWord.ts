import type { ModeloDocumento } from './exportacion'
import { PALETA } from './paletaExportacion'

// Word (.docx) con la librería `docx`, cargada SOLO al exportar (import dinámico).
// Sale del mismo modelo que el PDF (exportacion.ts) y con la misma paleta.

type Docx = typeof import('docx')

const COLOR_BORDE = PALETA.borde
const COLOR_SUAVE = PALETA.suave
const COLOR_AVISO = PALETA.aviso

// Carta con márgenes de 2 cm (1134 twips). El ancho útil reparte las columnas.
const ANCHO_PAGINA = 12240
const MARGEN = 1134
const ANCHO_UTIL = ANCHO_PAGINA - 2 * MARGEN

function construir(d: Docx, modelo: ModeloDocumento) {
  const borde = { style: d.BorderStyle.SINGLE, size: 4, color: COLOR_BORDE }
  const bordes = { top: borde, bottom: borde, left: borde, right: borde }

  const celda = (texto: string, ancho: number, opciones: { negrita?: boolean; relleno?: string; color?: string } = {}) =>
    new d.TableCell({
      width: { size: ancho, type: d.WidthType.DXA },
      borders: bordes,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      ...(opciones.relleno ? { shading: { type: d.ShadingType.CLEAR, fill: opciones.relleno, color: 'auto' } } : {}),
      // Toda celda lleva un párrafo, aunque esté vacía: así el .docx es válido.
      children: [new d.Paragraph({ children: [new d.TextRun({ text: texto, bold: opciones.negrita, color: opciones.color, size: 18 })] })],
    })

  const tabla = (columnas: string[], filas: string[][], anchos?: number[]) => {
    const ancho = Math.max(columnas.length, ...filas.map((f) => f.length), 1)
    const columnasDxa = anchos ?? Array<number>(ancho).fill(Math.floor(ANCHO_UTIL / ancho))
    const completa = (fila: string[]) => Array.from({ length: ancho }, (_, i) => fila[i] ?? '')
    // Encabezado: azul marino con texto blanco. Filas de datos: la 2.ª, 4.ª… en gris azulado claro.
    const filaWord = (fila: string[], encabezado: boolean, indiceDato = 0) => {
      const estilo = encabezado
        ? { negrita: true, relleno: PALETA.titulo, color: PALETA.textoEncabezado }
        : indiceDato % 2 === 1 ? { relleno: PALETA.cebra } : {}
      return new d.TableRow({ tableHeader: encabezado, cantSplit: true, children: completa(fila).map((c, i) => celda(c, columnasDxa[i], estilo)) })
    }
    return new d.Table({
      width: { size: ANCHO_UTIL, type: d.WidthType.DXA },
      columnWidths: columnasDxa,
      rows: [...(columnas.length ? [filaWord(columnas, true)] : []), ...filas.map((f, j) => filaWord(f, false, j))],
    })
  }

  const metadatos = ([
    ['Código', modelo.codigo],
    ['Versión', modelo.version],
    ['Estado', modelo.estado],
    ['Fecha', modelo.fecha],
    ['Tipo', modelo.tipo],
    ['Organización', modelo.organizacion],
    ['Proyecto', modelo.proyecto],
    ['Referencia normativa', modelo.referenciaNormativa],
  ] as [string, string][]).filter(([, valor]) => valor)

  const espacio = () => new d.Paragraph({ spacing: { after: 120 }, children: [] })

  return new d.Document({
    creator: 'PROCISO',
    title: modelo.titulo,
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [
      {
        properties: { page: { size: { width: ANCHO_PAGINA, height: 15840 }, margin: { top: MARGEN, bottom: MARGEN, left: MARGEN, right: MARGEN } } },
        footers: {
          default: new d.Footer({
            children: [
              new d.Paragraph({
                alignment: d.AlignmentType.CENTER,
                children: [
                  new d.TextRun({ text: `${[modelo.codigo, `v${modelo.version}`].filter(Boolean).join(' · ')} · Página `, size: 16, color: COLOR_SUAVE }),
                  new d.TextRun({ children: [d.PageNumber.CURRENT], size: 16, color: COLOR_SUAVE }),
                  new d.TextRun({ text: ' de ', size: 16, color: COLOR_SUAVE }),
                  new d.TextRun({ children: [d.PageNumber.TOTAL_PAGES], size: 16, color: COLOR_SUAVE }),
                ],
              }),
            ],
          }),
        },
        children: [
          new d.Paragraph({ heading: d.HeadingLevel.TITLE, spacing: { after: 200 }, children: [new d.TextRun({ text: modelo.titulo, bold: true, size: 36, color: PALETA.titulo })] }),
          tabla(['Campo', 'Información'], metadatos.map(([campo, valor]) => [campo, valor]), [2800, ANCHO_UTIL - 2800]),
          espacio(),
          ...modelo.avisos.map((aviso) => new d.Paragraph({ spacing: { after: 100 }, children: [new d.TextRun({ text: aviso, italics: true, color: COLOR_AVISO })] })),
          ...modelo.bloques.flatMap((bloque) => [
            // keepNext: el título viaja con lo que sigue; sin esto puede quedar solo al pie de la página.
            new d.Paragraph({ heading: d.HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 280, after: 120 }, children: [new d.TextRun({ text: bloque.titulo, bold: true, size: 26, color: PALETA.seccion })] }),
            ...(bloque.tipo === 'texto'
              ? bloque.parrafos.map((parrafo) => new d.Paragraph({ spacing: { after: 80 }, children: [new d.TextRun({ text: parrafo })] }))
              : [tabla(bloque.columnas, bloque.filas), espacio()]),
          ]),
        ],
      },
    ],
  })
}

export async function generarWord(modelo: ModeloDocumento): Promise<Blob> {
  const d = await import('docx')
  return d.Packer.toBlob(construir(d, modelo))
}
