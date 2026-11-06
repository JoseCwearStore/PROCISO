import { describe, expect, it, vi } from 'vitest'
import type { Documento, EntradaHistorial, Notificacion, Tarea } from '../types'
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
const PROC1 = '55555555-0000-0000-0000-000000000001'

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
    procesos: [
      {
        id: PROC1, proyecto_id: P1, responsable_id: CARLOS, nombre: 'Compras', descripcion: null, estado: 'Documentado',
        fecha_levantamiento: '2024-03-20', objetivo: 'Comprar bien', alcance: null, puesto_responsable: null,
        personal_involucrado: null, entradas: ['Requisición'], salidas: ['Orden'], proveedores: [], clientes: [],
        recursos_materiales: [], equipos: [], sistemas: [], controles: [], registros: [], indicadores: [], riesgos: [],
        problemas: [], observaciones: null, mejoras: null, no_aplica: { equipos: 'No usa equipos' },
      },
    ],
    actividades: [
      { id: 'act-2', proceso_id: PROC1, responsable_id: null, tipo: 'Fin', descripcion: 'Emitir orden', entradas: null, recursos: null, controles: null, resultado: 'Orden', orden: 2 },
      { id: 'act-1', proceso_id: PROC1, responsable_id: ROBERTO, tipo: 'Inicio', descripcion: 'Recibir requisición', entradas: 'Requisición', recursos: null, controles: null, resultado: null, orden: 1 },
    ],
    evidencias: [
      {
        id: 'ev-p1', proyecto_id: P1, proceso_id: PROC1, actividad_id: 'act-1', subido_por: CARLOS, nombre: 'Foto del almacén',
        tipo: 'Foto', estado: 'Revisada', descripcion: null, categoria: null, archivo_ruta: null, archivo_nombre: 'almacen.jpg',
        archivo_mime: 'image/jpeg', creado_en: '2024-03-22T18:00:00+00:00',
      },
    ],
    historial: [
      { id: 8, entidad_tipo: 'evidencia', entidad_id: 'ev-p1', autor_id: ROBERTO, accion: 'Cambio de estado', descripcion: null, estado_anterior: 'Revisada', estado_nuevo: 'Revisada', creado_en: '2024-03-24T10:00:00+00:00' },
      { id: 7, entidad_tipo: 'evidencia', entidad_id: 'ev-p1', autor_id: ROBERTO, accion: 'Cambio de estado', descripcion: 'Se ve bien', estado_anterior: 'Cargada', estado_nuevo: 'Revisada', creado_en: '2024-03-23T10:00:00+00:00' },
      { id: 9, entidad_tipo: 'documento', entidad_id: 'doc-p1', autor_id: ROBERTO, accion: 'Enviado a revisión', descripcion: 'Versión 1.0', estado_anterior: null, estado_nuevo: null, creado_en: '2024-03-25T10:00:00+00:00' },
    ],
    documentos: [
      {
        id: 'doc-p1', proyecto_id: P1, proceso_id: PROC1, nombre: 'Procedimiento de compras', tipo: 'Procedimiento',
        estado: 'Pendiente de revisión', version: '1.0', codigo: 'PRO-001', categoria: null, plantilla: null,
        secciones: [{ id: 's1', titulo: 'Objetivo', tipo: 'texto', contenido: 'Comprar bien' }],
        referencia_normativa: 'ISO 9001:2026', motivo_cambio: 'Creación', bloqueado: false, contenido_pendiente: false,
        creado_por: ROBERTO, revisado_por: null, aprobado_por: null, fecha_revision: null, fecha_aprobacion: null,
        creado_en: '2024-06-01T10:00:00+00:00', actualizado_en: '2024-07-15T10:00:00+00:00',
      },
    ],
    versiones: [
      { documento_id: 'doc-p1', version: '1.0', autor_id: ROBERTO, comentario: 'Con comentarios del cliente', motivo: null, secciones: [], estado: 'Pendiente de revisión', creado_en: '2024-07-15T10:00:00+00:00' },
      { documento_id: 'doc-p1', version: '0.9', autor_id: ROBERTO, comentario: 'Borrador inicial', motivo: 'Creación', secciones: [], estado: null, creado_en: '2024-06-01T10:00:00+00:00' },
    ],
    vinculos: [{ documento_id: 'doc-p1', evidencia_id: 'ev-p1' }],
  }
}

// Datos de demo de DOS proyectos: P1 (visible) y P2 (de otra empresa, no visible).
function demoBase(): DatosDemo {
  return {
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

    expect(ids(datos.documentos)).toEqual(['doc-p1'])
    expect(datos.tareas).toEqual([])
  })

  it('traduce los procesos de la BD con sus actividades ordenadas y sus vínculos', () => {
    const { procesos } = combinarDatosSesion(filasBase(), demoBase())

    expect(procesos).toHaveLength(1)
    expect(procesos[0]).toMatchObject({
      id: PROC1,
      proyectoId: P1,
      responsableId: CARLOS,
      descripcion: '',
      fechaLevantamiento: '20/03/2024',
      entradas: ['Requisición'],
      salidas: ['Orden'],
      noAplica: { equipos: 'No usa equipos' },
      evidenciasIds: ['ev-p1'],
      documentosIds: ['doc-p1'],
    })
    expect(procesos[0].alcance).toBeUndefined()
    expect(procesos[0].actividades).toEqual([
      { id: 'act-1', tipo: 'Inicio', responsableId: ROBERTO, descripcion: 'Recibir requisición', entradas: 'Requisición', recursos: '', controles: '', resultado: '', orden: 1 },
      { id: 'act-2', tipo: 'Fin', responsableId: undefined, descripcion: 'Emitir orden', entradas: '', recursos: '', controles: '', resultado: 'Orden', orden: 2 },
    ])
  })

  it('traduce las evidencias de la BD con su autor, empresa e historial en orden', () => {
    const { evidencias } = combinarDatosSesion(filasBase(), demoBase())

    expect(evidencias).toEqual([
      {
        id: 'ev-p1',
        nombre: 'Foto del almacén',
        tipo: 'Foto',
        procesoId: PROC1,
        actividadId: 'act-1',
        proyectoId: P1,
        empresaId: E1,
        estado: 'Revisada',
        descripcion: '',
        categoria: undefined,
        archivoNombre: 'almacen.jpg',
        archivoMime: 'image/jpeg',
        autor: 'Carlos',
        fechaCarga: '22/03/2024',
        fecha: '22/03/2024',
        historial: [
          { id: '7', fecha: '23/03/2024', autor: 'Roberto', estadoAnterior: 'Cargada', estadoNuevo: 'Revisada', comentario: 'Se ve bien' },
          { id: '8', fecha: '24/03/2024', autor: 'Roberto', estadoAnterior: 'Revisada', estadoNuevo: 'Revisada', comentario: undefined },
        ],
      },
    ])
  })

  it('traduce los documentos de la BD con versiones, evidencias vinculadas e historial', () => {
    const { documentos } = combinarDatosSesion(filasBase(), demoBase())

    expect(documentos).toHaveLength(1)
    expect(documentos[0]).toMatchObject({
      id: 'doc-p1',
      proyectoId: P1,
      procesoId: PROC1,
      empresaId: E1,
      estado: 'Pendiente de revisión',
      version: '1.0',
      codigo: 'PRO-001',
      creadoPorId: ROBERTO,
      fechaCreacion: '01/06/2024',
      fechaModificacion: '15/07/2024',
      secciones: [{ id: 's1', titulo: 'Objetivo', tipo: 'texto', contenido: 'Comprar bien' }],
      evidenciasVinculadas: ['ev-p1'],
      motivoCambio: 'Creación',
      bloqueado: false,
      comentarios: [],
      historialVersiones: [
        { version: '0.9', fecha: '01/06/2024', autorId: ROBERTO, comentario: 'Borrador inicial', motivo: 'Creación' },
        { version: '1.0', fecha: '15/07/2024', autorId: ROBERTO, comentario: 'Con comentarios del cliente', estado: 'Pendiente de revisión' },
      ],
      historial: [{ id: '9', fecha: '25/03/2024', autorId: ROBERTO, accion: 'Enviado a revisión', detalle: 'Versión 1.0' }],
    })
    expect(documentos[0].aprobadoPorId).toBeUndefined()
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
      procesos: filas.procesos,
      actividades: filas.actividades,
      evidencias: filas.evidencias,
      historial: filas.historial,
      documentos: filas.documentos,
      documento_versiones: filas.versiones,
      documento_evidencias: filas.vinculos,
    }
    const cliente = {
      from: vi.fn((tabla: string) => ({
        select: async (_columnas: string) =>
          error && tabla === 'proyectos' ? { data: null, error } : { data: porTabla[tabla], error: null },
      })),
    } satisfies ClienteDatos
    return cliente
  }

  it('lee las trece tablas y devuelve sus filas', async () => {
    const cliente = crearClienteDoble()

    const resultado = await cargarFilasSesion(cliente)

    expect(resultado).toEqual({ ok: true, filas: filasBase() })
    expect(cliente.from).toHaveBeenCalledTimes(13)
  })

  it('falla si alguna tabla no se pudo leer', async () => {
    const cliente = crearClienteDoble({ message: 'Failed to fetch' })

    expect(await cargarFilasSesion(cliente)).toEqual({ ok: false })
  })
})
