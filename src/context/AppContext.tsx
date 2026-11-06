import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react'
import { cargarFilasDeSesion, llegoDesdeEnlaceDeRecuperacion, servicioArchivos, servicioAuth } from '../lib/servicios'
import { combinarDatosSesion, type DatosDemo, type DatosSesion } from '../lib/datos'
import type {
  Rol,
  PageId,
  NavParams,
  Toast,
  ModalState,
  SaveState,
  Empresa,
  Proyecto,
  Tarea,
  Notificacion,
  Entregable,
  Proceso,
  Evidencia,
  Documento,
  Usuario,
  NoConformidad,
  EntradaHistorial,
  ListaVerificacion,
  IndicadorGestion,
  ComentarioGlobal,
  Consultoria,
  AuthScreen,
  LoginReason,
} from '../types'
import {
  DOCUMENTOS,
  TAREAS,
  NO_CONFORMIDADES,
  NOTIFICACIONES,
  ENTREGABLES,
  HISTORIAL,
} from '../data/demo'
import { canAccess } from '../config/permissions'

// Lo que todavía no está en la BD. Se filtra por los proyectos que la BD deja ver.
const DEMO: DatosDemo = {
  documentos: DOCUMENTOS,
  tareas: TAREAS,
  entregables: ENTREGABLES,
  noConformidades: NO_CONFORMIDADES,
  notificaciones: NOTIFICACIONES,
  historial: HISTORIAL,
}

export type EstadoDatosSesion = 'pendiente' | 'cargando' | 'listo' | 'error'

// Al cerrar sesión no puede quedar en memoria nada del usuario anterior.
const SIN_DATOS = {
  empresas: [],
  proyectos: [],
  tareas: [],
  entregables: [],
  procesos: [],
  evidencias: [],
  documentos: [],
  usuarios: [],
  noConformidades: [],
  auditoria: [],
  consultorias: [],
  notificaciones: [],
} satisfies Partial<AppState>

interface CurrentUser {
  id: string
  nombre: string
  email: string
  rol: Rol
  consultoriaId?: string | null
  empresaId?: string | null
  passwordTemp?: boolean
}

interface AppState {
  authScreen: AuthScreen
  loginReason: LoginReason
  loginAttempts: number
  loginError: string | null
  currentUser: CurrentUser | null
  currentRole: Rol
  currentPage: PageId
  navParams: NavParams
  bannerDismissed: boolean
  saveState: SaveState
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  datosSesion: EstadoDatosSesion
  intentoCarga: number
  empresas: Empresa[]
  proyectos: Proyecto[]
  tareas: Tarea[]
  entregables: Entregable[]
  procesos: Proceso[]
  evidencias: Evidencia[]
  documentos: Documento[]
  usuarios: Usuario[]
  noConformidades: NoConformidad[]
  listasVerificacion: ListaVerificacion[]
  indicadores: IndicadorGestion[]
  comentariosGlobales: ComentarioGlobal[]
  auditoria: EntradaHistorial[]
  consultorias: Consultoria[]
  notificaciones: Notificacion[]
  toasts: Toast[]
  modal: ModalState | null
}

type Action =
  | { type: 'SET_AUTH_SCREEN'; screen: AuthScreen; reason?: LoginReason }
  | { type: 'LOGIN_SUCCESS'; user: CurrentUser }
  | { type: 'LOGIN_FAIL'; error: string }
  | { type: 'LOGIN_RESET_ATTEMPTS' }
  | { type: 'LOGOUT'; reason?: LoginReason }
  | { type: 'DATOS_CARGANDO' }
  | { type: 'DATOS_CARGADOS'; datos: DatosSesion }
  | { type: 'DATOS_ERROR' }
  | { type: 'DATOS_REINTENTAR' }
  | { type: 'SET_ROLE'; role: Rol }
  | { type: 'NAVIGATE'; page: PageId; params?: NavParams }
  | { type: 'DISMISS_BANNER' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR'; open: boolean }
  | { type: 'TOGGLE_SIDEBAR_COLLAPSED' }
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'REMOVE_TOAST'; id: string }
  | { type: 'OPEN_MODAL'; modal: ModalState }
  | { type: 'CLOSE_MODAL' }
  | { type: 'UPDATE_TAREA'; id: string; updates: Partial<Tarea> }
  | { type: 'ADD_TAREA'; tarea: Tarea }
  | { type: 'ADD_EMPRESA'; empresa: Empresa }
  | { type: 'UPDATE_EMPRESA'; id: string; updates: Partial<Empresa> }
  | { type: 'ADD_PROYECTO'; proyecto: Proyecto }
  | { type: 'UPDATE_PROYECTO'; id: string; updates: Partial<Proyecto> }
  | { type: 'UPDATE_ENTREGABLE'; id: string; updates: Partial<Entregable> }
  | { type: 'ADD_ENTREGABLE'; entregable: Entregable }
  | { type: 'UPSERT_PROCESO'; proceso: Proceso }
  | { type: 'ADD_EVIDENCIA'; evidencia: Evidencia }
  | { type: 'UPDATE_EVIDENCIA'; id: string; updates: Partial<Evidencia> }
  | { type: 'UPSERT_DOCUMENTO'; documento: Documento }
  | { type: 'SET_DOCUMENTOS'; documentos: Documento[] }
  | { type: 'UPSERT_USUARIO'; usuario: Usuario }
  | { type: 'UPSERT_NC'; noConformidad: NoConformidad }
  | { type: 'UPSERT_LISTA'; lista: ListaVerificacion }
  | { type: 'UPSERT_INDICADOR'; indicador: IndicadorGestion }
  | { type: 'ADD_COMENTARIO_GLOBAL'; comentario: ComentarioGlobal }
  | { type: 'APPEND_AUDIT'; entrada: EntradaHistorial }
  | { type: 'UPSERT_CONSULTORIA'; consultoria: Consultoria }
  | { type: 'MARCAR_LEIDA'; id: string }
  | { type: 'MARCAR_TODAS_LEIDAS' }
  | { type: 'SET_SAVE_STATE'; state: SaveState }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_AUTH_SCREEN':
      return { ...state, authScreen: action.screen, loginReason: action.reason }
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        authScreen: action.user.passwordTemp ? 'change-password' : 'app',
        loginReason: action.user.passwordTemp ? 'temp-password' : undefined,
        currentUser: action.user,
        currentRole: action.user.rol,
        loginAttempts: 0,
        loginError: null,
      }
    case 'LOGIN_FAIL':
      return {
        ...state,
        loginAttempts: state.loginAttempts + 1,
        loginError: action.error,
      }
    case 'LOGIN_RESET_ATTEMPTS':
      return { ...state, loginAttempts: 0, loginError: null }
    case 'LOGOUT':
      return {
        ...state,
        ...SIN_DATOS,
        authScreen: 'login',
        loginReason: action.reason,
        currentUser: null,
        loginAttempts: 0,
        loginError: null,
        datosSesion: 'pendiente',
        currentPage: 'inicio',
        navParams: {},
      }
    case 'DATOS_CARGANDO':
      return { ...state, datosSesion: 'cargando' }
    case 'DATOS_CARGADOS': {
      const { historial, ...resto } = action.datos
      return { ...state, ...resto, auditoria: historial, datosSesion: 'listo' }
    }
    case 'DATOS_ERROR':
      return { ...state, datosSesion: 'error' }
    case 'DATOS_REINTENTAR':
      return { ...state, datosSesion: 'pendiente', intentoCarga: state.intentoCarga + 1 }
    case 'SET_ROLE':
      return { ...state, currentRole: action.role, currentPage: 'inicio', navParams: {} }
    case 'NAVIGATE':
      return { ...state, currentPage: action.page, navParams: action.params ?? {}, sidebarOpen: false }
    case 'DISMISS_BANNER':
      return { ...state, bannerDismissed: true }
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen }
    case 'SET_SIDEBAR':
      return { ...state, sidebarOpen: action.open }
    case 'TOGGLE_SIDEBAR_COLLAPSED':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed }
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.toast] }
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) }
    case 'OPEN_MODAL':
      return { ...state, modal: action.modal }
    case 'CLOSE_MODAL':
      return { ...state, modal: null }
    case 'UPDATE_TAREA':
      return {
        ...state,
        tareas: state.tareas.map((t) => (t.id === action.id ? { ...t, ...action.updates } : t)),
      }
    case 'ADD_TAREA':
      return { ...state, tareas: [...state.tareas, action.tarea] }
    case 'ADD_EMPRESA':
      return { ...state, empresas: [...state.empresas, action.empresa] }
    case 'UPDATE_EMPRESA':
      return {
        ...state,
        empresas: state.empresas.map((e) => e.id === action.id ? { ...e, ...action.updates } : e),
      }
    case 'ADD_PROYECTO':
      return { ...state, proyectos: [...state.proyectos, action.proyecto] }
    case 'UPDATE_PROYECTO':
      return {
        ...state,
        proyectos: state.proyectos.map((p) => p.id === action.id ? { ...p, ...action.updates } : p),
      }
    case 'UPDATE_ENTREGABLE':
      return {
        ...state,
        entregables: state.entregables.map((e) => e.id === action.id ? { ...e, ...action.updates } : e),
      }
    case 'ADD_ENTREGABLE':
      return { ...state, entregables: [...state.entregables, action.entregable] }
    case 'UPSERT_PROCESO': {
      const exists = state.procesos.some((proceso) => proceso.id === action.proceso.id)
      return {
        ...state,
        procesos: exists
          ? state.procesos.map((proceso) => proceso.id === action.proceso.id ? action.proceso : proceso)
          : [...state.procesos, action.proceso],
      }
    }
    case 'ADD_EVIDENCIA':
      return { ...state, evidencias: [action.evidencia, ...state.evidencias] }
    case 'UPDATE_EVIDENCIA':
      return {
        ...state,
        evidencias: state.evidencias.map((evidencia) =>
          evidencia.id === action.id ? { ...evidencia, ...action.updates } : evidencia
        ),
      }
    case 'UPSERT_DOCUMENTO': {
      const exists = state.documentos.some((documento) => documento.id === action.documento.id)
      return {
        ...state,
        documentos: exists
          ? state.documentos.map((documento) => documento.id === action.documento.id ? action.documento : documento)
          : [action.documento, ...state.documentos],
      }
    }
    case 'SET_DOCUMENTOS':
      return { ...state, documentos: action.documentos }
    case 'UPSERT_USUARIO': {
      const exists = state.usuarios.some((usuario) => usuario.id === action.usuario.id)
      return {
        ...state,
        usuarios: exists
          ? state.usuarios.map((usuario) => usuario.id === action.usuario.id ? action.usuario : usuario)
          : [...state.usuarios, action.usuario],
      }
    }
    case 'UPSERT_NC': {
      const exists = state.noConformidades.some((item) => item.id === action.noConformidad.id)
      return {
        ...state,
        noConformidades: exists
          ? state.noConformidades.map((item) => item.id === action.noConformidad.id ? action.noConformidad : item)
          : [action.noConformidad, ...state.noConformidades],
      }
    }
    case 'UPSERT_LISTA': {
      const exists = state.listasVerificacion.some((item) => item.id === action.lista.id)
      return {
        ...state,
        listasVerificacion: exists
          ? state.listasVerificacion.map((item) => item.id === action.lista.id ? action.lista : item)
          : [action.lista, ...state.listasVerificacion],
      }
    }
    case 'UPSERT_INDICADOR': {
      const exists = state.indicadores.some((item) => item.id === action.indicador.id)
      return {
        ...state,
        indicadores: exists
          ? state.indicadores.map((item) => item.id === action.indicador.id ? action.indicador : item)
          : [action.indicador, ...state.indicadores],
      }
    }
    case 'ADD_COMENTARIO_GLOBAL':
      return { ...state, comentariosGlobales: [...state.comentariosGlobales, action.comentario] }
    case 'APPEND_AUDIT':
      return { ...state, auditoria: [action.entrada, ...state.auditoria] }
    case 'UPSERT_CONSULTORIA': {
      const exists = state.consultorias.some((item) => item.id === action.consultoria.id)
      return {
        ...state,
        consultorias: exists
          ? state.consultorias.map((item) => item.id === action.consultoria.id ? action.consultoria : item)
          : [...state.consultorias, action.consultoria],
      }
    }
    case 'MARCAR_LEIDA':
      return {
        ...state,
        notificaciones: state.notificaciones.map((n) => n.id === action.id ? { ...n, leida: true } : n),
      }
    case 'MARCAR_TODAS_LEIDAS':
      return {
        ...state,
        notificaciones: state.notificaciones.map((n) => ({ ...n, leida: true })),
      }
    case 'SET_SAVE_STATE':
      return { ...state, saveState: action.state }
    default:
      return state
  }
}

interface AppContextType {
  state: AppState
  dispatch: React.Dispatch<Action>
  navigate: (page: PageId, params?: NavParams) => void
  showToast: (message: string, type?: Toast['type']) => void
  openModal: (type: string, data?: unknown) => void
  closeModal: () => void
  getEmpresa: (id: string) => Empresa | undefined
  getProyecto: (id: string) => Proyecto | undefined
  getUsuario: (id: string) => Usuario | undefined
  getProcesos: (proyectoId: string) => Proceso[]
  getDocumentos: (proyectoId: string) => typeof DOCUMENTOS
  getNCs: (proyectoId?: string) => NoConformidad[]
  getEntregables: (proyectoId: string) => Entregable[]
  calcularAvance: (proyectoId: string) => number
  unreadCount: number
  tareasVencidas: number
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    authScreen: 'checking',
    loginReason: undefined,
    loginAttempts: 0,
    loginError: null,
    currentUser: null,
    currentRole: 'Admin Consultoría',
    currentPage: 'inicio',
    navParams: {},
    bannerDismissed: false,
    saveState: 'saved',
    sidebarOpen: false,
    sidebarCollapsed: false,
    datosSesion: 'pendiente',
    intentoCarga: 0,
    ...SIN_DATOS,
    listasVerificacion: [],
    indicadores: [],
    comentariosGlobales: [],
    toasts: [],
    modal: null,
  })

  // Al cargar la app: si hay una sesión de Supabase guardada, se restaura sin pedir login.
  useEffect(() => {
    let cancelado = false
    servicioAuth
      .obtenerUsuarioActual()
      .catch(() => null)
      .then((usuario) => {
        if (cancelado) return
        if (!usuario) {
          dispatch({ type: 'SET_AUTH_SCREEN', screen: 'login' })
          return
        }
        dispatch({ type: 'LOGIN_SUCCESS', user: usuario })
        // Viene del correo de recuperación: hay sesión, pero primero debe elegir contraseña nueva.
        if (llegoDesdeEnlaceDeRecuperacion) {
          dispatch({ type: 'SET_AUTH_SCREEN', screen: 'change-password', reason: 'recovery' })
        }
      })
    return () => {
      cancelado = true
    }
  }, [])

  // Con usuario en sesión: traer de la BD lo que el RLS le deja ver y combinarlo con el demo.
  // Depende SOLO de lo que debe reiniciar la carga (otro usuario o "Reintentar"). Si
  // dependiera de datosSesion, el propio dispatch('cargando') dispararía el cleanup y
  // cancelaría esta misma carga: la app quedaría en "Cargando…" para siempre.
  const usuarioId = state.currentUser?.id
  const intentoCarga = state.intentoCarga
  useEffect(() => {
    if (!usuarioId) return
    let cancelado = false
    dispatch({ type: 'DATOS_CARGANDO' })
    async function cargar() {
      const resultado = await cargarFilasDeSesion()
      if (!resultado.ok) return null
      const datos = combinarDatosSesion(resultado.filas, DEMO)
      // Los archivos son privados: cada evidencia recibe una URL firmada que vence.
      return { ...datos, evidencias: await servicioArchivos.firmarEvidencias(datos.evidencias) }
    }
    cargar()
      .catch(() => null)
      .then((datos) => {
        if (cancelado) return
        if (datos) dispatch({ type: 'DATOS_CARGADOS', datos })
        else dispatch({ type: 'DATOS_ERROR' })
      })
    return () => {
      cancelado = true
    }
  }, [usuarioId, intentoCarga])

  const navigate = useCallback((page: PageId, params?: NavParams) => {
    dispatch({ type: 'NAVIGATE', page, params })
  }, [])

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = `toast-${Date.now()}`
    dispatch({ type: 'ADD_TOAST', toast: { id, message, type } })
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', id }), 4500)
  }, [])

  const openModal = useCallback((type: string, data?: unknown) => {
    dispatch({ type: 'OPEN_MODAL', modal: { type, data } })
  }, [])

  const closeModal = useCallback(() => {
    dispatch({ type: 'CLOSE_MODAL' })
  }, [])

  const getEmpresa = useCallback((id: string) => state.empresas.find((e) => e.id === id), [state.empresas])
  const getProyecto = useCallback((id: string) => state.proyectos.find((p) => p.id === id), [state.proyectos])
  const getUsuario = useCallback((id: string) => state.usuarios.find((u) => u.id === id), [state.usuarios])
  const getProcesos = useCallback(
    (proyectoId: string) => state.procesos.filter((p) => p.proyectoId === proyectoId),
    [state.procesos]
  )
  const getDocumentos = useCallback(
    (proyectoId: string) => state.documentos.filter((d) => d.proyectoId === proyectoId),
    [state.documentos]
  )
  const getNCs = useCallback(
    (proyectoId?: string) => proyectoId ? state.noConformidades.filter((nc) => nc.proyectoId === proyectoId) : state.noConformidades,
    [state.noConformidades]
  )
  const getEntregables = useCallback(
    (proyectoId: string) => state.entregables.filter((e) => e.proyectoId === proyectoId),
    [state.entregables]
  )

  const calcularAvance = useCallback(
    (proyectoId: string) => {
      const tareasProy = state.tareas.filter((t) => t.proyectoId === proyectoId)
      const entregablesProy = state.entregables.filter((e) => e.proyectoId === proyectoId)
      const tareasTotal = tareasProy.length
      const tareasCompletadas = tareasProy.filter((t) => t.estado === 'Completada').length
      const entregablesTotal = entregablesProy.length
      const entregablesAprobados = entregablesProy.filter((e) => e.estado === 'Aprobado').length
      if (tareasTotal === 0 && entregablesTotal === 0) return 0
      const pTareas = tareasTotal > 0 ? tareasCompletadas / tareasTotal : 0
      const pEntregables = entregablesTotal > 0 ? entregablesAprobados / entregablesTotal : 0
      return Math.round(0.7 * pTareas * 100 + 0.3 * pEntregables * 100)
    },
    [state.tareas, state.entregables]
  )

  const usuarioSesion = state.usuarios.find((item) => item.email === state.currentUser?.email)
  const usuarioCliente = usuarioSesion?.empresaId
    ? usuarioSesion
    : state.usuarios.find((item) => item.rol === 'Usuario Cliente' && item.activo)
  const proyectosCliente = new Set(
    state.proyectos.filter((item) => item.empresaId === usuarioCliente?.empresaId).map((item) => item.id)
  )
  const unreadCount = state.notificaciones.filter(
    (n) =>
      !n.leida &&
      (!n.pagina || canAccess(n.pagina, state.currentRole)) &&
      (state.currentRole !== 'Usuario Cliente' || !n.proyectoId || proyectosCliente.has(n.proyectoId))
  ).length
  const tareasVencidas = state.tareas.filter((t) => t.estado === 'Vencida').length

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        navigate,
        showToast,
        openModal,
        closeModal,
        getEmpresa,
        getProyecto,
        getUsuario,
        getProcesos,
        getDocumentos,
        getNCs,
        getEntregables,
        calcularAvance,
        unreadCount,
        tareasVencidas,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
