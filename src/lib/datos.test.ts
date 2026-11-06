import { describe, expect, it, vi } from 'vitest'
import type { Documento, EntradaHistorial, Notificacion, Proceso, Tarea } from '../types'
import {
  cargarFilasSesion,
  combinarDatosSesion,
  formatearFecha,
  iniciales,
  type ClienteDatos,
  type DatosDemo,
  type FilasSesion,
} from './datos'

const C1 = '11111111-0000-0000-0000-000000000001'
const E1 = '22222222-0000-0000-0000-000000000001'
const E2 = '22222222-0000-0000-0000-000000000002'
const P1 = '33333333-0000-0000-0000-000000000001'
const P2 = '33333333-0000-0000-0000-000000000002'
const ANA = 'aaaaaaaa-0000-0000-0000-000000000002'
const ROBERTO = 'aaaaaaaa-0000-0000-0000-000000000003'
const CARLOS = 'aaaaaaaa-0000-0000-0000-000000000005'

// Lo que devuelve la BD a un usuario que solo ve la empresa E1 y el proyecto P1.
function filasBase(): FilasSesion {
  return {
    consultorias: [
      {
        id: C1, nombre: 'COWIN Consultores', rfc: 'COW180101AB1', plan: 'Profesional', activa: true,
        contacto: 'Ana', email: 'ana@cowin.test', limite_usuarios: 20, almacenamiento_gb: 50,
        renovacion: null, creado_en: '2026-01-10T09:00:00+00:00',
      },
    ],
    empresas: [
      {
        id: E1, consultoria_id: C1, nombre: 'Marketino S.A. de C.V.', nombre_comercial: 'Marketino', rfc: null,
        sector: 'Marketing', tamano: 'Pequeña', trabajadores: '25', ciudad: 'Guadalajara', entidad_federativa: 'Jalisco',
        direccion: null, contacto_principal: 'Carlos', cargo_contacto: 'Director', email_contacto: 'carlos@marketino.test',
        telefono_contacto: null, procesos_principales: 'Ventas', alcance_inicial: null, norma_interes: 'ISO 9001:2026',
        consultor_asignado_id: ROBERTO, observaciones: null, activa: true, creado_en: '2026-09-01T12:00:00+00:00',
      },
    ],
    perfiles: [
      { id: ANA, nombre: 'Ana', email: 'ana@cowin.test', rol: 'admin_consultoria', consultoria_id: C1, empresa_id: null, cargo: 'Directora', activo: true, password_temporal: false },
      { id: ROBERTO, nombre: 'Roberto', email: 'roberto@cowin.test', rol: 'consultor', consultoria_id: C1, empresa_id: null, cargo: null, activo: true, password_temporal: false },
      { id: CARLOS, nombre: 'Carlos', email: 'carlos@marketino.test', rol: 'usuario_cliente', consultoria_id: C1, empresa_id: E1, cargo: 'Director', activo: true, password_temporal: false },
    ],
    proyectos: [
      {
        id: P1, consultoria_id: C1, empresa_id: E1, consultor_id: ROBERTO, nombre: 'SGC Marketino', objetivo: 'Implementar',
        alcance: null, descripcion: null, estado: 'Análisis de procesos', avance: 45, edicion_norma: 'ISO 9001:2026',
        fecha_inicio: '2026-09-01', fecha_fin_estimada: '2027-02-28', fecha_fin_real: null,
      },
    ],
    fases: [
      { id: 'f2', proyecto_id: P1, nombre: 'Levantamiento', estado: 'En curso', avance: 40, orden: 2 },
      { id: 'f1', proyecto_id: P1, nombre: 'Diagnóstico', estado: 'Completada', avance: 100, orden: 1 },
    ],
    miembros: [
      { proyecto_id: P1, usuario_id: ROBERTO },
      { proyecto_id: P1, usuario_id: CARLOS },
    ],
  }
}

// Datos de demo de DOS proyectos: P1 (visible) y P2 (de otra empresa, no visible).
function demoBase(): DatosDemo {
  return {
    procesos: [{ id: 'proc-p1', proyectoId: P1 }, { id: 'proc-p2', proyectoId: P2 }] as Proceso[],
    evidencias: [],
    documentos: [{ id: 'doc-p1', proyectoId: P1 }, { id: 'doc-p2', proyectoId: P2 }] as Documento[],
    tareas: [{ id: 'tar-p2', proyectoId: P2 }] as Tarea[],
    entregables: [],
    noConformidades: [],
    notificaciones: [
      { id: 'n-global' },
      { id: 'n-p1', proyectoId: P1 },
      { id: 'n-p2', proyectoId: P2 },
    ] as Notificacion[],
    historial: [
      { id: 'h-e1', entidadTipo: 'empresa', entidadId: E1 },
      { id: 'h-e2', entidadTipo: 'empresa', entidadId: E2 },
      { id: 'h-p2', entidadTipo: 'proyecto', entidadId: P2 },
      { id: 'h-doc-p1', entidadTipo: 'documento', entidadId: 'doc-p1' },
      { id: 'h-doc-p2', entidadTipo: 'documento', entidadId: 'doc-p2' },
    ] as EntradaHistorial[],
  }
}

const ids = (lista: { id: string }[]) => lista.map((item) => item.id)

describe('formatearFecha', () => {
  it('convierte fechas y timestamps de la BD al formato de la interfaz', () => {
    expect(formatearFecha('2026-09-01')).toBe('01/09/2026')
    expect(formatearFecha('2026-11-05T18:20:00.123+00:00')).toBe('05/11/2026')
  })

  it('devuelve vacío si no hay fecha', () => {
    expect(formatearFecha(null)).toBe('')
  })
})

describe('iniciales', () => {
  it('toma la inicial de las dos primeras palabras, o dos letras si es una sola', () => {
    expect(iniciales('Industrias Norte')).toBe('IN')
    expect(iniciales('Marketino')).toBe('MA')
  })
})

describe('combinarDatosSesion', () => {
  it('traduce la empresa y le asigna sus proyectos visibles', () => {
    const { empresas } = combinarDatosSesion(filasBase(), demoBase())

    expect(empresas).toHaveLength(1)
    expect(empresas[0]).toMatchObject({
      id: E1,
      nombre: 'Marketino S.A. de C.V.',
      nombreComercial: 'Marketino',
      rfc: '',
      estado: 'Jalisco',
      procesosprincipales: 'Ventas',
      consultorAsignadoId: ROBERTO,
      fechaAlta: '01/09/2026',
      logoInicial: 'MA',
      proyectosIds: [P1],
    })
  })

  it('traduce el proyecto con sus fases ordenadas y su equipo sin repetidos', () => {
    const { proyectos } = combinarDatosSesion(filasBase(), demoBase())

    expect(proyectos[0]).toMatchObject({
      id: P1,
      empresaId: E1,
      consultorId: ROBERTO,
      equipoIds: [ROBERTO, CARLOS],
      fechaInicio: '01/09/2026',
      fechaFinEstimada: '28/02/2027',
      descripcion: '',
    })
    expect(proyectos[0].fases.map((fase) => fase.id)).toEqual(['f1', 'f2'])
    expect(proyectos[0].alcance).toBeUndefined()
    expect(proyectos[0].fechaFinReal).toBeUndefined()
  })

  it('arma los usuarios desde los perfiles, con sus proyectos según el rol', () => {
    const { usuarios } = combinarDatosSesion(filasBase(), demoBase())
    const porId = Object.fromEntries(usuarios.map((usuario) => [usuario.id, usuario]))

    expect(porId[ANA]).toMatchObject({ rol: 'Admin Consultoría', consultoriaId: C1, proyectosAsignados: [P1] })
    expect(porId[ROBERTO]).toMatchObject({ rol: 'Consultor', cargo: '', proyectosAsignados: [P1] })
    expect(porId[CARLOS]).toMatchObject({ rol: 'Usuario Cliente', empresaId: E1, proyectosAsignados: [P1] })
  })

  it('traduce la consultoría', () => {
    const { consultorias } = combinarDatosSesion(filasBase(), demoBase())

    expect(consultorias).toEqual([
      expect.objectContaining({ id: C1, nombre: 'COWIN Consultores', limiteUsuarios: 20, fechaAlta: '10/01/2026' }),
    ])
  })

  it('descarta los datos de demo de proyectos que la BD no deja ver', () => {
    const datos = combinarDatosSesion(filasBase(), demoBase())

    expect(ids(datos.procesos)).toEqual(['proc-p1'])
    expect(ids(datos.documentos)).toEqual(['doc-p1'])
    expect(datos.tareas).toEqual([])
  })

  it('conserva las notificaciones generales y descarta las de proyectos no visibles', () => {
    const { notificaciones } = combinarDatosSesion(filasBase(), demoBase())

    expect(ids(notificaciones)).toEqual(['n-global', 'n-p1'])
  })

  it('filtra el historial según la entidad a la que se refiere', () => {
    const { historial } = combinarDatosSesion(filasBase(), demoBase())

    expect(ids(historial)).toEqual(['h-e1', 'h-doc-p1'])
  })
})

describe('cargarFilasSesion', () => {
  function crearClienteDoble(error: { message: string } | null = null) {
    const filas = filasBase()
    const porTabla: Record<string, unknown[]> = {
      consultorias: filas.consultorias,
      empresas: filas.empresas,
      perfiles: filas.perfiles,
      proyectos: filas.proyectos,
      fases: filas.fases,
      proyecto_miembros: filas.miembros,
    }
    const cliente = {
      from: vi.fn((tabla: string) => ({
        select: async (_columnas: string) =>
          error && tabla === 'proyectos' ? { data: null, error } : { data: porTabla[tabla], error: null },
      })),
    } satisfies ClienteDatos
    return cliente
  }

  it('lee las seis tablas y devuelve sus filas', async () => {
    const cliente = crearClienteDoble()

    const resultado = await cargarFilasSesion(cliente)

    expect(resultado).toEqual({ ok: true, filas: filasBase() })
    expect(cliente.from).toHaveBeenCalledTimes(6)
  })

  it('falla si alguna tabla no se pudo leer', async () => {
    const cliente = crearClienteDoble({ message: 'Failed to fetch' })

    expect(await cargarFilasSesion(cliente)).toEqual({ ok: false })
  })
})
