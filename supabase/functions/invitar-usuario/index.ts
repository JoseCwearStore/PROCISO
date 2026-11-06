// Edge Function invitar-usuario: invita por correo a un usuario nuevo.
//
// Es DELGADA a propósito: no tiene reglas de negocio. Las reglas (quién invita,
// qué rol, qué empresa, email repetido) viven en la BD y se prueban con pgTAP:
//   1. autorizar_invitacion  → con el TOKEN DEL ADMIN (si no puede, la BD lo dice)
//   2. inviteUserByEmail     → con la clave secreta (manda el correo; en local, Mailpit)
//   3. registrar_invitado    → con la clave secreta (perfil + historial)
// Si 3 falla, se borra el usuario de Auth: nadie queda a medias.
//
// La clave secreta (SUPABASE_SERVICE_ROLE_KEY) la inyecta Supabase en el
// servidor: nunca viaja al navegador ni está en el repositorio.

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Invitacion {
  nombre: string
  email: string
  cargo?: string
  rol: 'consultor' | 'admin_consultoria' | 'usuario_cliente'
  consultoriaId: string | null
  empresaId: string | null
  redirectTo?: string
}

const responder = (status: number, cuerpo: Record<string, unknown>) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Los errores de la BD se traducen al mismo idioma HTTP que usa PostgREST.
const estadoDe = (code?: string) => (code === '42501' ? 403 : code === '22023' ? 400 : 500)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder(405, { error: 'Método no permitido' })

  const token = req.headers.get('Authorization')
  if (!token) return responder(401, { error: 'Sesión requerida' })

  let datos: Invitacion
  try {
    datos = await req.json()
  } catch {
    return responder(400, { error: 'Cuerpo inválido' })
  }
  if (!datos?.nombre?.trim() || !datos?.email?.trim()) return responder(400, { error: 'Faltan nombre o email' })

  const url = Deno.env.get('SUPABASE_URL')!
  const comoAdmin = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: token } },
    auth: { persistSession: false },
  })
  const conClaveSecreta = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // 1. ¿Puede este admin invitar a esta persona? Lo decide la BD.
  const { data: consultoriaId, error: noAutorizado } = await comoAdmin.rpc('autorizar_invitacion', {
    p_email: datos.email,
    p_rol: datos.rol,
    p_consultoria_id: datos.consultoriaId,
    p_empresa_id: datos.empresaId,
  })
  if (noAutorizado) return responder(estadoDe(noAutorizado.code), { error: noAutorizado.message, code: noAutorizado.code })

  const { data: yo } = await comoAdmin.auth.getUser()
  if (!yo.user) return responder(401, { error: 'Sesión requerida' })

  // 2. Invitar: Supabase crea el usuario y manda el correo con el enlace.
  const email = datos.email.trim().toLowerCase()
  const { data: invitado, error: errorInvitacion } = await conClaveSecreta.auth.admin.inviteUserByEmail(email, {
    redirectTo: datos.redirectTo,
  })
  if (errorInvitacion || !invitado.user) {
    return responder(400, { error: errorInvitacion?.message ?? 'No se pudo invitar' })
  }

  // 3. Perfil + historial. Si falla, se deshace la invitación.
  const { error: errorRegistro } = await conClaveSecreta.rpc('registrar_invitado', {
    p_usuario_id: invitado.user.id,
    p_nombre: datos.nombre,
    p_email: email,
    p_cargo: datos.cargo ?? '',
    p_rol: datos.rol,
    p_consultoria_id: consultoriaId,
    p_empresa_id: datos.empresaId,
    p_autor_id: yo.user.id,
  })
  if (errorRegistro) {
    await conClaveSecreta.auth.admin.deleteUser(invitado.user.id)
    return responder(500, { error: 'No se pudo registrar el perfil; la invitación se deshizo' })
  }

  return responder(200, { id: invitado.user.id, email })
})
