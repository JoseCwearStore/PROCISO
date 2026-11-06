import { describe, expect, it, vi } from 'vitest'
import type { Documento, Entregable, EntradaHistorial, IndicadorGestion, ListaVerificacion, NoConformidad, Notificacion, Tarea } from '../types'
import {
  cargarFilasSesion,
  combinarDatosSesion,
  formatearFecha,
  iniciales,
  type ClienteDatos,
  type FilasSesion,
} from './datos'

const C1 = '11111111-0000-0000-0000-000000000001'
const E1 = '22222222-0000-0000-0000-000000000001'
const P1 = '33333333-0000-0000-0000-000000000001'
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
      { id: 11, entidad_tipo: 'tarea', entidad_id: 'tar-p1', autor_id: CARLOS, accion: 'Cambio de estado', descripcion: 'Listo', estado_anterior: 'En proceso', estado_nuevo: 'En revisión', creado_en: '2024-09-12T10:00:00+00:00' },
      { id: 21, entidad_tipo: 'no_conformidad', entidad_id: 'nc-p1', autor_id: CARLOS, accion: 'Cambio de estado', descripcion: null, estado_anterior: 'En análisis', estado_nuevo: 'En corrección', creado_en: '2024-09-02T10:00:00+00:00' },
      { id: 20, entidad_tipo: 'no_conformidad', entidad_id: 'nc-p1', autor_id: CARLOS, accion: 'Tratamiento actualizado', descripcion: 'Corrección, análisis de causa y acción correctiva.', estado_anterior: null, estado_nuevo: null, creado_en: '2024-09-01T10:00:00+00:00' },
      { id: 10, entidad_tipo: 'tarea', entidad_id: 'tar-p1', autor_id: CARLOS, accion: 'Cambio de estado', descripcion: null, estado_anterior: 'Pendiente', estado_nuevo: 'En proceso', creado_en: '2024-09-11T10:00:00+00:00' },
    ],
    tareas: [
      {
        id: 'tar-p1', proyecto_id: P1, titulo: 'Cargar evidencias de compras', descripcion: 'Fotos del almacén',
        asignado_a: CARLOS, asignado_por: ROBERTO, estado: 'En revisión', prioridad: 'Alta',
        fecha_vencimiento: '2024-09-15', fecha_completada: null, dependencias: ['tar-p0'],
      },
    ],
    indicadores: [
      {
        id: 'in-sgc', ambito: 'SGC', empresa_id: E1, nombre: 'Quejas en 48 h', descripcion: '', formula: 'a / b',
        unidad: '%', frecuencia: 'Mensual', responsable_id: CARLOS, meta: '≥ 95 %', periodo: 'Octubre 2026', valor: '',
      },
    ],
    entregables: [
      {
        id: 'en-p1', proyecto_id: P1, nombre: 'Procedimiento de compras', tipo: 'Procedimiento', estado: 'Aprobado',
        fecha_entrega: '2024-09-30', fecha_aprobacion: '2024-10-02', aprobado_por: CARLOS, documento_id: 'doc-p1',
      },
    ],
    listas: [
      {
        id: 'lv-p1', proyecto_id: P1, proceso_id: PROC1, nombre: 'Revisión de compras', area: 'Compras',
        responsable_id: CARLOS, fecha: '2024-09-24', edicion_norma: 'ISO 9001:2026',
      },
    ],
    preguntas: [
      { id: 'pr-2', lista_id: 'lv-p1', orden: 2, pregunta: '¿Aplica?', estado: 'No aplica', referencia_requisito: '', evidencia_id: null, observaciones: '', justificacion_no_aplica: 'No subcontrata' },
      { id: 'pr-1', lista_id: 'lv-p1', orden: 1, pregunta: '¿Hay proveedores aprobados?', estado: 'Cumple según la evidencia revisada', referencia_requisito: '8.4', evidencia_id: 'ev-p1', observaciones: 'Lista vigente', justificacion_no_aplica: '' },
    ],
    noConformidades: [
      {
        id: 'nc-p1', proyecto_id: P1, folio: 'NC-001', titulo: 'Sin calibración', descripcion: 'No hay programa',
        tipo: 'Mayor', detectada_en: 'Levantamiento', fecha_deteccion: '2024-04-10', proceso_id: PROC1,
        evidencia_ids: ['ev-p1'], responsable_id: CARLOS, responsable_accion_id: null, fecha_limite: '2024-10-01',
        estado: 'En corrección', correccion_inmediata: 'Se retiró el equipo', analisis_causa: 'Sin responsable',
        accion_correctiva: 'Crear programa\n\nCapacitar', eficacia: 'Pendiente', verificacion_eficacia: '',
        fecha_cierre: null, observaciones: '',
      },
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
    comentarios: [
      { id: 'com-2', entidad_tipo: 'documento', entidad_id: 'doc-p1', seccion_id: 's1', autor_id: CARLOS, texto: 'Agregar el alcance', creado_en: '2024-07-20T10:00:00+00:00' },
      { id: 'com-1', entidad_tipo: 'documento', entidad_id: 'doc-p1', seccion_id: 's1', autor_id: ROBERTO, texto: 'Revisar redacción', creado_en: '2024-07-18T10:00:00+00:00' },
      { id: 'com-ev', entidad_tipo: 'evidencia', entidad_id: 'ev-p1', seccion_id: null, autor_id: ROBERTO, texto: 'Otra entidad', creado_en: '2024-07-19T10:00:00+00:00' },
      { id: 'com-t1', entidad_tipo: 'tarea', entidad_id: 'tar-p1', seccion_id: null, autor_id: CARLOS, texto: 'Listo', creado_en: '2024-09-12T10:00:00+00:00' },
    ],
    // Lo que devuelve mis_notificaciones(): ya calculado y filtrado por la BD.
    notificaciones: [
      {
        clave: 'tarea_vencida:tar-p1', tipo: 'error', titulo: 'Tarea vencida: Cargar evidencias de compras',
        descripcion: 'Venció el 30/09/2024 sin completarse.', fecha: '2024-10-01T10:00:00+00:00',
        pagina: 'tablero-tareas', proyecto_id: P1, entidad_tipo: 'tarea', entidad_id: 'tar-p1', leida: false,
      },
      {
        clave: 'h:9', tipo: 'warning', titulo: 'Documento con correcciones', descripcion: '"Manual" v1.0: corrección solicitada.',
        fecha: '2024-03-25T10:00:00+00:00', pagina: 'documentacion', proyecto_id: P1, entidad_tipo: 'documento',
        entidad_id: 'doc-p1', leida: true,
      },
    ],
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
    const { empresas } = combinarDatosSesion(filasBase())

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
    const { proyectos } = combinarDatosSesion(filasBase())

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
    const { usuarios } = combinarDatosSesion(filasBase())
    const porId = Object.fromEntries(usuarios.map((usuario) => [usuario.id, usuario]))

    expect(porId[ANA]).toMatchObject({ rol: 'Admin Consultoría', consultoriaId: C1, proyectosAsignados: [P1] })
    expect(porId[ROBERTO]).toMatchObject({ rol: 'Consultor', cargo: '', proyectosAsignados: [P1] })
    expect(porId[CARLOS]).toMatchObject({ rol: 'Usuario Cliente', empresaId: E1, proyectosAsignados: [P1] })
  })

  it('traduce la consultoría', () => {
    const { consultorias } = combinarDatosSesion(filasBase())

    expect(consultorias).toEqual([
      expect.objectContaining({ id: C1, nombre: 'COWIN Consultores', limiteUsuarios: 20, fechaAlta: '10/01/2026' }),
    ])
  })

  it('trae solo los documentos que la BD deja ver', () => {
    const datos = combinarDatosSesion(filasBase())

    expect(ids(datos.documentos)).toEqual(['doc-p1'])
  })

  it('traduce los indicadores; un valor vacío es "sin datos" (undefined), no "0"', () => {
    const { indicadores } = combinarDatosSesion(filasBase())

    expect(indicadores).toEqual<IndicadorGestion[]>([
      {
        id: 'in-sgc', ambito: 'SGC', empresaId: E1, nombre: 'Quejas en 48 h', descripcion: '', formula: 'a / b',
        unidad: '%', frecuencia: 'Mensual', responsableId: CARLOS, meta: '≥ 95 %', periodo: 'Octubre 2026', valor: undefined,
      },
    ])
  })

  it('traduce los entregables de la BD con su aprobación y su documento', () => {
    const { entregables } = combinarDatosSesion(filasBase())

    expect(entregables).toEqual<Entregable[]>([
      {
        id: 'en-p1', nombre: 'Procedimiento de compras', proyectoId: P1, tipo: 'Procedimiento', estado: 'Aprobado',
        fechaEntrega: '30/09/2024', fechaAprobacion: '02/10/2024', aprobadoPorId: CARLOS, documentoId: 'doc-p1',
      },
    ])
  })

  it('traduce las listas de verificación con su empresa y sus preguntas en orden', () => {
    const { listasVerificacion } = combinarDatosSesion(filasBase())

    expect(listasVerificacion).toEqual<ListaVerificacion[]>([
      {
        id: 'lv-p1',
        nombre: 'Revisión de compras',
        empresaId: E1,
        proyectoId: P1,
        procesoId: PROC1,
        area: 'Compras',
        responsableId: CARLOS,
        fecha: '24/09/2024',
        edicionNorma: 'ISO 9001:2026',
        preguntas: [
          { id: 'pr-1', pregunta: '¿Hay proveedores aprobados?', estado: 'Cumple según la evidencia revisada', referenciaRequisito: '8.4', evidenciaId: 'ev-p1', observaciones: 'Lista vigente', justificacionNoAplica: '' },
          { id: 'pr-2', pregunta: '¿Aplica?', estado: 'No aplica', referenciaRequisito: '', evidenciaId: undefined, observaciones: '', justificacionNoAplica: 'No subcontrata' },
        ],
      },
    ])
  })

  it('traduce las no conformidades de la BD con folio, empresa, acciones e historial', () => {
    const { noConformidades } = combinarDatosSesion(filasBase())

    expect(noConformidades).toEqual<NoConformidad[]>([
      {
        id: 'nc-p1',
        folio: 'NC-001',
        titulo: 'Sin calibración',
        descripcion: 'No hay programa',
        proyectoId: P1,
        empresaId: E1,
        procesoId: PROC1,
        evidenciaIds: ['ev-p1'],
        estado: 'En corrección',
        tipo: 'Mayor',
        detectadaEn: 'Levantamiento',
        fechaDeteccion: '10/04/2024',
        responsableId: CARLOS,
        responsableAccionId: undefined,
        fechaLimite: '01/10/2024',
        // La acción correctiva es texto libre: cada línea no vacía es una acción.
        acciones: ['Crear programa', 'Capacitar'],
        correccionInmediata: 'Se retiró el equipo',
        analisisCausa: 'Sin responsable',
        accionCorrectiva: 'Crear programa\n\nCapacitar',
        eficacia: 'Pendiente',
        verificacionEficacia: '',
        fechaCierre: undefined,
        observaciones: '',
        historial: [
          { id: '20', fecha: '01/09/2024', autorId: CARLOS, accion: 'Tratamiento actualizado', detalle: 'Corrección, análisis de causa y acción correctiva.' },
          { id: '21', fecha: '02/09/2024', autorId: CARLOS, accion: 'Cambio de estado', detalle: 'En análisis → En corrección' },
        ],
      },
    ])
  })

  it('traduce las tareas de la BD con su historial y comentarios ordenados', () => {
    const { tareas } = combinarDatosSesion(filasBase())

    expect(tareas).toEqual<Tarea[]>([
      {
        id: 'tar-p1',
        titulo: 'Cargar evidencias de compras',
        descripcion: 'Fotos del almacén',
        proyectoId: P1,
        asignadoAId: CARLOS,
        asignadoPorId: ROBERTO,
        estado: 'En revisión',
        prioridad: 'Alta',
        fechaVencimiento: '15/09/2024',
        fechaCompletada: undefined,
        dependencias: ['tar-p0'],
        comentarios: [{ id: 'com-t1', autorId: CARLOS, fecha: '12/09/2024', texto: 'Listo' }],
        historial: [
          { fecha: '11/09/2024', autorId: CARLOS, de: 'Pendiente', a: 'En proceso' },
          { fecha: '12/09/2024', autorId: CARLOS, de: 'En proceso', a: 'En revisión' },
        ],
      },
    ])
  })

  it('traduce los procesos de la BD con sus actividades ordenadas y sus vínculos', () => {
    const { procesos } = combinarDatosSesion(filasBase())

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
    const { evidencias } = combinarDatosSesion(filasBase())

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
    const { documentos } = combinarDatosSesion(filasBase())

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
      comentarios: [
        { id: 'com-1', seccionId: 's1', autorId: ROBERTO, fecha: '18/07/2024', texto: 'Revisar redacción' },
        { id: 'com-2', seccionId: 's1', autorId: CARLOS, fecha: '20/07/2024', texto: 'Agregar el alcance' },
      ],
      historialVersiones: [
        { version: '0.9', fecha: '01/06/2024', autorId: ROBERTO, comentario: 'Borrador inicial', motivo: 'Creación' },
        { version: '1.0', fecha: '15/07/2024', autorId: ROBERTO, comentario: 'Con comentarios del cliente', estado: 'Pendiente de revisión' },
      ],
      historial: [{ id: '9', fecha: '25/03/2024', autorId: ROBERTO, accion: 'Enviado a revisión', detalle: 'Versión 1.0' }],
    })
    expect(documentos[0].aprobadoPorId).toBeUndefined()
  })

  it('traduce las notificaciones calculadas por la BD (la clave es el id)', () => {
    const { notificaciones } = combinarDatosSesion(filasBase())

    expect(notificaciones).toEqual<Notificacion[]>([
      {
        id: 'tarea_vencida:tar-p1', tipo: 'error', titulo: 'Tarea vencida: Cargar evidencias de compras',
        descripcion: 'Venció el 30/09/2024 sin completarse.', fecha: '01/10/2024', leida: false,
        pagina: 'tablero-tareas', proyectoId: P1,
      },
      {
        id: 'h:9', tipo: 'warning', titulo: 'Documento con correcciones', descripcion: '"Manual" v1.0: corrección solicitada.',
        fecha: '25/03/2024', leida: true, pagina: 'documentacion', proyectoId: P1,
      },
    ])
  })

  it('arma la actividad con el historial real, del más nuevo al más viejo', () => {
    const { historial } = combinarDatosSesion(filasBase())

    expect(ids(historial)).toEqual(['11', '10', '21', '20', '9', '8', '7'])
    expect(historial[0]).toEqual<EntradaHistorial>({
      id: '11', fecha: '12/09/2024', autorId: CARLOS, accion: 'Cambio de estado', descripcion: 'Listo',
      entidadId: 'tar-p1', entidadTipo: 'tarea',
    })
    // Sin descripción, se explica con el cambio de estado.
    expect(historial[1].descripcion).toBe('Pendiente → En proceso')
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
      comentarios: filas.comentarios,
      tareas: filas.tareas,
      no_conformidades: filas.noConformidades,
      listas_verificacion: filas.listas,
      lista_preguntas: filas.preguntas,
      entregables: filas.entregables,
      indicadores: filas.indicadores,
    }
    const cliente = {
      from: vi.fn((tabla: string) => ({
        select: async (_columnas: string) =>
          error && tabla === 'proyectos' ? { data: null, error } : { data: porTabla[tabla], error: null },
      })),
      rpc: vi.fn(async (_funcion: 'mis_notificaciones') =>
        errorRpc ? { data: null, error: errorRpc } : { data: filas.notificaciones, error: null },
      ),
    } satisfies ClienteDatos
    return cliente
  }
  let errorRpc: { message: string } | null = null

  it('lee las veinte tablas y las notificaciones calculadas', async () => {
    errorRpc = null
    const cliente = crearClienteDoble()

    const resultado = await cargarFilasSesion(cliente)

    expect(resultado).toEqual({ ok: true, filas: filasBase() })
    expect(cliente.from).toHaveBeenCalledTimes(20)
    expect(cliente.rpc).toHaveBeenCalledWith('mis_notificaciones')
  })

  it('falla si alguna tabla no se pudo leer', async () => {
    errorRpc = null
    const cliente = crearClienteDoble({ message: 'Failed to fetch' })

    expect(await cargarFilasSesion(cliente)).toEqual({ ok: false })
  })

  it('falla si las notificaciones no se pudieron calcular', async () => {
    errorRpc = { message: 'permission denied for function mis_notificaciones' }
    const cliente = crearClienteDoble()

    expect(await cargarFilasSesion(cliente)).toEqual({ ok: false })
    errorRpc = null
  })
})
