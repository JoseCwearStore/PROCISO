import { describe, expect, it } from 'vitest'
import type { Documento } from '../types'
import { armarModelo, nombreArchivo } from './exportacion'
import { PENDIENTE } from './plantillas'

function documento(extra: Partial<Documento> = {}): Documento {
  return {
    id: 'd1',
    nombre: 'Política de calidad — Marketino',
    tipo: 'Política',
    proyectoId: 'p1',
    estado: 'Borrador',
    version: '0.1',
    codigo: 'SGC-POL-001',
    fechaCreacion: '09/11/2026',
    fechaModificacion: '10/11/2026',
    referenciaNormativa: 'ISO 9001:2026',
    secciones: [
      { id: 's1', titulo: 'Declaración', tipo: 'texto', contenido: 'Primer párrafo.\n\n• Viñeta uno\n• Viñeta dos\n' },
      {
        id: 's2',
        titulo: 'Preguntas guiadas',
        tipo: 'tabla',
        contenido: '',
        filas: [['Pregunta', 'Respuesta'], ['¿Qué ofrece?', 'Campañas']],
      },
    ],
    evidenciasVinculadas: [],
    comentarios: [],
    historialVersiones: [],
    historial: [],
    ...extra,
  } as Documento
}

const CTX = { organizacion: 'Marketino', proyecto: 'Implementación SGC' }

describe('armarModelo', () => {
  it('lleva los metadatos del documento y del contexto', () => {
    const m = armarModelo(documento(), CTX)
    expect(m).toMatchObject({
      titulo: 'Política de calidad — Marketino',
      codigo: 'SGC-POL-001',
      version: '0.1',
      estado: 'Borrador',
      tipo: 'Política',
      organizacion: 'Marketino',
      proyecto: 'Implementación SGC',
      referenciaNormativa: 'ISO 9001:2026',
      fecha: '10/11/2026',
    })
  })

  it('parte el texto en párrafos, sin líneas vacías ni espacios sobrantes', () => {
    const [texto] = armarModelo(documento(), CTX).bloques
    expect(texto).toEqual({ tipo: 'texto', titulo: 'Declaración', parrafos: ['Primer párrafo.', '• Viñeta uno', '• Viñeta dos'] })
  })

  it('la primera fila de una tabla es su encabezado', () => {
    const [, tabla] = armarModelo(documento(), CTX).bloques
    expect(tabla).toEqual({ tipo: 'tabla', titulo: 'Preguntas guiadas', columnas: ['Pregunta', 'Respuesta'], filas: [['¿Qué ofrece?', 'Campañas']] })
  })

  it('una tabla agregada a mano, con el encabezado vacío, no inventa columnas', () => {
    const d = documento({ secciones: [{ id: 's', titulo: 'Tabla libre', tipo: 'tabla', contenido: '', filas: [['', ''], ['a', 'b']] }] })
    expect(armarModelo(d, CTX).bloques[0]).toEqual({ tipo: 'tabla', titulo: 'Tabla libre', columnas: [], filas: [['a', 'b']] })
  })

  it('una tabla sin filas queda con encabezado y filas vacíos', () => {
    const d = documento({ secciones: [{ id: 's', titulo: 'Vacía', tipo: 'tabla', contenido: '' }] })
    expect(armarModelo(d, CTX).bloques[0]).toEqual({ tipo: 'tabla', titulo: 'Vacía', columnas: [], filas: [] })
  })

  it('una sección de texto sin contenido queda como pendiente', () => {
    const d = documento({ secciones: [{ id: 's', titulo: 'Vacía', tipo: 'texto', contenido: '  ' }] })
    expect(armarModelo(d, CTX).bloques[0]).toEqual({ tipo: 'texto', titulo: 'Vacía', parrafos: [PENDIENTE] })
  })

  it('no exporta la sección de encabezado: ya está en la tabla de metadatos del archivo', () => {
    const d = documento({
      secciones: [
        { id: 'e1', titulo: 'Encabezado y control documental', tipo: 'texto', contenido: 'Código: SGC-POL-001' },
        { id: 'e2', titulo: 'Encabezado y control', tipo: 'texto', contenido: 'Código: FO-001' },
        { id: 's1', titulo: 'Declaración', tipo: 'texto', contenido: 'Texto.' },
      ],
    })
    expect(armarModelo(d, CTX).bloques.map((b) => b.titulo)).toEqual(['Declaración'])
  })

  it('el aviso de pendientes solo cuenta lo que se exporta (no el encabezado omitido)', () => {
    const d = documento({
      estado: 'Aprobado',
      secciones: [
        { id: 'e', titulo: 'Encabezado y control documental', tipo: 'texto', contenido: `Código: ${PENDIENTE}` },
        { id: 's', titulo: 'Declaración', tipo: 'texto', contenido: 'ok' },
      ],
    })
    expect(armarModelo(d, CTX).avisos).toEqual([])
  })

  it('un documento sin secciones no rompe', () => {
    expect(armarModelo(documento({ secciones: undefined }), CTX).bloques).toEqual([])
  })

  describe('avisos', () => {
    it('todo lo que no está aprobado es preliminar', () => {
      for (const estado of ['Borrador', 'En elaboración', 'Pendiente de revisión', 'En corrección', 'Rechazado'] as const) {
        expect(armarModelo(documento({ estado }), CTX).avisos[0], estado).toContain('Documento preliminar')
      }
    })

    it('un documento aprobado no lleva el aviso de preliminar', () => {
      expect(armarModelo(documento({ estado: 'Aprobado' }), CTX).avisos).toEqual([])
    })

    it('cuenta las secciones con información pendiente', () => {
      const d = documento({
        estado: 'Aprobado',
        secciones: [
          { id: 'a', titulo: 'A', tipo: 'texto', contenido: PENDIENTE },
          { id: 'b', titulo: 'B', tipo: 'texto', contenido: 'ok' },
          { id: 'c', titulo: 'C', tipo: 'texto', contenido: `texto\n${PENDIENTE}` },
        ],
      })
      expect(armarModelo(d, CTX).avisos).toEqual(['Contiene 2 secciones con información pendiente de confirmar.'])
    })

    it('usa el singular con una sola sección pendiente', () => {
      const d = documento({ estado: 'Aprobado', secciones: [{ id: 'a', titulo: 'A', tipo: 'texto', contenido: PENDIENTE }] })
      expect(armarModelo(d, CTX).avisos).toEqual(['Contiene 1 sección con información pendiente de confirmar.'])
    })
  })

  it('un código marcado como pendiente (documento sin código) no se exporta como código', () => {
    const m = armarModelo(documento({ codigo: PENDIENTE }), CTX)
    expect(m.codigo).toBe('')
    expect(nombreArchivo(m, 'pdf')).toBe('v0.1_politica-de-calidad-marketino.pdf')
  })

  it('sin organización ni proyecto en el contexto, queda en blanco y no rompe', () => {
    const m = armarModelo(documento({ codigo: undefined }), {})
    expect(m.organizacion).toBe('')
    expect(m.proyecto).toBe('')
    expect(m.codigo).toBe('')
  })
})

describe('nombreArchivo', () => {
  const m = armarModelo(documento(), CTX)

  it('arma código, versión y título sin acentos ni símbolos', () => {
    expect(nombreArchivo(m, 'docx')).toBe('SGC-POL-001_v0.1_politica-de-calidad-marketino.docx')
    expect(nombreArchivo(m, 'pdf')).toBe('SGC-POL-001_v0.1_politica-de-calidad-marketino.pdf')
  })

  it('sin código usa solo versión y título', () => {
    expect(nombreArchivo(armarModelo(documento({ codigo: undefined }), CTX), 'pdf')).toBe('v0.1_politica-de-calidad-marketino.pdf')
  })

  it('un título enorme se acorta', () => {
    const largo = armarModelo(documento({ nombre: 'x'.repeat(200) }), CTX)
    expect(nombreArchivo(largo, 'pdf').length).toBeLessThanOrEqual(90)
  })

  it('un título sin letras ni números cae en "documento"', () => {
    expect(nombreArchivo(armarModelo(documento({ nombre: '—' }), CTX), 'pdf')).toBe('SGC-POL-001_v0.1_documento.pdf')
  })
})
