import { describe, expect, it, vi } from 'vitest'
import { crearServicioAuth, mapearRol, type ClienteAuth, type PerfilBD } from './auth'

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
}

// Doble del cliente de Supabase: solo implementa lo que usa el servicio.
function crearClienteDoble({ errorLogin, perfil = PERFIL_ANA, sesionUsuarioId = null }: OpcionesDoble = {}) {
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
    },
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

describe('cerrarSesion', () => {
  it('cierra la sesión en Supabase', async () => {
    const { cliente } = crearClienteDoble()
    const auth = crearServicioAuth(cliente)

    await auth.cerrarSesion()

    expect(cliente.auth.signOut).toHaveBeenCalledOnce()
  })
})
