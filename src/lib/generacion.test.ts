import { describe, expect, it } from 'vitest'
import { aplicarTextos, armarPedidoIA, camposIA, parsearFilas } from './generacion'
import { crearSecciones, plantillaPorId } from './plantillas'

const contexto = { codigo: 'SGC-TST-001', edicionNorma: 'ISO 9001:2026', nuevoId: (() => { let n = 0; return () => `s${++n}` })() }
const secciones = (id: string) => crearSecciones(plantillaPorId(id)!, contexto)
const contenido = (s: ReturnType<typeof secciones>, titulo: string) => s.find((x) => x.titulo === titulo)!

describe('camposIA', () => {
  it('pide a la IA solo lo que no se puede sacar de los datos', () => {
    expect(camposIA('politica').map((c) => c.id)).toEqual(['declaracion'])
    expect(camposIA('alcance').map((c) => c.id)).toEqual(['declaracion'])
    expect(camposIA('objetivos').map((c) => c.id)).toEqual(['matriz', 'plan'])
  })

  it('las plantillas que salen del Levantamiento no usan IA', () => {
    for (const id of ['ficha', 'procedimiento', 'instruccion', 'mapa', 'formato']) expect(camposIA(id), id).toEqual([])
  })

  it('cada campo trae instrucción y un ejemplo de estilo', () => {
    for (const id of ['politica', 'alcance', 'objetivos']) {
      for (const c of camposIA(id)) {
        expect(c.instruccion.length, `${id}.${c.id}`).toBeGreaterThan(20)
        expect(c.ejemplo?.length, `${id}.${c.id}`).toBeGreaterThan(20)
      }
    }
  })
})

describe('armarPedidoIA', () => {
  const datos = {
    consultoriaId: 'c1',
    proyectoId: 'p1',
    organizacion: 'Marketino',
    respuestas: { productos: 'Campañas', clientes: '   ', mejora: 'Indicadores y auditorías' },
    procesos: ['Compras', 'Producción'],
  }

  it('lleva la plantilla, la organización y solo las preguntas contestadas, con su texto', () => {
    const pedido = armarPedidoIA(plantillaPorId('politica')!, datos)!
    expect(pedido.plantillaId).toBe('politica')
    expect(pedido.plantilla).toBe('Política de calidad')
    expect(pedido.organizacion).toBe('Marketino')
    expect(pedido.respuestas).toEqual([
      { pregunta: '¿Qué productos o servicios ofrece la empresa?', respuesta: 'Campañas' },
      { pregunta: '¿Cómo mejorará continuamente el SGC?', respuesta: 'Indicadores y auditorías' },
    ])
    expect(pedido.procesos).toEqual(['Compras', 'Producción'])
    expect(pedido.campos.map((c) => c.id)).toEqual(['declaracion'])
  })

  it('devuelve null si la plantilla no usa IA', () => {
    expect(armarPedidoIA(plantillaPorId('ficha')!, datos)).toBeNull()
  })
})

describe('parsearFilas', () => {
  const COLS = ['A', 'B', 'C']

  it('separa las columnas por barras y quita viñetas y numeración', () => {
    expect(parsearFilas('- uno | dos | tres\n2. cuatro | cinco | seis', COLS)).toEqual([
      ['uno', 'dos', 'tres'],
      ['cuatro', 'cinco', 'seis'],
    ])
  })

  it('rellena las columnas que faltan y recorta las que sobran', () => {
    expect(parsearFilas('uno | dos\nuno | dos | tres | cuatro', COLS)).toEqual([
      ['uno', 'dos', ''],
      ['uno', 'dos', 'tres'],
    ])
  })

  it('salta el encabezado repetido, las líneas sin barras y las filas vacías', () => {
    expect(parsearFilas('A | B | C\nTexto suelto sin tabla\n | | \nuno | dos | tres', COLS)).toEqual([['uno', 'dos', 'tres']])
  })

  it('no devuelve más de 8 filas', () => {
    const muchas = Array.from({ length: 12 }, (_, i) => `f${i} | x | y`).join('\n')
    expect(parsearFilas(muchas, COLS)).toHaveLength(8)
  })
})

describe('aplicarTextos', () => {
  it('pone la declaración de la política en su sección y no toca las demás', () => {
    const original = secciones('politica')
    const nuevas = aplicarTextos(plantillaPorId('politica')!, original, { declaracion: 'En Marketino nos comprometemos…' })
    expect(contenido(nuevas, 'Declaración de la política de calidad').contenido).toBe('En Marketino nos comprometemos…')
    expect(contenido(nuevas, 'Preguntas guiadas')).toEqual(contenido(original, 'Preguntas guiadas'))
  })

  it('pone la declaración del alcance', () => {
    const nuevas = aplicarTextos(plantillaPorId('alcance')!, secciones('alcance'), { declaracion: 'El SGC comprende…' })
    expect(contenido(nuevas, 'Declaración del alcance').contenido).toBe('El SGC comprende…')
  })

  it('si la IA no devolvió un campo, la sección queda como estaba (pendiente)', () => {
    const original = secciones('politica')
    expect(aplicarTextos(plantillaPorId('politica')!, original, {})).toEqual(original)
  })

  it('no modifica las secciones originales', () => {
    const original = secciones('politica')
    const copia = JSON.parse(JSON.stringify(original))
    aplicarTextos(plantillaPorId('politica')!, original, { declaracion: 'x' })
    expect(original).toEqual(copia)
  })

  it('los objetivos llenan la matriz y el plan, con el mismo ID en cada fila', () => {
    const nuevas = aplicarTextos(plantillaPorId('objetivos')!, secciones('objetivos'), {
      matriz: 'Entregar a tiempo | Pedidos a tiempo ÷ pedidos × 100 | ≥ 95 % (propuesta) | Logística | Mensual\nReducir defectos | Defectos ÷ unidades × 100 | ≤ 2 % (propuesta) | Calidad | Mensual',
      plan: 'Revisar el programa cada semana | ERP | Logística | 31/12/2026 | Programa de entregas\nInspeccionar en proceso | Instrumentos | Calidad | 31/03/2027 | Registros',
    })
    const matriz = contenido(nuevas, 'Matriz de objetivos').filas!
    expect(matriz[0]).toEqual(['ID', 'Objetivo', 'Indicador / fórmula', 'Meta', 'Responsable', 'Frecuencia'])
    expect(matriz[1]).toEqual(['OC-01', 'Entregar a tiempo', 'Pedidos a tiempo ÷ pedidos × 100', '≥ 95 % (propuesta)', 'Logística', 'Mensual'])
    expect(matriz[2][0]).toBe('OC-02')
    const plan = contenido(nuevas, 'Plan para alcanzar los objetivos').filas!
    expect(plan[1]).toEqual(['OC-01', 'Revisar el programa cada semana', 'ERP', 'Logística', '31/12/2026', 'Programa de entregas'])
    expect(plan).toHaveLength(3)
  })

  it('si el texto de la matriz no se puede leer como filas, deja la tabla como estaba', () => {
    const original = secciones('objetivos')
    const nuevas = aplicarTextos(plantillaPorId('objetivos')!, original, { matriz: 'Texto sin estructura de tabla.' })
    expect(contenido(nuevas, 'Matriz de objetivos')).toEqual(contenido(original, 'Matriz de objetivos'))
  })
})
