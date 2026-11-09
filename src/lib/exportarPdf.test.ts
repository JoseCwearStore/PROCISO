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

type Celda = { text?: string; bold?: boolean; colSpan?: number; fillColor?: string; color?: string }
type Nodo = { text?: string; stack?: Nodo[]; unbreakable?: boolean; table?: { headerRows: number; keepWithHeaderRows?: number; widths: string[]; body: Celda[][] }; [k: string]: unknown }
const contenido = () => armarDefinicionPdf(MODELO).content as Nodo[]
const tablas = () => contenido().filter((n) => n.table)
// Las tablas del documento llevan su título como PRIMERA fila (para que no se separe de ellas);
// la de metadatos no tiene título.
const tablaDe = (titulo: string) => tablas().find((t) => t.table!.body[0][0].text === titulo)!

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

  it('una tabla abre con su título y su encabezado, ambos repetidos al cambiar de página', () => {
    const t = tablaDe('Preguntas').table!
    expect(t.headerRows).toBe(2)
    expect(t.body[0][0]).toMatchObject({ text: 'Preguntas', bold: true, colSpan: 2 })
    expect(t.body[1].map((c) => [c.text, c.bold])).toEqual([['Pregunta', true], ['Respuesta', true]])
    expect(t.body[2].map((c) => c.text)).toEqual(['¿Qué ofrece?', 'Campañas'])
  })

  describe('estilo (paleta azul marino del ejemplo del usuario)', () => {
    it('los encabezados de tabla van en azul marino con texto blanco y negrita', () => {
      for (const c of tablaDe('Preguntas').table!.body[1]) expect(c).toMatchObject({ bold: true, fillColor: '#1F3864', color: '#FFFFFF' })
    })

    it('la tabla de metadatos tiene su propio encabezado "Campo | Información"', () => {
      const meta = tablas().find((t) => t.table!.body[0][0].text === 'Campo')!.table!
      expect(meta.headerRows).toBe(1)
      expect(meta.body[0].map((c) => [c.text, c.fillColor])).toEqual([['Campo', '#1F3864'], ['Información', '#1F3864']])
      expect(meta.body[1].map((c) => c.text)).toEqual(['Código', 'SGC-POL-001'])
    })

    it('las filas de datos se alternan: la 1.ª sin relleno y la 2.ª en gris azulado claro', () => {
      const t = tablaDe('Preguntas').table!
      expect(t.body[2][0].fillColor).toBeUndefined()
      expect(t.body[3][0].fillColor).toBe('#F2F5FA')
    })

    it('el título del documento va en azul marino y los de sección en azul', () => {
      expect(contenido()[0].color).toBe('#1F3864')
      expect(contenido().find((n) => n.unbreakable)!.stack![0].color).toBe('#1F4E79')
      expect(tablaDe('Preguntas').table!.body[0][0].color).toBe('#1F4E79')
    })
  })

  it('el título de una tabla nunca queda solo: la tabla exige al menos una fila junto a sus encabezados', () => {
    for (const nombre of ['Preguntas', 'Libre']) expect(tablaDe(nombre).table!.keepWithHeaderRows, nombre).toBe(1)
  })

  it('las celdas vacías no rompen la tabla', () => {
    expect(tablaDe('Preguntas').table!.body[3].map((c) => c.text)).toEqual(['¿A quién?', ''])
  })

  it('una tabla sin encabezado solo repite su título y reparte el ancho entre sus columnas', () => {
    const libre = tablaDe('Libre').table!
    expect(libre.headerRows).toBe(1)
    expect(libre.widths).toEqual(['*', '*', '*'])
    expect(libre.body[1].map((c) => c.text)).toEqual(['a', 'b', 'c'])
  })

  it('en un bloque de texto el título va pegado a su primer párrafo (no puede quedar solo al pie)', () => {
    const grupo = contenido().find((n) => n.unbreakable)!
    expect(grupo.stack!.map((n) => n.text)).toEqual(['Declaración', 'Primer párrafo.'])
    // El resto de los párrafos sigue como texto normal, después del grupo.
    expect(contenido().some((n) => n.text === '• Meta ≥ 95 %')).toBe(true)
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
