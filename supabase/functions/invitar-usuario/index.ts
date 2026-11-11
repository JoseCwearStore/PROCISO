// Edge Function invitar-usuario: invita por correo a un usuario nuevo.
//
// Es DELGADA a propósito: no tiene reglas de negocio. Las reglas (quién invita,
// qué rol, qué empresa, email repetido) viven en la BD y se prueban con pgTAP:
//   0. validarInvitacion     → solo la FORMA del pedido (400 claro, no 500 con texto de Postgres)
//   1. autorizar_invitacion  → con el TOKEN DEL ADMIN (si no puede, la BD lo dice)
//   2. inviteUserByEmail     → con la clave secreta (manda el correo; en local, Mailpit)
//   3. registrar_invitado    → con la clave secreta (perfil + historial)
// Si 3 falla, se borra el usuario de Auth: nadie queda a medias.
//
// La clave secreta (SUPABASE_SERVICE_ROLE_KEY) la inyecta Supabase en el
// servidor: nunca viaja al navegador ni está en el repositorio.
// CORS_ORIGEN (en producción) restringe el origen; sin él queda `*`.

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { ErrorIA } from '../_compartido/analisis.ts'
import { crearCors, estadoDe, mensajeDeBD, responderCon } from '../_compartido/http.ts'
import { validarInvitacion } from '../_compartido/invitacion.ts'

const CORS = crearCors(Deno.env.get('CORS_ORIGEN'))
const responder = responderCon(CORS)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder(405, { error: 'Método no permitido' })

  const token = req.headers.get('Authorization')
  if (!token) return responder(401, { error: 'Sesión requerida' })

  let datos
  try {
    datos = validarInvitacion(await req.json())
  } catch (e) {
    return responder(400, { error: e instanceof ErrorIA ? e.message : 'Cuerpo inválido' })
  }

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
  if (noAutorizado) {
    console.error('[invitar-usuario] invitación no autorizada:', noAutorizado)
    return responder(estadoDe(noAutorizado.code), { error: mensajeDeBD(noAutorizado), code: noAutorizado.code })
  }

  const { data: yo } = await comoAdmin.auth.getUser()
  if (!yo.user) return responder(401, { error: 'Sesión requerida' })

  // 2. Invitar: Supabase crea el usuario y manda el correo con el enlace.
  const email = datos.email.toLowerCase()
  const { data: invitado, error: errorInvitacion } = await conClaveSecreta.auth.admin.inviteUserByEmail(email, {
    redirectTo: datos.redirectTo,
  })
  if (errorInvitacion || !invitado.user) {
    console.error('[invitar-usuario] no se pudo invitar:', errorInvitacion)
    return responder(400, { error: errorInvitacion?.message ?? 'No se pudo invitar' })
  }

  // 3. Perfil + historial. Si falla, se deshace la invitación.
  const { error: errorRegistro } = await conClaveSecreta.rpc('registrar_invitado', {
    p_usuario_id: invitado.user.id,
    p_nombre: datos.nombre,
    p_email: email,
    p_cargo: datos.cargo,
    p_rol: datos.rol,
    p_consultoria_id: consultoriaId,
    p_empresa_id: datos.empresaId,
    p_autor_id: yo.user.id,
  })
  if (errorRegistro) {
    console.error('[invitar-usuario] registrar_invitado falló:', errorRegistro)
    // AUD04-B11: si ni el rollback funciona queda un usuario de Auth huérfano (y el correo
    // ya salió): que al menos quede escrito en el log para poder limpiarlo a mano.
    const { error: errorBorrado } = await conClaveSecreta.auth.admin.deleteUser(invitado.user.id)
    if (errorBorrado) {
      console.error(`[invitar-usuario] ⚠️ USUARIO HUÉRFANO en Auth (${invitado.user.id}, ${email}): no se pudo deshacer la invitación:`, errorBorrado)
    }
    return responder(500, {
      error: errorBorrado
        ? 'No se pudo registrar el perfil y la invitación no se pudo deshacer; avisa a un administrador.'
        : 'No se pudo registrar el perfil; la invitación se deshizo',
    })
  }

  return responder(200, { id: invitado.user.id, email })
})
