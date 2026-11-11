// Validadores mínimos, sin dependencias (los usan analisis.ts, invitacion.ts y http.ts).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const esUuid = (valor: unknown): valor is string => typeof valor === 'string' && UUID.test(valor)
