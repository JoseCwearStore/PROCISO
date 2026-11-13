// Consumo del tope diario de pedidos a la IA (L4b, decisión D5).
//
// La BD es la que RECHAZA al pasarse (trigger, error 429) y la que INFORMA (mi_uso_ia):
// los topes que se muestran son los mismos que se aplican, porque salen de la misma fuente.
// Este módulo solo traduce y decide qué decirle al usuario; no tiene números propios.

export interface UsoIA {
  usuarioUsados: number
  usuarioTope: number
  usuarioLiberaEn: string | null // cuándo cumple 24 h el pedido más viejo del usuario (ahí se libera un cupo)
  consultoriaUsados: number
  consultoriaTope: number
  consultoriaLiberaEn: string | null
  video?: UsoVideo
}

// El análisis de VIDEO tiene su propio tope, más bajo (O14): mi_uso_ia lo informa junto al general, de las mismas
// funciones que aplica el trigger. Es opcional: si la fila no lo trae, la pantalla sigue como antes.
export interface UsoVideo {
  usuarioUsados: number
  usuarioTope: number
  consultoriaUsados: number
  consultoriaTope: number
}

export type NivelUsoIA = 'normal' | 'aviso' | 'agotado'

export interface EstadoUsoIA {
  nivel: NivelUsoIA
  agotado: boolean
  limitante: 'usuario' | 'consultoria' | null // quién pone el techo hoy (el del usuario manda si ambos)
  restantes: number // pedidos que todavía puede hacer (el menor de los dos márgenes)
  mensaje: string | null // null cuando no hay nada que avisar
}

// A partir de qué fracción del tope se avisa.
const UMBRAL_AVISO = 0.8

const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const fechaONulo = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

// Una fila de mi_uso_ia → UsoIA. Si no tiene la forma esperada devuelve null: la pantalla
// sigue funcionando con la leyenda fija en vez de mostrar números inventados.
export function adaptarUsoIA(fila: unknown): UsoIA | null {
  if (!fila || typeof fila !== 'object') return null
  const f = fila as Record<string, unknown>
  if (!esNumero(f.usuario_usados) || !esNumero(f.usuario_tope) || !esNumero(f.consultoria_usados) || !esNumero(f.consultoria_tope)) return null
  const tieneVideo = esNumero(f.video_usuario_usados) && esNumero(f.video_usuario_tope)
    && esNumero(f.video_consultoria_usados) && esNumero(f.video_consultoria_tope)
  return {
    usuarioUsados: f.usuario_usados,
    usuarioTope: f.usuario_tope,
    usuarioLiberaEn: fechaONulo(f.usuario_libera_en),
    consultoriaUsados: f.consultoria_usados,
    consultoriaTope: f.consultoria_tope,
    consultoriaLiberaEn: fechaONulo(f.consultoria_libera_en),
    ...(tieneVideo
      ? {
          video: {
            usuarioUsados: f.video_usuario_usados as number,
            usuarioTope: f.video_usuario_tope as number,
            consultoriaUsados: f.video_consultoria_usados as number,
            consultoriaTope: f.video_consultoria_tope as number,
          },
        }
      : {}),
  }
}

// ¿Se puede pedir otro análisis de VIDEO? Mismos mensajes que da la BD al rechazar (aplicar_tope_ia), para que la
// pantalla avise ANTES del rechazo. Un tope de 0 cuenta como agotado. El del usuario manda si ambos se acabaron.
export function estadoUsoVideo(video: UsoVideo | undefined): { agotado: boolean; mensaje: string | null } {
  if (!video) return { agotado: false, mensaje: null }
  if (video.usuarioUsados >= video.usuarioTope) {
    return { agotado: true, mensaje: `Alcanzaste el tope diario de análisis de video (${video.usuarioTope} por usuario). Inténtalo mañana.` }
  }
  if (video.consultoriaUsados >= video.consultoriaTope) {
    return { agotado: true, mensaje: `Tu consultoría alcanzó el tope diario de análisis de video (${video.consultoriaTope}). Inténtalo mañana.` }
  }
  return { agotado: false, mensaje: null }
}

export function leyendaTopeVideo(video: UsoVideo | undefined): string | null {
  return video ? `Análisis de video: ${video.usuarioTope} por usuario y ${video.consultoriaTope} por consultoría al día.` : null
}

export function formatearEspera(ms: number): string {
  const minutos = Math.floor(ms / 60_000)
  if (minutos < 1) return 'menos de 1 min'
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto ? `${horas} h ${resto} min` : `${horas} h`
}

const cuandoSeLibera = (liberaEn: string | null, ahora: Date): string => {
  if (!liberaEn) return 'Inténtalo más tarde.'
  const ms = new Date(liberaEn).getTime() - ahora.getTime()
  return Number.isNaN(ms) ? 'Inténtalo más tarde.' : `Se libera un cupo en ${formatearEspera(ms)}.`
}

const pedidos = (n: number) => (n === 1 ? '1 pedido' : `${n} pedidos`)

export function estadoUsoIA(uso: UsoIA, ahora: Date): EstadoUsoIA {
  const restantesUsuario = Math.max(0, uso.usuarioTope - uso.usuarioUsados)
  const restantesConsultoria = Math.max(0, uso.consultoriaTope - uso.consultoriaUsados)
  const restantes = Math.min(restantesUsuario, restantesConsultoria)

  if (restantesUsuario === 0) {
    return {
      nivel: 'agotado', agotado: true, limitante: 'usuario', restantes: 0,
      mensaje: `Alcanzaste el tope diario de IA (${uso.usuarioTope} por usuario). ${cuandoSeLibera(uso.usuarioLiberaEn, ahora)}`,
    }
  }
  if (restantesConsultoria === 0) {
    return {
      nivel: 'agotado', agotado: true, limitante: 'consultoria', restantes: 0,
      mensaje: `Tu consultoría alcanzó el tope diario de IA (${uso.consultoriaTope}). ${cuandoSeLibera(uso.consultoriaLiberaEn, ahora)}`,
    }
  }

  const avisaUsuario = uso.usuarioUsados >= Math.ceil(uso.usuarioTope * UMBRAL_AVISO)
  const avisaConsultoria = uso.consultoriaUsados >= Math.ceil(uso.consultoriaTope * UMBRAL_AVISO)
  if (!avisaUsuario && !avisaConsultoria) return { nivel: 'normal', agotado: false, limitante: null, restantes, mensaje: null }

  // Avisa por el que antes se agota (si empatan, el del usuario).
  const porUsuario = avisaUsuario && (!avisaConsultoria || restantesUsuario <= restantesConsultoria)
  return {
    nivel: 'aviso', agotado: false, limitante: null, restantes,
    mensaje: porUsuario
      ? `Te ${restantesUsuario === 1 ? 'queda' : 'quedan'} ${pedidos(restantesUsuario)} de IA hoy (tope de ${uso.usuarioTope} por usuario).`
      : `A tu consultoría le ${restantesConsultoria === 1 ? 'queda' : 'quedan'} ${pedidos(restantesConsultoria)} de IA hoy (tope de ${uso.consultoriaTope}).`,
  }
}

// La leyenda fija: siempre visible para el equipo, aunque no se haya podido leer el consumo.
export function leyendaTopeIA(uso: UsoIA | null): string {
  return uso
    ? `Tope diario de IA: ${uso.usuarioTope} pedidos por usuario y ${uso.consultoriaTope} por consultoría (últimas 24 horas).`
    : 'Hay un tope diario de pedidos a la IA por usuario y por consultoría; el cupo se va liberando con el paso de las horas.'
}

// ─── Servicio ───────────────────────────────────────────────────────────────

export interface ClienteUsoIA {
  rpc(funcion: 'mi_uso_ia'): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
}

export function crearServicioUsoIA(cliente: ClienteUsoIA) {
  return {
    // null = no se pudo leer (un cliente, sin red, error): la pantalla muestra solo la leyenda.
    async leer(): Promise<UsoIA | null> {
      try {
        const { data, error } = await cliente.rpc('mi_uso_ia')
        if (error || !Array.isArray(data) || !data.length) return null
        return adaptarUsoIA(data[0])
      } catch {
        return null
      }
    },
  }
}

export type ServicioUsoIA = ReturnType<typeof crearServicioUsoIA>
