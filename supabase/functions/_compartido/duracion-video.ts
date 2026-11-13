// Duración máxima de un video para analizarlo. Lógica PURA, sin imports (la usan analisis.ts y la función).
//
// Decisión final del usuario (13/11, proyecto escolar; cambió la del 12/11): TOPE de 10 minutos por video y 5 minutos
// RECOMENDADOS. Medido con un video de 10 min 31 s: tardó 57, 84, 99 y 120 s, y en otras corridas venció a los 140 s (plazo
// de la función), porque Google tarda según su carga. A los 10 minutos el aviso de tiempo excedido puede aparecer; a 5 minutos
// el tiempo estimado ronda la mitad (si crece en proporción a la duración: es una estimación, no una medición).
//
// OJO, es un tope de USO, no una barrera de seguridad: la duración la mide el navegador y la manda con el pedido
// (el servidor solo ve bytes: dos versiones del mismo video de 10 min pesan 22 MB y 69 MiB). Quien la falsee gasta su
// propio cupo diario (5 videos por usuario). Para que no se pueda falsear habría que leerla en el servidor.

export const MAX_VIDEO_SEGUNDOS = 600
// Lo recomendado: la pantalla avisa si se pasa, pero el servidor no lo exige.
export const RECOMENDADO_VIDEO_SEGUNDOS = 300

// "4 min 30 s", "45 s", "5 min": redondeada al segundo más cercano.
export function formatearDuracion(segundos: number): string {
  const total = Math.round(segundos)
  const minutos = Math.floor(total / 60)
  const resto = total % 60
  if (minutos === 0) return `${resto} s`
  return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`
}

// null = la duración sirve. Redondea al segundo más cercano: un video de "5:00" suele medir 300,02 s.
export function motivoDuracionInvalida(valor: unknown): string | null {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
    return 'No se recibió la duración del video. Vuelve a abrir la evidencia e inténtalo de nuevo.'
  }
  if (Math.round(valor) > MAX_VIDEO_SEGUNDOS) {
    return `El video dura ${formatearDuracion(valor)}; el máximo para analizarlo es de ${MAX_VIDEO_SEGUNDOS / 60} minutos. Acórtalo y súbelo de nuevo.`
  }
  return null
}
