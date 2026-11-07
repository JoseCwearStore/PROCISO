import { describe, expect, it } from 'vitest'
import { crearServicioEscritura, type ClienteEscritura, type NuevaEmpresa, type DatosNC, type NuevaTarea, type NuevoProyecto } from './escrituras'
import type { FilaEmpresa, FilaEntregable, FilaIndicador, FilaNoConformidad, FilaProyecto, FilaTarea } from './datos'
import type { Documento, IndicadorGestion, ListaVerificacion, Proceso } from '../types'

const C1 = '11111111-0000-0000-0000-000000000001'
const E_NUEVA = '22222222-0000-0000-0000-0000000000aa'
const P_NUEVO = '33333333-0000-0000-0000-0000000000aa'
const ROBERTO = 'aaaaaaaa-0000-0000-0000-000000000003'

const NUEVA_EMPRESA: NuevaEmpresa = {
  nombre: 'Panadería La Espiga S.A.', nombreComercial: 'La Espiga', rfc: '', sector: 'Alimentos', tamano: 'Pequeña',
  ciudad: 'Puebla', estado: 'Puebla', direccion: '', contactoPrincipal: 'Rosa', cargoContacto: 'Dueña',
  emailContacto: 'rosa@espiga.test', telefonoContacto: '', procesosprincipales: 'Producción', alcanceInicial: '',
  normaInteres: 'ISO 9001:2026', consultorAsignadoId: '', observaciones: '', trabajadores: '12',
}

const FILA_EMPRESA: FilaEmpresa = {
  id: E_NUEVA, consultoria_id: C1, nombre: 'Panadería La Espiga S.A.', nombre_comercial: 'La Espiga', rfc: null,
  sector: 'Alimentos', tamano: 'Pequeña', trabajadores: '12', ciudad: 'Puebla', entidad_federativa: 'Puebla',
  direccion: null, contacto_principal: 'Rosa', cargo_contacto: 'Dueña', email_contacto: 'rosa@espiga.test',
  telefono_contacto: null, procesos_principales: 'Producción', alcance_inicial: null, norma_interes: 'ISO 9001:2026',
  consultor_asignado_id: null, observaciones: null, activa: true, creado_en: '2026-11-05T20:00:00+00:00',
}

const NUEVO_PROYECTO: NuevoProyecto = {
  nombre: 'SGC La Espiga', empresaId: E_NUEVA, consultorId: ROBERTO, edicionNorma: 'ISO 9001:2026',
  objetivo: 'Certificar', alcance: '', fechaInicio: '2026-11-10', fechaFinEstimada: '2027-05-31',
}

const FILA_PROYECTO: FilaProyecto = {
  id: P_NUEVO, consultoria_id: C1, empresa_id: E_NUEVA, consultor_id: ROBERTO, nombre: 'SGC La Espiga',
  objetivo: 'Certificar', alcance: null, descripcion: null, estado: 'Planificación', avance: 0,
  edicion_norma: 'ISO 9001:2026', fecha_inicio: '2026-11-10', fecha_fin_estimada: '2027-05-31', fecha_fin_real: null,
}

type Respuesta = { data: unknown; error: { code?: string; message: string } | null }

interface Llamada {
  tabla: string
  operacion: 'insert' | 'update' | 'rpc' | 'upload' | 'remove' | 'invoke'
  datos: Record<string, unknown>
  id?: string
}

type RespuestaStorage = { error: { message: string; statusCode?: string } | null }

// Doble del cliente: registra cada escritura y responde según "tabla.operacion".
function crearClienteDoble(
  respuestas: Record<string, Respuesta> = {},
  subida: RespuestaStorage = { error: null },
  funcion: { data: unknown; error: { message: string; status?: number } | null } = { data: {}, error: null },
) {
  const llamadas: Llamada[] = []
  const responder = (clave: string): Respuesta => respuestas[clave] ?? { data: {}, error: null }

  const cliente: ClienteEscritura = {
    from: (tabla) => ({
      insert: (datos) => {
        llamadas.push({ tabla, operacion: 'insert', datos })
        return { select: () => ({ single: async () => responder(`${tabla}.insert`) }) }
      },
      update: (datos) => ({
        eq: (_columna, id) => {
          llamadas.push({ tabla, operacion: 'update', datos, id })
          return { select: () => ({ single: async () => responder(`${tabla}.update`) }) }
        },
      }),
    }),
    rpc: async (funcion, args) => {
      llamadas.push({ tabla: funcion, operacion: 'rpc', datos: args })
      const { data, error } = responder(`${funcion}.rpc`)
      return { data, error }
    },
    functions: {
      invoke: async (nombre, opciones) => {
        llamadas.push({ tabla: nombre, operacion: 'invoke', datos: opciones.body })
        return funcion
      },
    },
    storage: {
      from: (bucket) => ({
        upload: async (ruta, _archivo, opciones) => {
          llamadas.push({ tabla: bucket, operacion: 'upload', datos: { ruta, ...opciones } })
          return subida
        },
        remove: async (rutas) => {
          llamadas.push({ tabla: bucket, operacion: 'remove', datos: { rutas } })
          return { error: null }
        },
      }),
    },
  }
  return { cliente, llamadas }
}

const ERROR_RLS = { code: '42501', message: 'new row violates row-level security policy' }
const SIN_FILAS = { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }

describe('crearEmpresa', () => {
  it('inserta la empresa en la consultoría del usuario y devuelve la empresa traducida', async () => {
    const { cliente, llamadas } = crearClienteDoble({ 'empresas.insert': { data: FILA_EMPRESA, error: null } })
    const escrituras = crearServicioEscritura(cliente)

    const resultado = await escrituras.crearEmpresa(C1, NUEVA_EMPRESA)

    expect(llamadas).toEqual([
      {
        tabla: 'empresas',
        operacion: 'insert',
        datos: expect.objectContaining({
          consultoria_id: C1,
          nombre: 'Panadería La Espiga S.A.',
          nombre_comercial: 'La Espiga',
          entidad_federativa: 'Puebla',
          procesos_principales: 'Producción',
          // Los campos vacíos del formulario se guardan como NULL, no como ''.
          rfc: null,
          consultor_asignado_id: null,
        }),
      },
    ])
    expect(resultado).toEqual({
      ok: true,
      valor: expect.objectContaining({ id: E_NUEVA, logoInicial: 'LE', proyectosIds: [], fechaAlta: '05/11/2026' }),
    })
  })

  it('no intenta guardar si el usuario no pertenece a una consultoría', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.crearEmpresa(null, NUEVA_EMPRESA)).toEqual({ ok: false, error: 'sin_consultoria' })
    expect(llamadas).toHaveLength(0)
  })

  it('traduce el rechazo del RLS a "sin permiso"', async () => {
    const { cliente } = crearClienteDoble({ 'empresas.insert': { data: null, error: ERROR_RLS } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.crearEmpresa(C1, NUEVA_EMPRESA)).toEqual({ ok: false, error: 'sin_permiso' })
  })

  it('informa otras fallas como error del servicio', async () => {
    const { cliente } = crearClienteDoble({ 'empresas.insert': { data: null, error: { message: 'Failed to fetch' } } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.crearEmpresa(C1, NUEVA_EMPRESA)).toEqual({ ok: false, error: 'servicio' })
  })
})

describe('archivarEmpresa', () => {
  it('marca la empresa como inactiva', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.archivarEmpresa(E_NUEVA)).toEqual({ ok: true, valor: undefined })
    expect(llamadas).toEqual([{ tabla: 'empresas', operacion: 'update', datos: { activa: false }, id: E_NUEVA }])
  })

  it('trata "ninguna fila actualizada" como falta de permiso (el RLS la ocultó)', async () => {
    const { cliente } = crearClienteDoble({ 'empresas.update': { data: null, error: SIN_FILAS } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.archivarEmpresa(E_NUEVA)).toEqual({ ok: false, error: 'sin_permiso' })
  })
})

describe('crearProyecto', () => {
  it('inserta el proyecto y suma al consultor como miembro para que pueda verlo', async () => {
    const { cliente, llamadas } = crearClienteDoble({ 'proyectos.insert': { data: FILA_PROYECTO, error: null } })
    const escrituras = crearServicioEscritura(cliente)

    const resultado = await escrituras.crearProyecto(C1, NUEVO_PROYECTO)

    expect(llamadas).toEqual([
      {
        tabla: 'proyectos',
        operacion: 'insert',
        datos: expect.objectContaining({
          consultoria_id: C1,
          empresa_id: E_NUEVA,
          consultor_id: ROBERTO,
          fecha_inicio: '2026-11-10',
          alcance: null,
        }),
      },
      {
        tabla: 'proyecto_miembros',
        operacion: 'insert',
        datos: { proyecto_id: P_NUEVO, usuario_id: ROBERTO, consultoria_id: C1 },
      },
    ])
    expect(resultado).toEqual({
      ok: true,
      valor: expect.objectContaining({ id: P_NUEVO, estado: 'Planificación', equipoIds: [ROBERTO], fechaInicio: '10/11/2026' }),
    })
  })

  it('no suma miembros si el proyecto no se pudo crear', async () => {
    const { cliente, llamadas } = crearClienteDoble({ 'proyectos.insert': { data: null, error: ERROR_RLS } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.crearProyecto(C1, NUEVO_PROYECTO)).toEqual({ ok: false, error: 'sin_permiso' })
    expect(llamadas.map((l) => l.tabla)).toEqual(['proyectos'])
  })
})

describe('guardarProceso', () => {
  const PROCESO: Proceso = {
    id: '55555555-0000-0000-0000-0000000000aa', nombre: 'Compras', proyectoId: P_NUEVO, responsableId: ROBERTO,
    estado: 'En levantamiento', descripcion: 'Comprar bien', fechaLevantamiento: '05/11/2026',
    evidenciasIds: ['ev-1'], documentosIds: [], entradas: ['Requisición'], salidas: [], objetivo: 'Comprar bien',
    proveedores: ['Papelería'], noAplica: { equipos: 'No aplica' },
    actividades: [
      { id: 'a1', tipo: 'Inicio', responsableId: ROBERTO, descripcion: 'Recibir', entradas: '', recursos: '', controles: '', resultado: '', orden: 1 },
    ],
  }

  it('guarda el proceso y sus actividades en una sola llamada, en snake_case', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.guardarProceso(PROCESO)).toEqual({ ok: true, valor: undefined })
    expect(llamadas).toEqual([
      {
        tabla: 'guardar_proceso',
        operacion: 'rpc',
        datos: {
          p_proceso: expect.objectContaining({
            id: PROCESO.id,
            proyecto_id: P_NUEVO,
            responsable_id: ROBERTO,
            estado: 'En levantamiento',
            entradas: ['Requisición'],
            proveedores: ['Papelería'],
            // Las listas que el formulario no completó van vacías, no undefined.
            clientes: [],
            no_aplica: { equipos: 'No aplica' },
          }),
          p_actividades: [
            { id: 'a1', tipo: 'Inicio', responsable_id: ROBERTO, descripcion: 'Recibir', entradas: '', recursos: '', controles: '', resultado: '', orden: 1 },
          ],
        },
      },
    ])
  })

  it('traduce el rechazo del RLS a "sin permiso"', async () => {
    const { cliente } = crearClienteDoble({ 'guardar_proceso.rpc': { data: null, error: ERROR_RLS } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.guardarProceso(PROCESO)).toEqual({ ok: false, error: 'sin_permiso' })
  })
})

describe('revisarEvidencia', () => {
  const EVIDENCIA = '44444444-0000-0000-0000-000000000001'

  it('cambia el estado con un comentario en una sola llamada', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.revisarEvidencia(EVIDENCIA, 'Requiere corrección', 'Está borrosa')).toEqual({ ok: true, valor: undefined })
    expect(llamadas).toEqual([
      {
        tabla: 'revisar_evidencia',
        operacion: 'rpc',
        datos: { p_id: EVIDENCIA, p_estado: 'Requiere corrección', p_comentario: 'Está borrosa' },
      },
    ])
  })

  it('manda el comentario como null si no hay', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    await escrituras.revisarEvidencia(EVIDENCIA, 'Aceptada')

    expect(llamadas[0].datos).toEqual({ p_id: EVIDENCIA, p_estado: 'Aceptada', p_comentario: null })
  })

  it('traduce el rechazo del RLS a "sin permiso"', async () => {
    const { cliente } = crearClienteDoble({ 'revisar_evidencia.rpc': { data: null, error: ERROR_RLS } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.revisarEvidencia(EVIDENCIA, 'Aceptada')).toEqual({ ok: false, error: 'sin_permiso' })
  })
})

describe('subirEvidencia', () => {
  const ID = '44444444-0000-0000-0000-0000000000aa'
  const archivo = (nombre: string, tipo = 'image/jpeg') => new File(['contenido'], nombre, { type: tipo })
  const RUTA = `${C1}/${E_NUEVA}/${P_NUEVO}/${ID}.jpg`
  const NUEVA = {
    id: ID, consultoriaId: C1, empresaId: E_NUEVA, proyectoId: P_NUEVO, procesoId: '55555555-0000-0000-0000-000000000001',
    actividadId: '', nombre: 'Foto del almacén', descripcion: 'Vista general', categoria: 'Instalaciones', autor: 'Carlos',
  }
  const FILA_EVIDENCIA = {
    id: ID, proyecto_id: P_NUEVO, proceso_id: NUEVA.procesoId, actividad_id: null, subido_por: 'u', nombre: 'Foto del almacén',
    tipo: 'Foto', estado: 'Cargada', descripcion: 'Vista general', categoria: 'Instalaciones', archivo_ruta: RUTA,
    archivo_nombre: 'Almacén.JPG', archivo_mime: 'image/jpeg', creado_en: '2026-11-06T10:00:00+00:00',
  }

  it('sube el archivo a la ruta de su proyecto y registra la evidencia con esa ruta', async () => {
    const { cliente, llamadas } = crearClienteDoble({ 'evidencias.insert': { data: FILA_EVIDENCIA, error: null } })
    const escrituras = crearServicioEscritura(cliente)

    const resultado = await escrituras.subirEvidencia(NUEVA, archivo('Almacén.JPG'))

    expect(llamadas).toEqual([
      { tabla: 'evidencias', operacion: 'upload', datos: { ruta: RUTA, contentType: 'image/jpeg' } },
      {
        tabla: 'evidencias',
        operacion: 'insert',
        datos: expect.objectContaining({
          id: ID, consultoria_id: C1, proyecto_id: P_NUEVO, proceso_id: NUEVA.procesoId, actividad_id: null,
          tipo: 'Foto', estado: 'Cargada', archivo_ruta: RUTA, archivo_nombre: 'Almacén.JPG', archivo_mime: 'image/jpeg',
          archivo_tamano: 9,
        }),
      },
    ])
    expect(resultado).toEqual({
      ok: true,
      valor: expect.objectContaining({ id: ID, archivoRuta: RUTA, autor: 'Carlos', empresaId: E_NUEVA, estado: 'Cargada' }),
    })
  })

  it('deduce el tipo de evidencia por el tipo de archivo', async () => {
    const { cliente, llamadas } = crearClienteDoble({ 'evidencias.insert': { data: FILA_EVIDENCIA, error: null } })
    const escrituras = crearServicioEscritura(cliente)

    await escrituras.subirEvidencia(NUEVA, archivo('acta.pdf', 'application/pdf'))

    expect(llamadas[0].datos.ruta).toBe(`${C1}/${E_NUEVA}/${P_NUEVO}/${ID}.pdf`)
    expect(llamadas[1].datos).toEqual(expect.objectContaining({ tipo: 'Documento' }))
  })

  it('no sube nada si el usuario no pertenece a una consultoría', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.subirEvidencia({ ...NUEVA, consultoriaId: null }, archivo('a.jpg'))).toEqual({
      ok: false,
      error: 'sin_consultoria',
    })
    expect(llamadas).toHaveLength(0)
  })

  it.each([
    [{ message: 'The object exceeded the maximum allowed size', statusCode: '413' }, 'archivo_grande'],
    [{ message: 'mime type text/x-sh is not supported', statusCode: '415' }, 'tipo_no_permitido'],
    [{ message: 'new row violates row-level security policy', statusCode: '403' }, 'sin_permiso'],
    [{ message: 'Failed to fetch' }, 'servicio'],
  ] as const)('si Storage rechaza la subida (%o) informa "%s" y no registra nada', async (error, esperado) => {
    const { cliente, llamadas } = crearClienteDoble({}, { error })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.subirEvidencia(NUEVA, archivo('a.jpg'))).toEqual({ ok: false, error: esperado })
    expect(llamadas.map((l) => l.operacion)).toEqual(['upload'])
  })

  it('si no se puede registrar la evidencia, borra el archivo que acaba de subir', async () => {
    const { cliente, llamadas } = crearClienteDoble({ 'evidencias.insert': { data: null, error: ERROR_RLS } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.subirEvidencia(NUEVA, archivo('a.jpg'))).toEqual({ ok: false, error: 'sin_permiso' })
    expect(llamadas.map((l) => l.operacion)).toEqual(['upload', 'insert', 'remove'])
    expect(llamadas[2].datos).toEqual({ rutas: [`${C1}/${E_NUEVA}/${P_NUEVO}/${ID}.jpg`] })
  })
})

describe('guardarDocumento', () => {
  const DOCUMENTO: Documento = {
    id: '66666666-0000-0000-0000-0000000000aa', nombre: 'Procedimiento de compras', tipo: 'Procedimiento', proyectoId: P_NUEVO,
    procesoId: '55555555-0000-0000-0000-000000000001', estado: 'Pendiente de revisión', version: '0.1',
    fechaCreacion: '06/11/2026', fechaModificacion: '06/11/2026', creadoPorId: ROBERTO, historialVersiones: [],
    codigo: 'PRO-001', secciones: [{ id: 's1', titulo: 'Objetivo', tipo: 'texto', contenido: 'Comprar bien' }],
    evidenciasVinculadas: ['44444444-0000-0000-0000-000000000001'], motivoCambio: 'Creación',
    referenciaNormativa: 'ISO 9001:2026',
  }

  it('guarda documento, versión y evento en una sola llamada, en snake_case', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    const resultado = await escrituras.guardarDocumento(DOCUMENTO, {
      version: { version: '0.1', comentario: 'Primer envío', motivo: 'Creación' },
      evento: { accion: 'Enviado a revisión', detalle: 'Versión 0.1' },
    })

    expect(resultado).toEqual({ ok: true, valor: undefined })
    expect(llamadas).toEqual([
      {
        tabla: 'guardar_documento',
        operacion: 'rpc',
        datos: {
          p_documento: expect.objectContaining({
            id: DOCUMENTO.id,
            proyecto_id: P_NUEVO,
            proceso_id: DOCUMENTO.procesoId,
            estado: 'Pendiente de revisión',
            codigo: 'PRO-001',
            secciones: DOCUMENTO.secciones,
            evidencias: ['44444444-0000-0000-0000-000000000001'],
            motivo_cambio: 'Creación',
            referencia_normativa: 'ISO 9001:2026',
          }),
          p_version: { version: '0.1', comentario: 'Primer envío', motivo: 'Creación' },
          p_evento: { accion: 'Enviado a revisión', detalle: 'Versión 0.1' },
        },
      },
    ])
  })

  it('manda versión y evento como null si no hay', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    await escrituras.guardarDocumento({ ...DOCUMENTO, evidenciasVinculadas: undefined })

    expect(llamadas[0].datos).toEqual(
      expect.objectContaining({ p_version: null, p_evento: null, p_documento: expect.objectContaining({ evidencias: [] }) }),
    )
  })

  it('traduce el rechazo del servidor (documento aprobado, sin permiso) a "sin permiso"', async () => {
    const { cliente } = crearClienteDoble({ 'guardar_documento.rpc': { data: null, error: ERROR_RLS } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.guardarDocumento(DOCUMENTO)).toEqual({ ok: false, error: 'sin_permiso' })
  })
})

describe('decidirDocumento', () => {
  const DOC = '66666666-0000-0000-0000-000000000001'

  it('envía la decisión con sección y comentario en una sola llamada', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.decidirDocumento(DOC, 'En corrección', 's1', '  Falta el alcance ')).toEqual({ ok: true, valor: undefined })
    expect(llamadas).toEqual([
      {
        tabla: 'decidir_documento',
        operacion: 'rpc',
        datos: { p_id: DOC, p_estado: 'En corrección', p_seccion_id: 's1', p_comentario: 'Falta el alcance' },
      },
    ])
  })

  it('aprobar no exige sección ni comentario', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    await escrituras.decidirDocumento(DOC, 'Aprobado')

    expect(llamadas[0].datos).toEqual({ p_id: DOC, p_estado: 'Aprobado', p_seccion_id: null, p_comentario: null })
  })

  it.each([
    [{ code: '42501', message: 'Solo el cliente de la empresa aprueba documentos' }, 'sin_permiso'],
    [{ code: '22023', message: 'Solo se decide sobre documentos pendientes de revisión' }, 'datos_invalidos'],
  ] as const)('traduce %o a "%s"', async (error, esperado) => {
    const { cliente } = crearClienteDoble({ 'decidir_documento.rpc': { data: null, error } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.decidirDocumento(DOC, 'Aprobado')).toEqual({ ok: false, error: esperado })
  })
})

describe('comentarDocumento', () => {
  const DOC = { id: '66666666-0000-0000-0000-000000000001', proyectoId: P_NUEVO } as Documento

  it('guarda el comentario anclado a la sección y lo devuelve con la fecha de la BD', async () => {
    const { cliente, llamadas } = crearClienteDoble({
      'comentarios.insert': {
        data: { id: 'com-1', seccion_id: 's1', autor_id: ROBERTO, texto: 'Revisar redacción', creado_en: '2026-11-06T10:00:00+00:00' },
        error: null,
      },
    })
    const escrituras = crearServicioEscritura(cliente)

    const resultado = await escrituras.comentarDocumento(C1, DOC, 's1', ' Revisar redacción ')

    expect(llamadas).toEqual([
      {
        tabla: 'comentarios',
        operacion: 'insert',
        datos: { consultoria_id: C1, proyecto_id: P_NUEVO, entidad_tipo: 'documento', entidad_id: DOC.id, seccion_id: 's1', texto: 'Revisar redacción' },
      },
    ])
    expect(resultado).toEqual({
      ok: true,
      valor: { id: 'com-1', seccionId: 's1', autorId: ROBERTO, fecha: '06/11/2026', texto: 'Revisar redacción' },
    })
  })

  it('no guarda comentarios vacíos', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.comentarDocumento(C1, DOC, 's1', '   ')).toEqual({ ok: false, error: 'datos_invalidos' })
    expect(llamadas).toHaveLength(0)
  })
})

describe('cambiarEstadoProyecto', () => {
  it('actualiza el estado del proyecto', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.cambiarEstadoProyecto(P_NUEVO, 'Diagnóstico')).toEqual({ ok: true, valor: undefined })
    expect(llamadas).toEqual([{ tabla: 'proyectos', operacion: 'update', datos: { estado: 'Diagnóstico' }, id: P_NUEVO }])
  })

  it('traduce el rechazo del RLS a "sin permiso"', async () => {
    const { cliente } = crearClienteDoble({ 'proyectos.update': { data: null, error: SIN_FILAS } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.cambiarEstadoProyecto(P_NUEVO, 'Diagnóstico')).toEqual({ ok: false, error: 'sin_permiso' })
  })
})

// ─── Tareas ───────────────────────────────────────────────────────────────────

const T_NUEVA = '77777777-0000-0000-0000-0000000000aa'
const CARLOS = 'aaaaaaaa-0000-0000-0000-000000000005'

const NUEVA_TAREA: NuevaTarea = {
  id: T_NUEVA, proyectoId: P_NUEVO, titulo: ' Cargar evidencias ', descripcion: ' ', asignadoAId: CARLOS,
  prioridad: 'Alta', fechaVencimiento: '2026-11-20',
}

const FILA_TAREA: FilaTarea = {
  id: T_NUEVA, proyecto_id: P_NUEVO, titulo: 'Cargar evidencias', descripcion: '', asignado_a: CARLOS,
  asignado_por: ROBERTO, estado: 'Pendiente', prioridad: 'Alta', fecha_vencimiento: '2026-11-20',
  fecha_completada: null, dependencias: [],
}

describe('crearTarea', () => {
  it('inserta solo las columnas permitidas: el estado y quién asigna los pone el servidor', async () => {
    const { cliente, llamadas } = crearClienteDoble({ 'tareas.insert': { data: FILA_TAREA, error: null } })
    const escrituras = crearServicioEscritura(cliente)

    const resultado = await escrituras.crearTarea(C1, NUEVA_TAREA)

    expect(llamadas).toEqual([
      {
        tabla: 'tareas',
        operacion: 'insert',
        datos: {
          id: T_NUEVA, consultoria_id: C1, proyecto_id: P_NUEVO, titulo: 'Cargar evidencias', descripcion: '',
          asignado_a: CARLOS, prioridad: 'Alta', fecha_vencimiento: '2026-11-20', dependencias: [],
        },
      },
    ])
    expect(resultado).toEqual({
      ok: true,
      valor: expect.objectContaining({ id: T_NUEVA, estado: 'Pendiente', asignadoPorId: ROBERTO, fechaVencimiento: '20/11/2026', historial: [], comentarios: [] }),
    })
  })

  it('no intenta guardar si el usuario no pertenece a una consultoría', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.crearTarea(null, NUEVA_TAREA)).toEqual({ ok: false, error: 'sin_consultoria' })
    expect(llamadas).toHaveLength(0)
  })

  it('un asignado que no vale (otra empresa) llega como datos inválidos', async () => {
    const { cliente } = crearClienteDoble({ 'tareas.insert': { data: null, error: { code: '22023', message: 'El asignado no es…' } } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.crearTarea(C1, NUEVA_TAREA)).toEqual({ ok: false, error: 'datos_invalidos' })
  })
})

describe('editarTarea', () => {
  it('traduce los campos editables a columnas y la fecha a ISO', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    const resultado = await escrituras.editarTarea(T_NUEVA, {
      prioridad: 'Baja', asignadoAId: ROBERTO, fechaVencimiento: '25/11/2026', descripcion: ' Más fotos ',
    })

    expect(resultado).toEqual({ ok: true, valor: undefined })
    expect(llamadas).toEqual([
      {
        tabla: 'tareas',
        operacion: 'update',
        datos: { prioridad: 'Baja', asignado_a: ROBERTO, fecha_vencimiento: '2026-11-25', descripcion: 'Más fotos' },
        id: T_NUEVA,
      },
    ])
  })

  it('el cliente no edita: el RLS no le devuelve la fila', async () => {
    const { cliente } = crearClienteDoble({ 'tareas.update': { data: null, error: SIN_FILAS } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.editarTarea(T_NUEVA, { prioridad: 'Baja' })).toEqual({ ok: false, error: 'sin_permiso' })
  })
})

describe('cambiarEstadoTarea', () => {
  it('cambia el estado por la RPC (que deja historial), con el comentario opcional', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.cambiarEstadoTarea(T_NUEVA, 'En revisión', ' Ya subí las fotos ')).toEqual({ ok: true, valor: undefined })
    expect(await escrituras.cambiarEstadoTarea(T_NUEVA, 'En proceso', '   ')).toEqual({ ok: true, valor: undefined })
    expect(llamadas).toEqual([
      { tabla: 'cambiar_estado_tarea', operacion: 'rpc', datos: { p_id: T_NUEVA, p_estado: 'En revisión', p_comentario: 'Ya subí las fotos' } },
      { tabla: 'cambiar_estado_tarea', operacion: 'rpc', datos: { p_id: T_NUEVA, p_estado: 'En proceso', p_comentario: null } },
    ])
  })

  it('si el cliente intenta completar, el servidor lo rechaza y llega como "sin permiso"', async () => {
    const { cliente } = crearClienteDoble({ 'cambiar_estado_tarea.rpc': { data: null, error: ERROR_RLS } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.cambiarEstadoTarea(T_NUEVA, 'Completada')).toEqual({ ok: false, error: 'sin_permiso' })
  })
})

describe('comentarTarea', () => {
  it('guarda el comentario en la tabla genérica y lo devuelve con la fecha de la BD', async () => {
    const fila = { id: 'com-9', entidad_tipo: 'tarea', entidad_id: T_NUEVA, seccion_id: null, autor_id: CARLOS, texto: 'Listo', creado_en: '2026-11-07T10:00:00+00:00' }
    const { cliente, llamadas } = crearClienteDoble({ 'comentarios.insert': { data: fila, error: null } })
    const escrituras = crearServicioEscritura(cliente)

    const resultado = await escrituras.comentarTarea(C1, { id: T_NUEVA, proyectoId: P_NUEVO }, ' Listo ')

    expect(llamadas).toEqual([
      {
        tabla: 'comentarios',
        operacion: 'insert',
        datos: { consultoria_id: C1, proyecto_id: P_NUEVO, entidad_tipo: 'tarea', entidad_id: T_NUEVA, texto: 'Listo' },
      },
    ])
    expect(resultado).toEqual({ ok: true, valor: { id: 'com-9', autorId: CARLOS, fecha: '07/11/2026', texto: 'Listo' } })
  })

  it('no guarda comentarios vacíos', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.comentarTarea(C1, { id: T_NUEVA, proyectoId: P_NUEVO }, '  ')).toEqual({ ok: false, error: 'datos_invalidos' })
    expect(llamadas).toHaveLength(0)
  })
})

// ─── No conformidades ─────────────────────────────────────────────────────────

const NC_NUEVA = '88888888-0000-0000-0000-0000000000aa'

const DATOS_NC: DatosNC = {
  proyectoId: P_NUEVO, titulo: ' Sin calibración ', descripcion: ' No hay programa ', tipo: 'Mayor',
  detectadaEn: 'Levantamiento', fechaDeteccion: '2026-11-07', procesoId: '', evidenciaIds: [],
  responsableId: CARLOS, responsableAccionId: '', fechaLimite: '', observaciones: '',
}

const FILA_NC: FilaNoConformidad = {
  id: NC_NUEVA, proyecto_id: P_NUEVO, folio: 'NC-004', titulo: 'Sin calibración', descripcion: 'No hay programa',
  tipo: 'Mayor', detectada_en: 'Levantamiento', fecha_deteccion: '2026-11-07', proceso_id: null, evidencia_ids: [],
  responsable_id: CARLOS, responsable_accion_id: null, fecha_limite: null, estado: 'Abierta',
  correccion_inmediata: '', analisis_causa: '', accion_correctiva: '', eficacia: 'Pendiente',
  verificacion_eficacia: '', fecha_cierre: null, observaciones: '',
}

describe('registrarNoConformidad', () => {
  it('inserta solo los datos del registro: folio y estado los pone el servidor', async () => {
    const { cliente, llamadas } = crearClienteDoble({ 'no_conformidades.insert': { data: FILA_NC, error: null } })
    const escrituras = crearServicioEscritura(cliente)

    const resultado = await escrituras.registrarNoConformidad(C1, NC_NUEVA, DATOS_NC)

    expect(llamadas).toEqual([
      {
        tabla: 'no_conformidades',
        operacion: 'insert',
        datos: {
          id: NC_NUEVA, consultoria_id: C1, proyecto_id: P_NUEVO, titulo: 'Sin calibración', descripcion: 'No hay programa',
          tipo: 'Mayor', detectada_en: 'Levantamiento', fecha_deteccion: '2026-11-07', proceso_id: null, evidencia_ids: [],
          responsable_id: CARLOS, responsable_accion_id: null, fecha_limite: null, observaciones: '',
        },
      },
    ])
    expect(resultado).toEqual({
      ok: true,
      valor: expect.objectContaining({ id: NC_NUEVA, folio: 'NC-004', estado: 'Abierta', fechaDeteccion: '07/11/2026', historial: [] }),
    })
  })

  it('no intenta guardar si el usuario no pertenece a una consultoría', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.registrarNoConformidad(null, NC_NUEVA, DATOS_NC)).toEqual({ ok: false, error: 'sin_consultoria' })
    expect(llamadas).toHaveLength(0)
  })
})

describe('editarNoConformidad', () => {
  it('actualiza los datos del registro (nunca estado, eficacia ni tratamiento)', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    const resultado = await escrituras.editarNoConformidad(NC_NUEVA, { ...DATOS_NC, fechaLimite: '15/12/2026', responsableAccionId: ROBERTO })

    expect(resultado).toEqual({ ok: true, valor: undefined })
    expect(llamadas).toEqual([
      {
        tabla: 'no_conformidades',
        operacion: 'update',
        datos: {
          titulo: 'Sin calibración', descripcion: 'No hay programa', tipo: 'Mayor', detectada_en: 'Levantamiento',
          fecha_deteccion: '2026-11-07', proceso_id: null, evidencia_ids: [], responsable_id: CARLOS,
          responsable_accion_id: ROBERTO, fecha_limite: '2026-12-15', observaciones: '',
        },
        id: NC_NUEVA,
      },
    ])
  })
})

describe('guardarTratamientoNC', () => {
  it('manda corrección, causa y acción por la RPC (el cliente no tiene UPDATE)', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.guardarTratamientoNC(NC_NUEVA, { correccion: 'Retiro', causa: 'Sin responsable', accion: 'Programa' }))
      .toEqual({ ok: true, valor: undefined })
    expect(llamadas).toEqual([
      { tabla: 'guardar_tratamiento_nc', operacion: 'rpc', datos: { p_id: NC_NUEVA, p_correccion: 'Retiro', p_causa: 'Sin responsable', p_accion: 'Programa' } },
    ])
  })

  it('una NC ya verificada llega como datos inválidos', async () => {
    const { cliente } = crearClienteDoble({ 'guardar_tratamiento_nc.rpc': { data: null, error: { code: '22023', message: 'verificada' } } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.guardarTratamientoNC(NC_NUEVA, { correccion: '', causa: '', accion: '' }))
      .toEqual({ ok: false, error: 'datos_invalidos' })
  })
})

describe('cambiarEstadoNC', () => {
  it('cambia el estado por la RPC, con la verificación cuando corresponde', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    await escrituras.cambiarEstadoNC(NC_NUEVA, 'En análisis')
    await escrituras.cambiarEstadoNC(NC_NUEVA, 'Verificada', ' Calibración vigente ')
    expect(llamadas).toEqual([
      { tabla: 'cambiar_estado_nc', operacion: 'rpc', datos: { p_id: NC_NUEVA, p_estado: 'En análisis', p_verificacion: null } },
      { tabla: 'cambiar_estado_nc', operacion: 'rpc', datos: { p_id: NC_NUEVA, p_estado: 'Verificada', p_verificacion: 'Calibración vigente' } },
    ])
  })

  it('si el cliente intenta verificar, el servidor lo rechaza y llega como "sin permiso"', async () => {
    const { cliente } = crearClienteDoble({ 'cambiar_estado_nc.rpc': { data: null, error: ERROR_RLS } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.cambiarEstadoNC(NC_NUEVA, 'Verificada', 'Bien')).toEqual({ ok: false, error: 'sin_permiso' })
  })
})

// ─── Listas de verificación ───────────────────────────────────────────────────

const LISTA: ListaVerificacion = {
  id: 'lv-1', nombre: ' Revisión de compras ', empresaId: 'emp', proyectoId: P_NUEVO, procesoId: '', area: ' Compras ',
  responsableId: CARLOS, fecha: '2026-11-21', edicionNorma: 'ISO 9001:2026',
  preguntas: [
    { id: 'pr-1', pregunta: ' ¿Hay proveedores aprobados? ', estado: 'Cumple según la evidencia revisada', referenciaRequisito: '8.4', evidenciaId: '' },
    { id: 'pr-2', pregunta: '¿Se reevalúan?', estado: 'No cumple según la evidencia revisada', observaciones: 'Sin registros' },
  ],
}

describe('guardarLista', () => {
  it('manda lista y preguntas (con su orden) en una sola llamada y devuelve las tareas que creó el servidor', async () => {
    const tareaCreada: FilaTarea = {
      id: 'tar-nueva', proyecto_id: P_NUEVO, titulo: 'Seguimiento de hallazgo: ¿Se reevalúan?', descripcion: 'Hallazgo…',
      asignado_a: CARLOS, asignado_por: ROBERTO, estado: 'Pendiente', prioridad: 'Alta', fecha_vencimiento: '2026-11-21',
      fecha_completada: null, dependencias: [],
    }
    const { cliente, llamadas } = crearClienteDoble({ 'guardar_lista.rpc': { data: [tareaCreada], error: null } })
    const escrituras = crearServicioEscritura(cliente)

    const resultado = await escrituras.guardarLista(LISTA)

    expect(llamadas).toEqual([
      {
        tabla: 'guardar_lista',
        operacion: 'rpc',
        datos: {
          p_lista: {
            id: 'lv-1', proyecto_id: P_NUEVO, proceso_id: null, nombre: 'Revisión de compras', area: 'Compras',
            responsable_id: CARLOS, fecha: '2026-11-21', edicion_norma: 'ISO 9001:2026',
          },
          p_preguntas: [
            { id: 'pr-1', orden: 1, pregunta: '¿Hay proveedores aprobados?', estado: 'Cumple según la evidencia revisada', referencia_requisito: '8.4', evidencia_id: null, observaciones: '', justificacion_no_aplica: '' },
            { id: 'pr-2', orden: 2, pregunta: '¿Se reevalúan?', estado: 'No cumple según la evidencia revisada', referencia_requisito: '', evidencia_id: null, observaciones: 'Sin registros', justificacion_no_aplica: '' },
          ],
        },
      },
    ])
    expect(resultado).toEqual({
      ok: true,
      valor: [expect.objectContaining({ id: 'tar-nueva', asignadoAId: CARLOS, prioridad: 'Alta', fechaVencimiento: '21/11/2026' })],
    })
  })

  it('"No aplica" sin justificar o una evidencia de otro proyecto llegan como datos inválidos', async () => {
    for (const code of ['23514', '23503']) {
      const { cliente } = crearClienteDoble({ 'guardar_lista.rpc': { data: null, error: { code, message: 'violates constraint' } } })
      const escrituras = crearServicioEscritura(cliente)

      expect(await escrituras.guardarLista(LISTA)).toEqual({ ok: false, error: 'datos_invalidos' })
    }
  })

  it('el cliente no guarda listas: el RLS lo rechaza', async () => {
    const { cliente } = crearClienteDoble({ 'guardar_lista.rpc': { data: null, error: ERROR_RLS } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.guardarLista(LISTA)).toEqual({ ok: false, error: 'sin_permiso' })
  })
})

// ─── Entregables ──────────────────────────────────────────────────────────────

const EN_NUEVO = 'bbbbbbbb-0000-0000-0000-0000000000aa'

describe('registrarEntregable', () => {
  it('inserta solo los datos del registro: el estado y la aprobación los maneja el servidor', async () => {
    const fila: FilaEntregable = {
      id: EN_NUEVO, proyecto_id: P_NUEVO, nombre: 'Mapa de procesos', tipo: 'Documento técnico', estado: 'Pendiente',
      fecha_entrega: '2026-12-15', fecha_aprobacion: null, aprobado_por: null, documento_id: null,
    }
    const { cliente, llamadas } = crearClienteDoble({ 'entregables.insert': { data: fila, error: null } })
    const escrituras = crearServicioEscritura(cliente)

    const resultado = await escrituras.registrarEntregable(C1, EN_NUEVO, {
      proyectoId: P_NUEVO, nombre: ' Mapa de procesos ', tipo: 'Documento técnico', fechaEntrega: '15/12/2026', documentoId: '',
    })

    expect(llamadas).toEqual([
      {
        tabla: 'entregables',
        operacion: 'insert',
        datos: {
          id: EN_NUEVO, consultoria_id: C1, proyecto_id: P_NUEVO, nombre: 'Mapa de procesos', tipo: 'Documento técnico',
          fecha_entrega: '2026-12-15', documento_id: null,
        },
      },
    ])
    expect(resultado).toEqual({
      ok: true,
      valor: expect.objectContaining({ id: EN_NUEVO, estado: 'Pendiente', fechaEntrega: '15/12/2026', documentoId: undefined }),
    })
  })

  it('no intenta guardar si el usuario no pertenece a una consultoría', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.registrarEntregable(null, EN_NUEVO, { proyectoId: P_NUEVO, nombre: 'x', tipo: '', fechaEntrega: '', documentoId: '' }))
      .toEqual({ ok: false, error: 'sin_consultoria' })
    expect(llamadas).toHaveLength(0)
  })
})

describe('decidirEntregable', () => {
  it('entrega, aprueba o rechaza por la RPC, con el motivo cuando hay', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    await escrituras.decidirEntregable(EN_NUEVO, 'En revisión')
    await escrituras.decidirEntregable(EN_NUEVO, 'Rechazado', ' Falta el alcance ')
    expect(llamadas).toEqual([
      { tabla: 'decidir_entregable', operacion: 'rpc', datos: { p_id: EN_NUEVO, p_estado: 'En revisión', p_comentario: null } },
      { tabla: 'decidir_entregable', operacion: 'rpc', datos: { p_id: EN_NUEVO, p_estado: 'Rechazado', p_comentario: 'Falta el alcance' } },
    ])
  })

  it('aprobar con el documento vinculado sin aprobar llega como datos inválidos', async () => {
    const { cliente } = crearClienteDoble({ 'decidir_entregable.rpc': { data: null, error: { code: '22023', message: 'documento' } } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.decidirEntregable(EN_NUEVO, 'Aprobado')).toEqual({ ok: false, error: 'datos_invalidos' })
  })

  it('si el equipo intenta aprobar, el servidor lo rechaza y llega como "sin permiso"', async () => {
    const { cliente } = crearClienteDoble({ 'decidir_entregable.rpc': { data: null, error: ERROR_RLS } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.decidirEntregable(EN_NUEVO, 'Aprobado')).toEqual({ ok: false, error: 'sin_permiso' })
  })
})

// ─── Indicadores ──────────────────────────────────────────────────────────────

const IND: IndicadorGestion = {
  id: 'cccccccc-0000-0000-0000-0000000000aa', ambito: 'SGC', empresaId: 'emp-1', proyectoId: '', nombre: ' Quejas en 48 h ',
  descripcion: '', formula: ' a / b ', unidad: '%', frecuencia: 'Mensual', responsableId: CARLOS, meta: '≥ 95 %',
  periodo: 'Octubre 2026', valor: ' 88 ',
}

const FILA_IND: FilaIndicador = {
  id: IND.id, ambito: 'SGC', empresa_id: 'emp-1', nombre: 'Quejas en 48 h', descripcion: '', formula: 'a / b', unidad: '%',
  frecuencia: 'Mensual', responsable_id: CARLOS, meta: '≥ 95 %', periodo: 'Octubre 2026', valor: '88',
}

describe('guardarIndicador', () => {
  it('uno nuevo se inserta en la consultoría del usuario, con los textos recortados', async () => {
    const { cliente, llamadas } = crearClienteDoble({ 'indicadores.insert': { data: FILA_IND, error: null } })
    const escrituras = crearServicioEscritura(cliente)

    const resultado = await escrituras.guardarIndicador(C1, IND, true)

    expect(llamadas).toEqual([
      {
        tabla: 'indicadores',
        operacion: 'insert',
        datos: {
          id: IND.id, consultoria_id: C1, ambito: 'SGC', empresa_id: 'emp-1', nombre: 'Quejas en 48 h', descripcion: '',
          formula: 'a / b', unidad: '%', frecuencia: 'Mensual', responsable_id: CARLOS, meta: '≥ 95 %', periodo: 'Octubre 2026', valor: '88',
        },
      },
    ])
    expect(resultado).toEqual({ ok: true, valor: expect.objectContaining({ id: IND.id, valor: '88' }) })
  })

  it('uno existente se actualiza sin tocar la consultoría (no se muda)', async () => {
    const { cliente, llamadas } = crearClienteDoble()
    const escrituras = crearServicioEscritura(cliente)

    await escrituras.guardarIndicador(C1, { ...IND, ambito: 'PROCISO', empresaId: 'emp-1' }, false)

    expect(llamadas).toEqual([
      {
        tabla: 'indicadores',
        operacion: 'update',
        datos: expect.not.objectContaining({ consultoria_id: expect.anything() }),
        id: IND.id,
      },
    ])
    // Un indicador interno nunca lleva empresa (la BD lo exige con un CHECK).
    expect(llamadas[0].datos).toMatchObject({ ambito: 'PROCISO', empresa_id: null })
  })

  it('un consultor que edita un indicador interno: el RLS no le devuelve la fila', async () => {
    const { cliente } = crearClienteDoble({ 'indicadores.update': { data: null, error: SIN_FILAS } })
    const escrituras = crearServicioEscritura(cliente)

    expect(await escrituras.guardarIndicador(C1, IND, false)).toEqual({ ok: false, error: 'sin_permiso' })
  })
})

describe('marcarNotificacionesLeidas', () => {
  it('marca varias claves en una sola llamada (la BD pone el usuario)', async () => {
    const { cliente, llamadas } = crearClienteDoble()

    const resultado = await crearServicioEscritura(cliente).marcarNotificacionesLeidas(['h:1', 'tarea_vencida:t1'])

    expect(resultado).toEqual({ ok: true, valor: undefined })
    expect(llamadas).toEqual([
      { tabla: 'marcar_notificaciones_leidas', operacion: 'rpc', datos: { p_claves: ['h:1', 'tarea_vencida:t1'] } },
    ])
  })

  it('no llama a la BD si no hay nada que marcar', async () => {
    const { cliente, llamadas } = crearClienteDoble()

    expect(await crearServicioEscritura(cliente).marcarNotificacionesLeidas([])).toEqual({ ok: true, valor: undefined })
    expect(llamadas).toEqual([])
  })

  it('traduce el rechazo de la BD a "sin permiso"', async () => {
    const { cliente } = crearClienteDoble({ 'marcar_notificaciones_leidas.rpc': { data: null, error: ERROR_RLS } })

    expect(await crearServicioEscritura(cliente).marcarNotificacionesLeidas(['h:1'])).toEqual({ ok: false, error: 'sin_permiso' })
  })
})

describe('comentar', () => {
  const NC = 'nc-1'
  const FILA = {
    id: 'com-n', proyecto_id: P_NUEVO, entidad_tipo: 'no_conformidad', entidad_id: NC, seccion_id: null,
    autor_id: ROBERTO, texto: 'Ya están las firmas', creado_en: '2026-11-06T18:00:00+00:00',
  }

  it('inserta el comentario sobre cualquier entidad y lo devuelve traducido (el autor lo pone la BD)', async () => {
    const { cliente, llamadas } = crearClienteDoble({ 'comentarios.insert': { data: FILA, error: null } })

    const resultado = await crearServicioEscritura(cliente).comentar(
      C1, { entidadTipo: 'no_conformidad', entidadId: NC, proyectoId: P_NUEVO }, '  Ya están las firmas  ',
    )

    expect(llamadas).toEqual([{
      tabla: 'comentarios', operacion: 'insert',
      datos: { consultoria_id: C1, proyecto_id: P_NUEVO, entidad_tipo: 'no_conformidad', entidad_id: NC, texto: 'Ya están las firmas' },
    }])
    expect(resultado).toEqual({
      ok: true,
      valor: {
        id: 'com-n', entidadTipo: 'no_conformidad', entidadId: NC, proyectoId: P_NUEVO, seccionId: undefined,
        autorId: ROBERTO, fecha: '06/11/2026', texto: 'Ya están las firmas',
      },
    })
  })

  it('no guarda un comentario vacío', async () => {
    const { cliente, llamadas } = crearClienteDoble()

    expect(await crearServicioEscritura(cliente).comentar(C1, { entidadTipo: 'tarea', entidadId: 't', proyectoId: P_NUEVO }, '   '))
      .toEqual({ ok: false, error: 'datos_invalidos' })
    expect(llamadas).toEqual([])
  })

  it('traduce el rechazo de integridad (entidad de otro proyecto) a datos inválidos', async () => {
    const { cliente } = crearClienteDoble({ 'comentarios.insert': { data: null, error: { code: '22023', message: 'no existe' } } })

    expect(await crearServicioEscritura(cliente).comentar(C1, { entidadTipo: 'proceso', entidadId: 'x', proyectoId: P_NUEVO }, 'Hola'))
      .toEqual({ ok: false, error: 'datos_invalidos' })
  })
})

describe('administración de consultorías y usuarios', () => {
  const FILA_CONSULTORIA = {
    id: 'c-nueva', nombre: 'Calidad Total', rfc: 'CTO200101AA1', plan: 'Professional', activa: true,
    contacto: 'Laura', email: 'laura@ct.test', limite_usuarios: 10, almacenamiento_gb: 5, renovacion: null,
    creado_en: '2026-11-06T18:00:00+00:00',
  }

  it('crea la consultoría con su plan y la devuelve traducida', async () => {
    const { cliente, llamadas } = crearClienteDoble({ 'consultorias.insert': { data: FILA_CONSULTORIA, error: null } })

    const resultado = await crearServicioEscritura(cliente).crearConsultoria({
      nombre: ' Calidad Total ', rfc: 'CTO200101AA1', contacto: 'Laura', email: 'laura@ct.test',
      plan: 'Professional', limiteUsuarios: 10, almacenamientoGb: 5,
    })

    expect(llamadas).toEqual([{
      tabla: 'consultorias', operacion: 'insert',
      datos: { nombre: 'Calidad Total', rfc: 'CTO200101AA1', contacto: 'Laura', email: 'laura@ct.test', plan: 'Professional', limite_usuarios: 10, almacenamiento_gb: 5 },
    }])
    expect(resultado).toEqual({ ok: true, valor: expect.objectContaining({ id: 'c-nueva', nombre: 'Calidad Total', activa: true, fechaAlta: '06/11/2026' }) })
  })

  it('suspende o reactiva la consultoría por la RPC (que deja historial)', async () => {
    const { cliente, llamadas } = crearClienteDoble()

    expect(await crearServicioEscritura(cliente).cambiarEstadoConsultoria('c1', false)).toEqual({ ok: true, valor: undefined })
    expect(llamadas).toEqual([{ tabla: 'cambiar_estado_consultoria', operacion: 'rpc', datos: { p_id: 'c1', p_activa: false } }])
  })

  it('cambia el rol dentro del equipo traduciéndolo al nombre de la BD', async () => {
    const { cliente, llamadas } = crearClienteDoble()

    await crearServicioEscritura(cliente).administrarUsuario('u1', { rol: 'Admin Consultoría' })

    expect(llamadas).toEqual([{ tabla: 'administrar_usuario', operacion: 'rpc', datos: { p_id: 'u1', p_rol: 'admin_consultoria', p_activo: null } }])
  })

  it('suspende sin tocar el rol', async () => {
    const { cliente, llamadas } = crearClienteDoble()

    await crearServicioEscritura(cliente).administrarUsuario('u1', { activo: false })

    expect(llamadas).toEqual([{ tabla: 'administrar_usuario', operacion: 'rpc', datos: { p_id: 'u1', p_rol: null, p_activo: false } }])
  })

  it('no intenta cambiar a un rol fuera del equipo', async () => {
    const { cliente, llamadas } = crearClienteDoble()

    expect(await crearServicioEscritura(cliente).administrarUsuario('u1', { rol: 'Admin PROCISO' })).toEqual({ ok: false, error: 'datos_invalidos' })
    expect(llamadas).toEqual([])
  })

  it('traduce el rechazo de la BD a "sin permiso"', async () => {
    const { cliente } = crearClienteDoble({ 'administrar_usuario.rpc': { data: null, error: ERROR_RLS } })

    expect(await crearServicioEscritura(cliente).administrarUsuario('u1', { activo: false })).toEqual({ ok: false, error: 'sin_permiso' })
  })
})

describe('invitarUsuario', () => {
  const INVITACION = {
    nombre: 'Rosa Pérez', email: 'rosa@espiga.test', cargo: 'Dueña', rol: 'Usuario Cliente' as const,
    consultoriaId: C1, empresaId: E_NUEVA,
  }

  it('llama a la Edge Function con el rol de la BD y la URL de regreso', async () => {
    const { cliente, llamadas } = crearClienteDoble({}, { error: null }, { data: { id: 'u-nuevo', email: 'rosa@espiga.test' }, error: null })

    const resultado = await crearServicioEscritura(cliente).invitarUsuario(INVITACION, 'http://localhost:5173')

    expect(llamadas).toEqual([{
      tabla: 'invitar-usuario', operacion: 'invoke',
      datos: { nombre: 'Rosa Pérez', email: 'rosa@espiga.test', cargo: 'Dueña', rol: 'usuario_cliente', consultoriaId: C1, empresaId: E_NUEVA, redirectTo: 'http://localhost:5173' },
    }])
    expect(resultado).toEqual({ ok: true, valor: { id: 'u-nuevo', email: 'rosa@espiga.test' } })
  })

  it('no invita a un Admin PROCISO (ni llama a la función)', async () => {
    const { cliente, llamadas } = crearClienteDoble()

    expect(await crearServicioEscritura(cliente).invitarUsuario({ ...INVITACION, rol: 'Admin PROCISO' }, 'http://localhost:5173'))
      .toEqual({ ok: false, error: 'datos_invalidos' })
    expect(llamadas).toEqual([])
  })

  it('traduce el status HTTP de la función: 403 sin permiso, 400 datos inválidos, otro servicio', async () => {
    const con = (status: number) => crearClienteDoble({}, { error: null }, { data: null, error: { message: 'x', status } }).cliente
    const invitar = (status: number) => crearServicioEscritura(con(status)).invitarUsuario(INVITACION, 'http://localhost:5173')

    expect(await invitar(403)).toEqual({ ok: false, error: 'sin_permiso' })
    expect(await invitar(400)).toEqual({ ok: false, error: 'datos_invalidos' })
    expect(await invitar(500)).toEqual({ ok: false, error: 'servicio' })
  })
})

describe('analizarConIA', () => {
  const PEDIDO = {
    consultoriaId: C1, proyectoId: P_NUEVO, fuenteTipo: 'documento' as const, documentoId: 'doc-1', criterioIds: ['cr-521'],
  }
  const RESPUESTA = {
    id: 'an-9', estado: 'Completado', resumen: 'Parcial.', error: null, proveedor: 'openai-compatible', modelo: 'gpt-oss:120b',
    resultados: [{ criterio_id: 'cr-521', estado: 'Parcial', hallazgos: 'Falta mejora continua.', sugerencias: null }],
  }

  it('llama a la Edge Function y devuelve el análisis completo para mostrarlo sin recargar', async () => {
    const { cliente, llamadas } = crearClienteDoble({}, { error: null }, { data: RESPUESTA, error: null })

    const resultado = await crearServicioEscritura(cliente).analizarConIA(PEDIDO, ROBERTO, '06/11/2026')

    expect(llamadas).toEqual([{ tabla: 'analizar-ia', operacion: 'invoke', datos: PEDIDO }])
    expect(resultado).toEqual({
      ok: true,
      valor: {
        id: 'an-9', proyectoId: P_NUEVO, fuenteTipo: 'documento', documentoId: 'doc-1', evidenciaId: undefined,
        criterioIds: ['cr-521'], solicitadoPorId: ROBERTO, estado: 'Completado', resumen: 'Parcial.', errorDetalle: undefined,
        proveedor: 'openai-compatible', modelo: 'gpt-oss:120b', fecha: '06/11/2026',
        resultados: [{ criterioId: 'cr-521', estado: 'Parcial', hallazgos: 'Falta mejora continua.', sugerencias: undefined }],
      },
    })
  })

  it('un análisis que falló vuelve como análisis en Error (con su motivo), no como falla de escritura', async () => {
    const { cliente } = crearClienteDoble({}, { error: null }, {
      data: { id: 'an-10', estado: 'Error', error: 'El modelo configurado no acepta imágenes.', proveedor: 'openai-compatible', modelo: 'x', resultados: [] },
      error: null,
    })

    const resultado = await crearServicioEscritura(cliente).analizarConIA(PEDIDO, ROBERTO, '06/11/2026')

    expect(resultado).toEqual({ ok: true, valor: expect.objectContaining({ estado: 'Error', errorDetalle: 'El modelo configurado no acepta imágenes.', resultados: [] }) })
  })

  it('sin criterios no llama a la función', async () => {
    const { cliente, llamadas } = crearClienteDoble()

    expect(await crearServicioEscritura(cliente).analizarConIA({ ...PEDIDO, criterioIds: [] }, ROBERTO, '06/11/2026'))
      .toEqual({ ok: false, error: 'datos_invalidos' })
    expect(llamadas).toEqual([])
  })

  it('si el pedido se rechaza (cliente, otro proyecto) es "sin permiso"', async () => {
    const { cliente } = crearClienteDoble({}, { error: null }, { data: null, error: { message: 'x', status: 403 } })

    expect(await crearServicioEscritura(cliente).analizarConIA(PEDIDO, ROBERTO, '06/11/2026')).toEqual({ ok: false, error: 'sin_permiso' })
  })
})
