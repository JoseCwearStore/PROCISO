// Validación del pedido de `invitar-usuario` (AUD04-B2): antes el cuerpo pasaba casi
// crudo y un valor mal formado terminaba en un 500 con texto interno de Postgres.
// Las reglas de NEGOCIO (quién invita, qué rol, email repetido) siguen en la BD; esto
// solo asegura que lo que llega tiene la FORMA correcta.

import { ErrorIA } from './analisis.ts'
import { esUuid } from './validar.ts'

export interface Invitacion {
  nombre: string
  email: string
  cargo: string
  rol: 'consultor' | 'admin_consultoria' | 'usuario_cliente'
  consultoriaId: string | null
  empresaId: string | null
  redirectTo?: string
}

const ROLES = ['consultor', 'admin_consultoria', 'usuario_cliente']
const MAX_NOMBRE = 120
const MAX_CARGO = 120
const MAX_EMAIL = 254
const MAX_REDIRECT = 500
const EMAIL = /^[^\s@]+@[^\s@]+$/

function uuidONulo(valor: unknown, campo: string): string | null {
  if (valor === undefined || valor === null) return null
  if (!esUuid(valor)) throw new ErrorIA(`${campo} no es un identificador válido.`)
  return valor
}

export function validarInvitacion(entrada: unknown): Invitacion {
  if (!entrada || typeof entrada !== 'object') throw new ErrorIA('El pedido de invitación es inválido.')
  const e = entrada as Record<string, unknown>

  if (typeof e.nombre !== 'string' || !e.nombre.trim()) throw new ErrorIA('Falta el nombre.')
  const nombre = e.nombre.trim()
  if (nombre.length > MAX_NOMBRE) throw new ErrorIA(`El nombre es demasiado largo (máximo ${MAX_NOMBRE} caracteres).`)

  if (typeof e.email !== 'string' || !e.email.trim()) throw new ErrorIA('Falta el correo.')
  const email = e.email.trim()
  if (email.length > MAX_EMAIL || !EMAIL.test(email)) throw new ErrorIA('El correo no es válido.')

  if (typeof e.rol !== 'string' || !ROLES.includes(e.rol)) throw new ErrorIA('El rol no es válido.')

  if (e.cargo !== undefined && e.cargo !== null && typeof e.cargo !== 'string') throw new ErrorIA('El cargo no es válido.')
  const cargo = typeof e.cargo === 'string' ? e.cargo.trim() : ''
  if (cargo.length > MAX_CARGO) throw new ErrorIA(`El cargo es demasiado largo (máximo ${MAX_CARGO} caracteres).`)

  if (e.redirectTo !== undefined && e.redirectTo !== null && typeof e.redirectTo !== 'string') throw new ErrorIA('redirectTo no es válido.')
  const redirectTo = typeof e.redirectTo === 'string' && e.redirectTo.trim() ? e.redirectTo.trim() : undefined
  if (redirectTo && redirectTo.length > MAX_REDIRECT) throw new ErrorIA('redirectTo es demasiado largo.')

  return {
    nombre,
    email,
    cargo,
    rol: e.rol as Invitacion['rol'],
    consultoriaId: uuidONulo(e.consultoriaId, 'consultoriaId'),
    empresaId: uuidONulo(e.empresaId, 'empresaId'),
    ...(redirectTo ? { redirectTo } : {}),
  }
}
