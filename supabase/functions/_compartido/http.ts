// Utilidades HTTP compartidas por las Edge Functions (AUD04-B9: antes estaban copiadas
// en las tres y ya habían empezado a diferir). Lógica PURA, sin APIs de Deno: la prueba
// Vitest (http.test.ts).

import { ErrorIA } from './analisis.ts'

// ─── CORS ───────────────────────────────────────────────────────────────────

// AUD04-B7: sin CORS_ORIGEN queda `*` (desarrollo local). En producción se fija al
// dominio de la app con `supabase secrets set CORS_ORIGEN=https://…`.
export function crearCors(origen?: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origen?.trim() || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

export const responderCon = (cors: Record<string, string>) => (status: number, cuerpo: Record<string, unknown>) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// ─── Errores de la BD → HTTP ────────────────────────────────────────────────

// Mismo idioma que PostgREST. IA429 es el código de nuestro tope diario de IA.
const COMO_400 = new Set(['22023', '22P02', '23502', '23503', '23514'])
export function estadoDe(code?: string): number {
  if (code === '42501') return 403
  if (code === 'IA429') return 429
  return code && COMO_400.has(code) ? 400 : 500
}

// Los mensajes de NUESTRAS reglas (permiso, regla de negocio, tope) son para el usuario y
// pasan tal cual. El resto (formato, claves, errores internos) trae texto de Postgres con
// nombres de tablas y columnas: eso se queda en el log del servidor, no viaja (AUD04-B2).
const MENSAJE_PROPIO = new Set(['42501', '22023', 'IA429'])
// Un 42501 puede ser NUESTRO (un `raise` con mensaje para el usuario) o de Postgres ("new row
// violates row-level security policy for table …", "permission denied for table …"): este
// último trae el nombre de la tabla y no se muestra.
const TEXTO_DE_POSTGRES = /row-level security|permission denied/i
export function mensajeDeBD(error: { code?: string; message?: string }): string {
  if (error.code && MENSAJE_PROPIO.has(error.code) && error.message && !TEXTO_DE_POSTGRES.test(error.message)) return error.message
  const estado = estadoDe(error.code)
  if (estado === 400) return 'Los datos del pedido no son válidos.'
  if (estado === 403) return 'No tienes permiso para esta acción.'
  if (estado === 429) return 'Se alcanzó el límite de uso.'
  return 'Error interno. Inténtalo de nuevo más tarde.'
}

// ─── Validación ─────────────────────────────────────────────────────────────

export { esUuid } from './validar.ts'

// ─── Motivo guardado en error_detalle ───────────────────────────────────────

// `error_detalle` lo lee el cliente (AUD04-B3). Un ErrorIA ya es un mensaje accionable y
// sin detalle técnico; cualquier otro error puede traer URLs, claves o texto interno, así
// que se reemplaza por un texto genérico (el detalle real va a console.error).
export const motivoSaneado = (e: unknown): string =>
  e instanceof ErrorIA ? e.message : 'Error inesperado al procesar el pedido con IA.'
