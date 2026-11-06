import type { Rol } from '../types'

export type RolBD = 'admin_prociso' | 'admin_consultoria' | 'consultor' | 'usuario_cliente'

export interface PerfilBD {
  id: string
  nombre: string
  email: string
  rol: RolBD
  consultoria_id: string | null
  empresa_id: string | null
  activo: boolean
  password_temporal: boolean
}

export interface UsuarioSesion {
  id: string
  nombre: string
  email: string
  rol: Rol
  consultoriaId: string | null
  empresaId: string | null
  passwordTemp: boolean
}

export type ErrorLogin = 'credenciales' | 'servicio' | 'sin_perfil' | 'inactivo'

export type ResultadoLogin = { ok: true; usuario: UsuarioSesion } | { ok: false; error: ErrorLogin }

export type ErrorRecuperacion = 'limite' | 'servicio'
export type ErrorCambioContrasena = 'debil' | 'igual' | 'servicio'

type Resultado<E> = { ok: true } | { ok: false; error: E }

interface ErrorAuth {
  code?: string
  message: string
}

// Puerto: lo mínimo que el servicio necesita del cliente de Supabase.
// En la app se le pasa el cliente real; en los tests, un doble.
export interface ClienteAuth {
  auth: {
    signInWithPassword(credenciales: { email: string; password: string }): PromiseLike<{
      data: { user: { id: string } | null }
      error: { code?: string; message: string } | null
    }>
    signOut(): PromiseLike<{ error: unknown }>
    getSession(): PromiseLike<{ data: { session: { user: { id: string } } | null } }>
    resetPasswordForEmail(email: string, opciones: { redirectTo: string }): PromiseLike<{ error: ErrorAuth | null }>
    updateUser(datos: { password: string }): PromiseLike<{ error: ErrorAuth | null }>
  }
  rpc(funcion: 'marcar_contrasena_cambiada'): PromiseLike<{ error: { message: string } | null }>
  from(tabla: 'perfiles'): {
    select(columnas: string): {
      eq(columna: 'id', valor: string): {
        maybeSingle(): PromiseLike<{ data: PerfilBD | null; error: { message: string } | null }>
      }
    }
  }
}

const ROLES: Record<RolBD, Rol> = {
  admin_prociso: 'Admin PROCISO',
  admin_consultoria: 'Admin Consultoría',
  consultor: 'Consultor',
  usuario_cliente: 'Usuario Cliente',
}

export function mapearRol(rol: RolBD): Rol {
  return ROLES[rol]
}

// El inverso: el rol de la interfaz como lo guarda la BD.
export function rolDeBD(rol: Rol): RolBD {
  return (Object.keys(ROLES) as RolBD[]).find((clave) => ROLES[clave] === rol)!
}

// El enlace del correo de recuperación vuelve con "#...&type=recovery".
export function esEnlaceDeRecuperacion(hash: string): boolean {
  return new URLSearchParams(hash.replace(/^#/, '')).get('type') === 'recovery'
}

const COLUMNAS_PERFIL = 'id, nombre, email, rol, consultoria_id, empresa_id, activo, password_temporal'

function aUsuarioSesion(perfil: PerfilBD): UsuarioSesion {
  return {
    id: perfil.id,
    nombre: perfil.nombre,
    email: perfil.email,
    rol: mapearRol(perfil.rol),
    consultoriaId: perfil.consultoria_id,
    empresaId: perfil.empresa_id,
    passwordTemp: perfil.password_temporal,
  }
}

export function crearServicioAuth(cliente: ClienteAuth) {
  async function leerPerfil(usuarioId: string): Promise<PerfilBD | null> {
    const { data } = await cliente.from('perfiles').select(COLUMNAS_PERFIL).eq('id', usuarioId).maybeSingle()
    return data
  }

  return {
    async iniciarSesion(email: string, password: string): Promise<ResultadoLogin> {
      const { data, error } = await cliente.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error || !data.user) {
        return { ok: false, error: error?.code === 'invalid_credentials' ? 'credenciales' : 'servicio' }
      }

      // Autenticado en Supabase pero sin acceso a PROCISO: no dejamos una sesión colgada.
      const perfil = await leerPerfil(data.user.id)
      if (!perfil || !perfil.activo) {
        await cliente.auth.signOut()
        return { ok: false, error: perfil ? 'inactivo' : 'sin_perfil' }
      }

      return { ok: true, usuario: aUsuarioSesion(perfil) }
    },

    async obtenerUsuarioActual(): Promise<UsuarioSesion | null> {
      const { data } = await cliente.auth.getSession()
      if (!data.session) return null

      const perfil = await leerPerfil(data.session.user.id)
      return perfil?.activo ? aUsuarioSesion(perfil) : null
    },

    // Supabase no revela si el correo existe, y nosotros tampoco: si no hay
    // error, el mensaje para el usuario es siempre el mismo.
    async solicitarRecuperacion(email: string, redirectTo: string): Promise<Resultado<ErrorRecuperacion>> {
      const { error } = await cliente.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo })
      if (!error) return { ok: true }
      return { ok: false, error: error.code === 'over_email_send_rate_limit' ? 'limite' : 'servicio' }
    },

    async cambiarContrasena(password: string): Promise<Resultado<ErrorCambioContrasena>> {
      const { error } = await cliente.auth.updateUser({ password })
      if (error) {
        if (error.code === 'weak_password') return { ok: false, error: 'debil' }
        if (error.code === 'same_password') return { ok: false, error: 'igual' }
        return { ok: false, error: 'servicio' }
      }

      // La contraseña ya cambió. Si falla desmarcar la bandera, el peor caso es
      // que en el próximo login se pida cambiarla de nuevo: no bloqueamos al usuario.
      await cliente.rpc('marcar_contrasena_cambiada')
      return { ok: true }
    },

    async cerrarSesion(): Promise<void> {
      await cliente.auth.signOut()
    },
  }
}

export type ServicioAuth = ReturnType<typeof crearServicioAuth>
