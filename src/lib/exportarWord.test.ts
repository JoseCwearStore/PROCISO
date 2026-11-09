import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import type { ModeloDocumento } from './exportacion'
import { generarWord } from './exportarWord'

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

async function abrir(modelo: ModeloDocumento) {
  const blob = await generarWord(modelo)
  const zip = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  const archivo = (patron: RegExp) => Object.entries(zip).filter(([nombre]) => patron.test(nombre)).map(([, datos]) => strFromU8(datos)).join('\n')
  return { blob, zip, documento: archivo(/^word\/document\.xml$/), pies: archivo(/^word\/footer\d*\.xml$/), estilos: archivo(/^word\/styles\.xml$/) }
}

describe('generarWord', () => {
  it('devuelve un .docx real: un zip de Office con word/document.xml', async () => {
    const { blob, zip } = await abrir(MODELO)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(Object.keys(zip)).toContain('word/document.xml')
    expect(Object.keys(zip)).toContain('[Content_Types].xml')
  })

  it('lleva el título, los metadatos y el aviso', async () => {
    const { documento } = await abrir(MODELO)
    for (const dato of ['Política de calidad — Marketino', 'SGC-POL-001', '0.1', 'Borrador', 'Marketino', 'Implementación SGC', 'ISO 9001:2026', '10/11/2026', 'Documento preliminar. Requiere revisión.']) {
      expect(documento, dato).toContain(dato)
    }
  })

  it('lleva los párrafos de texto con sus símbolos', async () => {
    const { documento } = await abrir(MODELO)
    expect(documento).toContain('Declaración')
    expect(documento).toContain('Primer párrafo.')
    expect(documento).toContain('• Meta ≥ 95 %')
  })

  it('arma las tablas: la de metadatos y las dos del documento', async () => {
    const { documento } = await abrir(MODELO)
    expect(documento.match(/<w:tbl>/g)).toHaveLength(3)
    expect(documento).toContain('Pregunta')
    expect(documento).toContain('Campañas')
  })

  it('una celda vacía no deja la tabla inválida (toda celda lleva un párrafo)', async () => {
    const { documento } = await abrir(MODELO)
    const celdas = documento.match(/<w:tc>.*?<\/w:tc>/gs) ?? []
    expect(celdas.length).toBeGreaterThan(8)
    expect(celdas.every((c) => c.includes('<w:p>') || c.includes('<w:p '))).toBe(true)
  })

  it('el pie lleva el código y los números de página', async () => {
    const { pies } = await abrir(MODELO)
    expect(pies).toContain('SGC-POL-001')
    expect(pies).toContain('Página')
    expect(pies).toMatch(/PAGE/)
    expect(pies).toMatch(/NUMPAGES/)
  })

  it('cada título de sección se mantiene con lo que sigue (no queda huérfano al pie de una página)', async () => {
    const { documento } = await abrir(MODELO)
    const titulos = documento.match(/<w:p>(?:(?!<\/w:p>).)*?<w:pStyle w:val="Heading2"\/>.*?<\/w:p>/gs) ?? []
    expect(titulos).toHaveLength(MODELO.bloques.length)
    expect(titulos.every((p) => p.includes('<w:keepNext'))).toBe(true)
  })

  describe('estilo (paleta azul marino del ejemplo del usuario)', () => {
    it('los encabezados de tabla van en azul marino con texto blanco', async () => {
      const { documento } = await abrir(MODELO)
      expect(documento).toContain('w:fill="1F3864"')
      expect(documento).toContain('<w:color w:val="FFFFFF"/>')
    })

    it('la tabla de metadatos tiene su propio encabezado "Campo | Información"', async () => {
      const { documento } = await abrir(MODELO)
      const primeraTabla = documento.match(/<w:tbl>.*?<\/w:tbl>/s)![0]
      expect(primeraTabla).toContain('>Campo<')
      expect(primeraTabla).toContain('>Información<')
      expect(primeraTabla).toContain('w:fill="1F3864"')
    })

    it('las filas se alternan en gris azulado claro (la 2.ª fila de datos va rellena y la 1.ª no)', async () => {
      const { documento } = await abrir(MODELO)
      const tabla = (documento.match(/<w:tbl>.*?<\/w:tbl>/gs) ?? []).find((t) => t.includes('¿Qué ofrece?'))!
      const filas = tabla.match(/<w:tr>.*?<\/w:tr>/gs)!
      // filas[0] = encabezado, filas[1] = 1.ª de datos, filas[2] = 2.ª de datos
      expect(filas[1]).not.toContain('F2F5FA')
      expect(filas[2]).toContain('F2F5FA')
    })

    it('el título del documento va en azul marino y los de sección en azul', async () => {
      const { documento } = await abrir(MODELO)
      expect(documento).toContain('<w:color w:val="1F3864"/>')
      expect(documento).toContain('<w:color w:val="1F4E79"/>')
    })

    it('la fuente es Arial, que cualquier Word tiene', async () => {
      const { estilos } = await abrir(MODELO)
      expect(estilos).toContain('Arial')
    })
  })

  it('escapa los caracteres especiales del XML', async () => {
    const { documento } = await abrir({ ...MODELO, titulo: 'A & B <c>' })
    expect(documento).toContain('A &amp; B &lt;c&gt;')
  })

  it('un documento sin bloques ni avisos se genera igual', async () => {
    const { documento } = await abrir({ ...MODELO, bloques: [], avisos: [] })
    expect(documento).toContain('Política de calidad — Marketino')
  })

  it('una tabla de 150 filas se genera sin fallar', async () => {
    const filas = Array.from({ length: 150 }, (_, i) => [`Fila ${i}`, 'x'.repeat(80), `${i} %`])
    const { documento } = await abrir({ ...MODELO, bloques: [{ tipo: 'tabla', titulo: 'Grande', columnas: ['A', 'B', 'C'], filas }] })
    expect(documento).toContain('Fila 149')
  })
})
