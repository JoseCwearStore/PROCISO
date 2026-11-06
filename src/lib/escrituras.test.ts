import { describe, expect, it } from 'vitest'
import { crearServicioEscritura, type ClienteEscritura, type NuevaEmpresa, type NuevoProyecto } from './escrituras'
import type { FilaEmpresa, FilaProyecto } from './datos'
import type { Proceso } from '../types'

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
  operacion: 'insert' | 'update' | 'rpc'
  datos: Record<string, unknown>
  id?: string
}

// Doble del cliente: registra cada escritura y responde según "tabla.operacion".
function crearClienteDoble(respuestas: Record<string, Respuesta> = {}) {
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
      return { error: responder(`${funcion}.rpc`).error }
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
