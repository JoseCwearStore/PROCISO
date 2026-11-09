import { describe, expect, it } from 'vitest'
import type { Proceso } from '../types'
import { PENDIENTE, PLANTILLAS, crearSecciones, plantillaPorId, type ContextoPlantilla } from './plantillas'

function proceso(extra: Partial<Proceso> = {}): Proceso {
  return {
    id: 'p1',
    nombre: 'Fabricación de mobiliario',
    proyectoId: 'py1',
    responsableId: 'u1',
    estado: 'Aprobado',
    descripcion: 'Descripción',
    evidenciasIds: [],
    documentosIds: [],
    entradas: ['Orden de producción'],
    salidas: ['Mueble fabricado'],
    objetivo: 'Fabricar muebles conformes.',
    alcance: 'Desde la orden hasta la inspección.',
    puestoResponsable: 'Jefatura de Producción',
    clientes: ['Inspección final'],
    proveedores: ['Almacén'],
    equipos: ['Sierra', 'CNC'],
    registros: ['Registro de producción', 'Registro de inspección'],
    indicadores: ['Cumplimiento del programa', 'Rechazo interno'],
    riesgos: ['Material fuera de especificación'],
    controles: ['Autocontrol en proceso'],
    actividades: [
      { id: 'a2', tipo: 'Actividad', descripcion: 'Armar', entradas: 'Piezas', recursos: '', controles: '', resultado: 'Mueble armado', orden: 2, responsableId: 'u2' },
      { id: 'a1', tipo: 'Actividad', descripcion: 'Cortar', entradas: 'Madera', recursos: '', controles: '', resultado: 'Piezas cortadas', orden: 1, responsableId: 'u1' },
    ],
    ...extra,
  }
}

const contexto = (extra: Partial<ContextoPlantilla> = {}): ContextoPlantilla => ({
  codigo: 'SGC-TST-001',
  edicionNorma: 'ISO 9001:2026',
  nuevoId: (() => {
    let n = 0
    return () => `s${++n}`
  })(),
  ...extra,
})

const seccion = (secciones: ReturnType<typeof crearSecciones>, titulo: string) => {
  const s = secciones.find((item) => item.titulo === titulo)
  if (!s) throw new Error(`Falta la sección "${titulo}"`)
  return s
}

describe('catálogo de plantillas', () => {
  it('trae las plantillas del usuario con su código y su tipo de documento', () => {
    expect(PLANTILLAS.map((p) => [p.id, p.tipoDocumento, p.codigoBase])).toEqual([
      ['alcance', 'Alcance', 'SGC-ALC-001'],
      ['politica', 'Política', 'SGC-POL-001'],
      ['objetivos', 'Objetivos', 'SGC-OBJ-001'],
      ['mapa', 'Mapa de procesos', 'SGC-MAP-001'],
      ['ficha', 'Ficha de proceso', 'SGC-FCP-001'],
      ['procedimiento', 'Procedimiento', 'SGC-PR-IT-001'],
      ['instruccion', 'Instrucción de trabajo', 'SGC-PR-IT-001'],
      ['formato', 'Formato', 'FO-001'],
    ])
  })

  it('solo las fichas, procedimientos e instrucciones piden un proceso; el mapa pide los del proyecto', () => {
    expect(PLANTILLAS.filter((p) => p.requiereProceso).map((p) => p.id)).toEqual(['ficha', 'procedimiento', 'instruccion'])
    expect(PLANTILLAS.filter((p) => p.requiereProcesosDelProyecto).map((p) => p.id)).toEqual(['mapa'])
  })

  it('cada tabla declara sus columnas y los textos no', () => {
    for (const p of PLANTILLAS) {
      for (const s of p.secciones) {
        if (s.tipo === 'tabla') expect(s.columnas?.length, `${p.id} · ${s.titulo}`).toBeGreaterThanOrEqual(2)
        else expect(s.columnas, `${p.id} · ${s.titulo}`).toBeUndefined()
      }
    }
  })

  it('plantillaPorId devuelve la plantilla o undefined', () => {
    expect(plantillaPorId('politica')?.nombre).toBe('Política de calidad')
    expect(plantillaPorId('nada')).toBeUndefined()
  })
})

describe('crearSecciones', () => {
  it('la primera fila de cada tabla es su encabezado, y los ids no se repiten', () => {
    for (const p of PLANTILLAS) {
      const secciones = crearSecciones(p, contexto({ proceso: proceso(), procesos: [proceso()] }))
      expect(new Set(secciones.map((s) => s.id)).size).toBe(secciones.length)
      secciones.forEach((s, i) => {
        const plantilla = p.secciones[i]
        expect(s.titulo).toBe(plantilla.titulo)
        expect(s.tipo).toBe(plantilla.tipo)
        if (s.tipo === 'tabla') expect(s.filas?.[0], `${p.id} · ${s.titulo}`).toEqual(plantilla.columnas)
      })
    }
  })

  it('todas las filas de una tabla tienen el mismo ancho que su encabezado', () => {
    for (const p of PLANTILLAS) {
      for (const s of crearSecciones(p, contexto({ proceso: proceso(), procesos: [proceso()] }))) {
        if (s.tipo !== 'tabla') continue
        const ancho = s.filas?.[0].length
        expect(s.filas?.every((fila) => fila.length === ancho), `${p.id} · ${s.titulo}`).toBe(true)
      }
    }
  })

  it('el encabezado lleva código, edición de la norma y organización', () => {
    const secciones = crearSecciones(plantillaPorId('politica')!, contexto({ organizacion: 'Marketino' }))
    expect(secciones[0].contenido).toContain('Código: SGC-TST-001')
    expect(secciones[0].contenido).toContain('Referencia normativa: ISO 9001:2026')
    expect(secciones[0].contenido).toContain('Organización: Marketino')
  })

  it('la política nace con sus 6 preguntas guiadas y las respuestas vacías', () => {
    const tabla = seccion(crearSecciones(plantillaPorId('politica')!, contexto()), 'Preguntas guiadas')
    expect(tabla.filas?.[0]).toEqual(['Pregunta', 'Respuesta de la organización'])
    expect(tabla.filas).toHaveLength(7)
    expect(tabla.filas?.[1]).toEqual(['¿Qué productos o servicios ofrece la empresa?', ''])
  })

  it('sin datos, los textos quedan como pendientes y no se inventa nada', () => {
    const secciones = crearSecciones(plantillaPorId('alcance')!, contexto())
    expect(seccion(secciones, 'Declaración del alcance').contenido).toBe(PENDIENTE)
  })

  describe('ficha de caracterización', () => {
    const secciones = () => crearSecciones(plantillaPorId('ficha')!, contexto({ proceso: proceso(), nombreUsuario: (id) => (id === 'u1' ? 'Roberto' : 'Lucía') }))

    it('identifica el proceso con su nombre, objetivo y alcance', () => {
      const filas = seccion(secciones(), 'Identificación del proceso').filas!
      expect(filas).toContainEqual(['Nombre del proceso', 'Fabricación de mobiliario'])
      expect(filas).toContainEqual(['Objetivo', 'Fabricar muebles conformes.'])
      expect(filas).toContainEqual(['Alcance', 'Desde la orden hasta la inspección.'])
      expect(filas).toContainEqual(['Responsable / propietario', 'Jefatura de Producción'])
    })

    it('arma entradas, actividades y salidas con una fila por actividad, en orden', () => {
      const filas = seccion(secciones(), 'Entradas, actividades y salidas').filas!
      expect(filas).toHaveLength(3)
      expect(filas[1]).toEqual(['', 'Madera', 'Cortar', 'Piezas cortadas', ''])
      expect(filas[2]).toEqual(['', 'Piezas', 'Armar', 'Mueble armado', ''])
    })

    it('sin actividades, una fila resume las entradas, salidas, proveedores y clientes del proceso', () => {
      const s = crearSecciones(plantillaPorId('ficha')!, contexto({ proceso: proceso({ actividades: [] }) }))
      const filas = seccion(s, 'Entradas, actividades y salidas').filas!
      expect(filas).toHaveLength(2)
      expect(filas[1]).toEqual(['Almacén', 'Orden de producción', '', 'Mueble fabricado', 'Inspección final'])
    })

    it('lista los indicadores y los riesgos del proceso, una fila cada uno', () => {
      const s = secciones()
      expect(seccion(s, 'Indicadores de desempeño').filas!.slice(1).map((f) => f[0])).toEqual(['Cumplimiento del programa', 'Rechazo interno'])
      expect(seccion(s, 'Riesgos y oportunidades').filas!.slice(1).map((f) => f[0])).toEqual(['Material fuera de especificación'])
    })

    it('si el proceso no tiene indicadores deja una fila vacía para completar', () => {
      const s = crearSecciones(plantillaPorId('ficha')!, contexto({ proceso: proceso({ indicadores: [] }) }))
      expect(seccion(s, 'Indicadores de desempeño').filas).toHaveLength(2)
    })
  })

  describe('procedimiento', () => {
    it('numera los pasos con el orden de la actividad y pone al responsable por nombre', () => {
      const s = crearSecciones(
        plantillaPorId('procedimiento')!,
        contexto({ proceso: proceso(), nombreUsuario: (id) => (id === 'u1' ? 'Roberto' : 'Lucía') }),
      )
      const filas = seccion(s, 'Desarrollo del procedimiento').filas!
      expect(filas[0]).toEqual(['Paso', 'Actividad / descripción', 'Responsable', 'Registro / evidencia'])
      expect(filas[1]).toEqual(['1', 'Cortar', 'Roberto', ''])
      expect(filas[2]).toEqual(['2', 'Armar', 'Lucía', ''])
    })

    it('los registros del proceso pasan a la tabla de registros generados', () => {
      const s = crearSecciones(plantillaPorId('procedimiento')!, contexto({ proceso: proceso() }))
      expect(seccion(s, 'Registros generados').filas!.slice(1).map((f) => f[0])).toEqual(['Registro de producción', 'Registro de inspección'])
    })
  })

  describe('mapa de procesos', () => {
    it('arma la matriz de interacción con una fila por proceso del proyecto', () => {
      const otro = proceso({ id: 'p2', nombre: 'Compras', entradas: ['Requisición', 'Especificaciones'], salidas: ['Material aceptado'], clientes: [] })
      const s = crearSecciones(plantillaPorId('mapa')!, contexto({ procesos: [proceso(), otro] }))
      const filas = seccion(s, 'Matriz de interacción').filas!
      expect(filas[0]).toEqual(['Proceso', 'Entradas', 'Salidas', 'Cliente interno / externo', 'Procesos relacionados'])
      expect(filas[1]).toEqual(['Fabricación de mobiliario', 'Orden de producción', 'Mueble fabricado', 'Inspección final', ''])
      expect(filas[2]).toEqual(['Compras', 'Requisición; Especificaciones', 'Material aceptado', '', ''])
    })

    it('sin procesos deja una fila vacía', () => {
      const s = crearSecciones(plantillaPorId('mapa')!, contexto({ procesos: [] }))
      expect(seccion(s, 'Matriz de interacción').filas).toHaveLength(2)
    })
  })
})
