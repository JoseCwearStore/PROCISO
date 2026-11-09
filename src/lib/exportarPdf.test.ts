import { describe, expect, it } from 'vitest'
import type { ModeloDocumento } from './exportacion'
import { armarDefinicionPdf, generarPdf } from './exportarPdf'

const MODELO: ModeloDocumento = {
  titulo: 'Política de calidad — Marketino',
  codigo: 'SGC-POL-001',
  version: '0.1',
  estado: 'Borrador',
  tipo: 'Política',
  organizacion: 'Marketino',
  proyecto: 'Implementación SGC',
  referenciaNormativa: 'ISO 9001:2026',
  fecha: '10/11/2026',
  avisos: ['Documento preliminar. Requiere revisión.'],
  bloques: [
    { tipo: 'texto', titulo: 'Declaración', parrafos: ['Primer párrafo.', '• Meta ≥ 95 %'] },
    { tipo: 'tabla', titulo: 'Preguntas', columnas: ['Pregunta', 'Respuesta'], filas: [['¿Qué ofrece?', 'Campañas'], ['¿A quién?', '']] },
    { tipo: 'tabla', titulo: 'Libre', columnas: [], filas: [['a', 'b', 'c']] },
  ],
}

type Nodo = { text?: string; table?: { headerRows: number; widths: string[]; body: { text?: string; bold?: boolean }[][] }; [k: string]: unknown }
const contenido = () => armarDefinicionPdf(MODELO).content as Nodo[]
const tablas = () => contenido().filter((n) => n.table)

describe('armarDefinicionPdf', () => {
  it('es una página carta con la fuente Roboto', () => {
    const def = armarDefinicionPdf(MODELO)
    expect(def.pageSize).toBe('LETTER')
    expect(def.defaultStyle).toMatchObject({ font: 'Roboto' })
  })

  it('abre con el título, y lleva los avisos y los metadatos', () => {
    const texto = JSON.stringify(armarDefinicionPdf(MODELO).content)
    expect(contenido()[0].text).toBe('Política de calidad — Marketino')
    for (const dato of ['SGC-POL-001', '0.1', 'Borrador', 'Marketino', 'Implementación SGC', 'ISO 9001:2026', '10/11/2026']) {
      expect(texto, dato).toContain(dato)
    }
    expect(texto).toContain('Documento preliminar. Requiere revisión.')
  })

  it('cada bloque lleva su título y sus párrafos, con los símbolos intactos', () => {
    const texto = JSON.stringify(armarDefinicionPdf(MODELO).content)
    expect(texto).toContain('Declaración')
    expect(texto).toContain('Primer párrafo.')
    expect(texto).toContain('• Meta ≥ 95 %')
  })

  it('una tabla con encabezado lo marca como tal, en negrita, y repite el encabezado al cambiar de página', () => {
    const preguntas = tablas().find((t) => JSON.stringify(t).includes('Preguntas') || t.table!.body[0][0].text === 'Pregunta')!
    expect(preguntas.table!.headerRows).toBe(1)
    expect(preguntas.table!.body[0].map((c) => [c.text, c.bold])).toEqual([['Pregunta', true], ['Respuesta', true]])
    expect(preguntas.table!.body[1].map((c) => c.text)).toEqual(['¿Qué ofrece?', 'Campañas'])
  })

  it('las celdas vacías no rompen la tabla', () => {
    const preguntas = tablas().find((t) => t.table!.body[0][0].text === 'Pregunta')!
    expect(preguntas.table!.body[2].map((c) => c.text)).toEqual(['¿A quién?', ''])
  })

  it('una tabla sin encabezado no marca encabezado y reparte el ancho entre sus columnas', () => {
    const libre = tablas().find((t) => t.table!.body[0][0].text === 'a')!
    expect(libre.table!.headerRows).toBe(0)
    expect(libre.table!.widths).toEqual(['*', '*', '*'])
  })

  it('el pie lleva el código y "Página X de Y"', () => {
    const pie = armarDefinicionPdf(MODELO).footer as (p: number, n: number) => { text: string }
    expect(pie(2, 5).text).toBe('SGC-POL-001 · v0.1 · Página 2 de 5')
  })

  it('sin código el pie solo lleva la versión y la página', () => {
    const pie = armarDefinicionPdf({ ...MODELO, codigo: '' }).footer as (p: number, n: number) => { text: string }
    expect(pie(1, 1).text).toBe('v0.1 · Página 1 de 1')
  })

  it('un documento sin bloques ni avisos genera igual el encabezado', () => {
    const def = armarDefinicionPdf({ ...MODELO, bloques: [], avisos: [] })
    expect((def.content as Nodo[])[0].text).toBe('Política de calidad — Marketino')
  })
})

describe('generarPdf', () => {
  it('devuelve un PDF real (Blob application/pdf con la cabecera %PDF-)', async () => {
    const blob = await generarPdf(MODELO)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(2000)
    const cabecera = new TextDecoder().decode(new Uint8Array(await blob.slice(0, 5).arrayBuffer()))
    expect(cabecera).toBe('%PDF-')
  })

  it('un documento enorme con muchas filas se genera sin fallar', async () => {
    const filas = Array.from({ length: 150 }, (_, i) => [`Fila ${i}`, 'x'.repeat(80), `${i} %`])
    const blob = await generarPdf({ ...MODELO, bloques: [{ tipo: 'tabla', titulo: 'Grande', columnas: ['A', 'B', 'C'], filas }] })
    expect(blob.size).toBeGreaterThan(5000)
  })
})
