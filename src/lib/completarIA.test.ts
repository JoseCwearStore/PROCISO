import { describe, expect, it } from 'vitest'
import type { Proceso, SeccionDocumento } from '../types'
import { PENDIENTE, crearSecciones, plantillaPorId } from './plantillas'
import {
  aceptarSeccion, aplicarCompletado, camposCompletar, contextoDeProceso, contextoDelDocumento, cuantosHuecos, esCeldaSugerida,
  huecosDe, marcarSugeridas, quitarMarcaCelda, quitarMarcaTexto, sugerenciasPendientes, MAX_SECCIONES_POR_PEDIDO,
} from './completarIA'

const texto = (id: string, titulo: string, contenido: string): SeccionDocumento => ({ id, titulo, tipo: 'texto', contenido })
const tabla = (id: string, titulo: string, filas: string[][]): SeccionDocumento => ({ id, titulo, tipo: 'tabla', contenido: '', filas })

const PROCESO: Proceso = {
  id: 'p1', nombre: 'Gestión de compras', tipo: 'Apoyo', proyectoId: 'pr1', responsableId: 'u1', estado: 'Documentado', descripcion: 'Comprar insumos',
  evidenciasIds: [], documentosIds: [], entradas: ['Requisición'], salidas: ['Orden de compra'], objetivo: 'Comprar a tiempo', puestoResponsable: 'Jefe de compras',
  proveedores: ['Proveedores'], clientes: ['Almacén'], controles: ['Autorización de gerencia'], registros: ['Orden de compra'],
  actividades: [
    { id: 'a2', tipo: 'Actividad', descripcion: 'Cotizar', entradas: 'Requisición', recursos: 'Correo', controles: '3 cotizaciones', resultado: 'Cuadro comparativo', orden: 2, responsableId: 'u1' },
    { id: 'a1', tipo: 'Inicio', descripcion: 'Recibir requisición', entradas: '', recursos: '', controles: '', resultado: '', orden: 1 },
  ],
}

describe('huecosDe', () => {
  it('detecta textos pendientes, celdas vacías y tablas vacías', () => {
    const secciones = [
      texto('a', 'Objetivo', PENDIENTE),
      texto('b', 'Alcance', 'Todo el almacén'),
      tabla('c', 'Responsabilidades', [['Puesto', 'Responsabilidad'], ['Jefe', '']]),
      tabla('d', 'Definiciones', [['Término', 'Definición'], ['', '']]),
    ]
    expect(huecosDe(secciones)).toEqual([
      { seccionId: 'a', titulo: 'Objetivo', tipo: 'texto' },
      { seccionId: 'c', titulo: 'Responsabilidades', tipo: 'tabla', celdas: ['1:1'] },
      { seccionId: 'd', titulo: 'Definiciones', tipo: 'tabla', celdas: ['1:0', '1:1'], tablaVacia: true },
    ])
  })

  it('nunca propone nombres, fechas ni firmas, ni contesta las preguntas guiadas', () => {
    const secciones = [
      tabla('a', 'Aprobación', [['Elaboró', 'Revisó', 'Aprobó'], ['', '', '']]),
      tabla('b', 'Historial de cambios', [['Versión', 'Fecha', 'Descripción', 'Responsable'], ['00', '', 'Emisión', '']]),
      tabla('c', 'Preguntas guiadas', [['Pregunta', 'Respuesta de la organización'], ['¿Qué ofrece?', '']]),
      tabla('d', 'Registro de ejecución', [['Fecha', 'Persona que ejecuta'], ['', '']]),
      tabla('e', 'Criterios de verificación', [['Criterio', 'Resultado', 'Observaciones'], ['', '', '']]),
    ]
    const huecos = huecosDe(secciones)
    expect(huecos.map((h) => h.seccionId)).toEqual(['e'])
    // En los criterios solo la columna «Criterio»: el resultado se llena al usar el formato.
    expect(huecos[0].celdas).toEqual(['1:0'])
  })

  it('cuenta los datos que faltan para el botón', () => {
    expect(cuantosHuecos(huecosDe([texto('a', 'X', ''), tabla('b', 'Y', [['A', 'B'], ['1', ''], ['', '']])]))).toBe(4)
  })

  it('la ficha de un proceso recién generada tiene huecos que la IA puede proponer', () => {
    const plantilla = plantillaPorId('ficha')!
    const secciones = crearSecciones(plantilla, { codigo: 'SGC-FCP-001', edicionNorma: 'ISO 9001:2026', organizacion: 'Marketino', proceso: PROCESO })
    const titulos = huecosDe(secciones).map((h) => h.titulo)
    expect(titulos).toContain('Responsabilidades')
    expect(titulos).toContain('Seguimiento y aprobación')
  })
})

describe('camposCompletar', () => {
  it('pide un campo por sección, con instrucciones de tabla y columnas bloqueadas', () => {
    const secciones = [texto('a', 'Objetivo', ''), tabla('b', 'Criterios de verificación', [['Criterio', 'Resultado'], ['', '']])]
    const campos = camposCompletar(secciones, huecosDe(secciones), 'Verificar compras')
    expect(campos.map((c) => c.id)).toEqual(['s1', 's2'])
    expect(campos[0].instruccion).toContain('«Objetivo»')
    expect(campos[1].instruccion).toContain('Criterio | Resultado')
    expect(campos[1].instruccion).toContain('Deja VACÍAS las columnas «Resultado»')
    expect(campos.every((c) => c.instruccion.length <= 1500)).toBe(true)
  })

  it('no pide más secciones de las permitidas por pedido', () => {
    const secciones = Array.from({ length: 14 }, (_, i) => texto(`t${i}`, `Sección ${i}`, ''))
    expect(camposCompletar(secciones, huecosDe(secciones))).toHaveLength(MAX_SECCIONES_POR_PEDIDO)
  })
})

describe('contexto', () => {
  it('el proceso levantado viaja como pares pregunta/respuesta, con las actividades en orden', () => {
    const pares = contextoDeProceso(PROCESO, (id) => (id === 'u1' ? 'Roberto' : ''))
    expect(pares.find((p) => p.pregunta === 'Puesto responsable')?.respuesta).toBe('Jefe de compras')
    const secuencia = pares.find((p) => p.pregunta === 'Secuencia de actividades')!.respuesta
    expect(secuencia.indexOf('1. Recibir requisición')).toBeLessThan(secuencia.indexOf('2. Cotizar'))
    expect(secuencia).toContain('responsable: Roberto')
    expect(pares.every((p) => p.respuesta.length <= 1900)).toBe(true)
  })

  it('sin proceso no hay contexto de proceso', () => {
    expect(contextoDeProceso(undefined)).toEqual([])
  })

  it('el documento aporta solo lo que ya tiene escrito', () => {
    const pares = contextoDelDocumento([texto('a', 'Objetivo', 'Comprar a tiempo'), texto('b', 'Alcance', PENDIENTE), tabla('c', 'Vacía', [['A']])])
    expect(pares).toEqual([{ pregunta: 'Sección «Objetivo» (contenido actual)', respuesta: 'Comprar a tiempo' }])
  })
})

describe('aplicarCompletado', () => {
  const base = [
    texto('a', 'Objetivo', PENDIENTE),
    tabla('b', 'Responsabilidades', [['Puesto', 'Responsabilidad'], ['Jefe de compras', '']]),
    tabla('c', 'Definiciones', [['Término', 'Definición'], ['', '']]),
  ]
  const huecos = huecosDe(base)

  it('llena solo los huecos, marca lo propuesto y no toca lo que ya estaba escrito', () => {
    const { secciones, propuestos } = aplicarCompletado(base, huecos, {
      s1: 'Asegurar compras oportunas.',
      s2: 'OTRO PUESTO | Autoriza las compras',
      s3: 'OC | Orden de compra\nRQ | Requisición',
    })
    expect(secciones[0]).toMatchObject({ contenido: 'Asegurar compras oportunas.', sugeridoIA: { contenido: true } })
    expect(secciones[1].filas).toEqual([['Puesto', 'Responsabilidad'], ['Jefe de compras', 'Autoriza las compras']])
    expect(esCeldaSugerida(secciones[1], 1, 1)).toBe(true)
    expect(esCeldaSugerida(secciones[1], 1, 0)).toBe(false)
    expect(secciones[2].filas).toEqual([['Término', 'Definición'], ['OC', 'Orden de compra'], ['RQ', 'Requisición']])
    expect(propuestos).toBe(6)
    expect(sugerenciasPendientes(secciones)).toBe(6)
    // No modifica las originales.
    expect(base[0].contenido).toBe(PENDIENTE)
  })

  it('lo que la IA dejó [por confirmar] sigue pendiente', () => {
    const { secciones, propuestos } = aplicarCompletado(base, huecos, { s1: '[por confirmar]', s2: 'x | [por confirmar]' })
    expect(secciones[0].contenido).toBe(PENDIENTE)
    expect(secciones[1].filas?.[1][1]).toBe('')
    expect(propuestos).toBe(0)
  })

  it('en una tabla nueva deja vacías las columnas que llena una persona', () => {
    const formato = [tabla('f', 'Criterios de verificación', [['Criterio', 'Resultado', 'Observaciones'], ['', '', '']])]
    const { secciones } = aplicarCompletado(formato, huecosDe(formato), { s1: 'Cotizaciones completas | Cumple | Ok\nOrden autorizada | Cumple | Ok' })
    expect(secciones[0].filas).toEqual([['Criterio', 'Resultado', 'Observaciones'], ['Cotizaciones completas', '', ''], ['Orden autorizada', '', '']])
  })

  it('si la IA no devolvió nada útil, la sección queda igual', () => {
    const { secciones } = aplicarCompletado(base, huecos, { s2: 'texto sin columnas' })
    expect(secciones).toEqual(base)
  })
})

describe('revisión humana', () => {
  const sugerida: SeccionDocumento = { ...tabla('t', 'T', [['A', 'B'], ['1', '2'], ['3', '4']]), sugeridoIA: { celdas: ['1:1', '2:0'] } }

  it('editar una celda sugerida la da por revisada', () => {
    const editada = quitarMarcaCelda(sugerida, 1, 1)
    expect(editada.sugeridoIA?.celdas).toEqual(['2:0'])
    expect(quitarMarcaCelda(editada, 2, 0)).not.toHaveProperty('sugeridoIA')
  })

  it('editar el texto quita su marca', () => {
    expect(quitarMarcaTexto({ ...texto('x', 'X', 'hola'), sugeridoIA: { contenido: true } })).not.toHaveProperty('sugeridoIA')
  })

  it('aceptar una sección quita todas sus marcas', () => {
    expect(aceptarSeccion(sugerida)).not.toHaveProperty('sugeridoIA')
    expect(sugerenciasPendientes([sugerida, aceptarSeccion(sugerida)])).toBe(2)
  })

  it('marca como sugerido lo que redactó la generación clásica', () => {
    const antes = [texto('a', 'Declaración', PENDIENTE), tabla('b', 'Matriz', [['ID', 'Objetivo'], ['', '']])]
    const despues = [texto('a', 'Declaración', 'Nos comprometemos…'), tabla('b', 'Matriz', [['ID', 'Objetivo'], ['OC-01', 'Entregar a tiempo']])]
    const marcadas = marcarSugeridas(antes, despues)
    expect(marcadas[0].sugeridoIA).toEqual({ contenido: true })
    expect(marcadas[1].sugeridoIA).toEqual({ celdas: ['1:0', '1:1'] })
  })
})
