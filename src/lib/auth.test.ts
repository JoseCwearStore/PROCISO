import { describe, expect, it, vi } from 'vitest'
import { crearServicioAuth, esEnlaceDeRecuperacion, mapearRol, type ClienteAuth, type PerfilBD } from './auth'

const PERFIL_ANA: PerfilBD = {
  id: 'aaaaaaaa-0000-0000-0000-000000000002',
  nombre: 'Ana García López',
  email: 'ana@cowin.test',
  rol: 'admin_consultoria',
  consultoria_id: '11111111-0000-0000-0000-000000000001',
  empresa_id: null,
  activo: true,
  password_temporal: false,
}

interface OpcionesDoble {
  errorLogin?: { code?: string; message: string }
  perfil?: PerfilBD | null
  sesionUsuarioId?: string | null
  errorRecuperacion?: { code?: string; message: string }
  errorCambio?: { code?: string; message: string }
  errorRpc?: { message: string }
}

// Doble del cliente de Supabase: solo implementa lo que usa el servicio.
function crearClienteDoble({
  errorLogin,
  perfil = PERFIL_ANA,
  sesionUsuarioId = null,
  errorRecuperacion,
  errorCambio,
  errorRpc,
}: OpcionesDoble = {}) {
  const consultasPerfil: string[] = []

  const cliente = {
    auth: {
      signInWithPassword: vi.fn(async () =>
        errorLogin
          ? { data: { user: null }, error: errorLogin }
          : { data: { user: { id: perfil?.id ?? 'sin-perfil' } }, error: null },
      ),
      signOut: vi.fn(async () => ({ error: null })),
      getSession: vi.fn(async () => ({
        data: { session: sesionUsuarioId ? { user: { id: sesionUsuarioId } } : null },
      })),
      resetPasswordForEmail: vi.fn(async (_email: string, _opciones: { redirectTo: string }) => ({
        error: errorRecuperacion ?? null,
      })),
      updateUser: vi.fn(async (_datos: { password: string }) => ({ error: errorCambio ?? null })),
    },
    rpc: vi.fn(async (_funcion: 'marcar_contrasena_cambiada') => ({ error: errorRpc ?? null })),
    from: vi.fn((_tabla: 'perfiles') => ({
      select: (_columnas: string) => ({
        eq: (_columna: 'id', valor: string) => ({
          maybeSingle: async () => {
            consultasPerfil.push(valor)
            return { data: perfil, error: null }
          },
        }),
      }),
    })),
  } satisfies ClienteAuth

  return { cliente, consultasPerfil }
}

describe('mapearRol', () => {
  it('traduce los códigos de la base a los nombres que usa la interfaz', () => {
    expect(mapearRol('admin_prociso')).toBe('Admin PROCISO')
    expect(mapearRol('admin_consultoria')).toBe('Admin Consultoría')
    expect(mapearRol('consultor')).toBe('Consultor')
    expect(mapearRol('usuario_cliente')).toBe('Usuario Cliente')
  })
})

describe('esEnlaceDeRecuperacion', () => {
  it('reconoce el regreso desde el correo de recuperación', () => {
    expect(esEnlaceDeRecuperacion('#access_token=abc&expires_in=3600&refresh_token=def&type=recovery')).toBe(true)
  })

  it('reconoce el regreso desde el correo de invitación (el invitado elige su contraseña)', () => {
    expect(esEnlaceDeRecuperacion('#access_token=abc&expires_in=3600&refresh_token=def&type=invite')).toBe(true)
  })

  it('no confunde otros enlaces de Supabase ni una URL sin hash', () => {
    expect(esEnlaceDeRecuperacion('#access_token=abc&type=signup')).toBe(false)
    expect(esEnlaceDeRecuperacion('#type=recoveryx')).toBe(false)
    expect(esEnlaceDeRecuperacion('')).toBe(false)
  })
})

describe('iniciarSesion', () => {
  it('devuelve el usuario de la sesión con su rol, consultoría y empresa', async () => {
    const { cliente } = crearClienteDoble()
    const auth = crearServicioAuth(cliente)

    const resultado = await auth.iniciarSesion('ana@cowin.test', 'secreto')

    expect(resultado).toEqual({
      ok: true,
      usuario: {
        id: PERFIL_ANA.id,
        nombre: 'Ana García López',
        email: 'ana@cowin.test',
        rol: 'Admin Consultoría',
        consultoriaId: PERFIL_ANA.consultoria_id,
        empresaId: null,
        passwordTemp: false,
      },
    })
  })

  it('normaliza el correo (espacios y mayúsculas) antes de autenticar', async () => {
    const { cliente } = crearClienteDoble()
    const auth = crearServicioAuth(cliente)

    await auth.iniciarSesion('  Ana@COWIN.test ', 'secreto')

    expect(cliente.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@cowin.test', password: 'secreto' })
  })

  it('informa credenciales inválidas sin consultar el perfil', async () => {
    const { cliente, consultasPerfil } = crearClienteDoble({
      errorLogin: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    })
    const auth = crearServicioAuth(cliente)

    const resultado = await auth.iniciarSesion('ana@cowin.test', 'incorrecta')

    expect(resultado).toEqual({ ok: false, error: 'credenciales' })
    expect(consultasPerfil).toHaveLength(0)
  })

  it('distingue una falla del servicio de unas credenciales inválidas', async () => {
    const { cliente } = crearClienteDoble({ errorLogin: { message: 'Failed to fetch' } })
    const auth = crearServicioAuth(cliente)

    const resultado = await auth.iniciarSesion('ana@cowin.test', 'secreto')

    expect(resultado).toEqual({ ok: false, error: 'servicio' })
  })

  it('cierra la sesión si el usuario no tiene perfil en PROCISO', async () => {
    const { cliente } = crearClienteDoble({ perfil: null })
    const auth = crearServicioAuth(cliente)

    const resultado = await auth.iniciarSesion('nadie@cowin.test', 'secreto')

    expect(resultado).toEqual({ ok: false, error: 'sin_perfil' })
    expect(cliente.auth.signOut).toHaveBeenCalledOnce()
  })

  it('cierra la sesión si el perfil está desactivado', async () => {
    const { cliente } = crearClienteDoble({ perfil: { ...PERFIL_ANA, activo: false } })
    const auth = crearServicioAuth(cliente)

    const resultado = await auth.iniciarSesion('ana@cowin.test', 'secreto')

    expect(resultado).toEqual({ ok: false, error: 'inactivo' })
    expect(cliente.auth.signOut).toHaveBeenCalledOnce()
  })

  it('marca la contraseña temporal para forzar el cambio', async () => {
    const { cliente } = crearClienteDoble({ perfil: { ...PERFIL_ANA, password_temporal: true } })
    const auth = crearServicioAuth(cliente)

    const resultado = await auth.iniciarSesion('ana@cowin.test', 'temporal')

    expect(resultado.ok && resultado.usuario.passwordTemp).toBe(true)
  })
})

describe('obtenerUsuarioActual', () => {
  it('devuelve null si no hay sesión', async () => {
    const { cliente, consultasPerfil } = crearClienteDoble({ sesionUsuarioId: null })
    const auth = crearServicioAuth(cliente)

    expect(await auth.obtenerUsuarioActual()).toBeNull()
    expect(consultasPerfil).toHaveLength(0)
  })

  it('recupera el usuario de una sesión existente (al recargar la página)', async () => {
    const { cliente, consultasPerfil } = crearClienteDoble({ sesionUsuarioId: PERFIL_ANA.id })
    const auth = crearServicioAuth(cliente)

    const usuario = await auth.obtenerUsuarioActual()

    expect(usuario?.rol).toBe('Admin Consultoría')
    expect(consultasPerfil).toEqual([PERFIL_ANA.id])
  })

  it('devuelve null si la sesión es de un perfil desactivado', async () => {
    const { cliente } = crearClienteDoble({
      sesionUsuarioId: PERFIL_ANA.id,
      perfil: { ...PERFIL_ANA, activo: false },
    })
    const auth = crearServicioAuth(cliente)

    expect(await auth.obtenerUsuarioActual()).toBeNull()
  })
})

describe('solicitarRecuperacion', () => {
  const REDIRECCION = 'http://localhost:8443'

  it('pide el correo de recuperación con el correo normalizado y la URL de regreso', async () => {
    const { cliente } = crearClienteDoble()
    const auth = crearServicioAuth(cliente)

    const resultado = await auth.solicitarRecuperacion(' Ana@COWIN.test ', REDIRECCION)

    expect(resultado).toEqual({ ok: true })
    expect(cliente.auth.resetPasswordForEmail).toHaveBeenCalledWith('ana@cowin.test', { redirectTo: REDIRECCION })
  })

  it('informa cuando se superó el límite de correos', async () => {
    const { cliente } = crearClienteDoble({
      errorRecuperacion: { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' },
    })
    const auth = crearServicioAuth(cliente)

    expect(await auth.solicitarRecuperacion('ana@cowin.test', REDIRECCION)).toEqual({ ok: false, error: 'limite' })
  })

  it('informa una falla del servicio', async () => {
    const { cliente } = crearClienteDoble({ errorRecuperacion: { message: 'Failed to fetch' } })
    const auth = crearServicioAuth(cliente)

    expect(await auth.solicitarRecuperacion('ana@cowin.test', REDIRECCION)).toEqual({ ok: false, error: 'servicio' })
  })
})

describe('cambiarContrasena', () => {
  it('actualiza la contraseña y desmarca la contraseña temporal', async () => {
    const { cliente } = crearClienteDoble()
    const auth = crearServicioAuth(cliente)

    const resultado = await auth.cambiarContrasena('Nueva#2026')

    expect(resultado).toEqual({ ok: true })
    expect(cliente.auth.updateUser).toHaveBeenCalledWith({ password: 'Nueva#2026' })
    expect(cliente.rpc).toHaveBeenCalledWith('marcar_contrasena_cambiada')
  })

  it('rechaza una contraseña débil sin tocar la bandera', async () => {
    const { cliente } = crearClienteDoble({ errorCambio: { code: 'weak_password', message: 'Password is weak' } })
    const auth = crearServicioAuth(cliente)

    expect(await auth.cambiarContrasena('debil')).toEqual({ ok: false, error: 'debil' })
    expect(cliente.rpc).not.toHaveBeenCalled()
  })

  it('rechaza repetir la contraseña actual', async () => {
    const { cliente } = crearClienteDoble({
      errorCambio: { code: 'same_password', message: 'New password should be different' },
    })
    const auth = crearServicioAuth(cliente)

    expect(await auth.cambiarContrasena('Prociso2026!')).toEqual({ ok: false, error: 'igual' })
  })

  it('informa una falla del servicio al cambiar la contraseña', async () => {
    const { cliente } = crearClienteDoble({ errorCambio: { message: 'Failed to fetch' } })
    const auth = crearServicioAuth(cliente)

    expect(await auth.cambiarContrasena('Nueva#2026')).toEqual({ ok: false, error: 'servicio' })
  })

  it('da el cambio por bueno aunque falle desmarcar la bandera (la contraseña ya cambió)', async () => {
    const { cliente } = crearClienteDoble({ errorRpc: { message: 'Failed to fetch' } })
    const auth = crearServicioAuth(cliente)

    expect(await auth.cambiarContrasena('Nueva#2026')).toEqual({ ok: true })
  })
})

describe('cerrarSesion', () => {
  it('cierra la sesión en Supabase', async () => {
    const { cliente } = crearClienteDoble()
    const auth = crearServicioAuth(cliente)

    await auth.cerrarSesion()

    expect(cliente.auth.signOut).toHaveBeenCalledOnce()
  })
})
