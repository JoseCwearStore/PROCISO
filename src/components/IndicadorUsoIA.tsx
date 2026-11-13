import { Gauge } from 'lucide-react'
import { estadoUsoVideo, leyendaTopeIA, leyendaTopeVideo, type EstadoUsoIA, type UsoIA } from '../lib/usoIA'

const COLOR_BARRA = { normal: 'bg-violet-500', aviso: 'bg-amber-500', agotado: 'bg-red-500' } as const
const COLOR_CAJA = {
  normal: 'border-line bg-slate-50 text-slate-600',
  aviso: 'border-amber-200 bg-amber-50 text-amber-800',
  agotado: 'border-red-200 bg-red-50 text-red-700',
} as const

function Barra({ titulo, usados, tope, nivel }: { titulo: string; usados: number; tope: number; nivel: keyof typeof COLOR_BARRA }) {
  const porcentaje = tope > 0 ? Math.min(100, Math.round((usados / tope) * 100)) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span>{titulo}</span>
        <span className="font-medium tabular-nums">{usados} / {tope}</span>
      </div>
      <div
        role="progressbar"
        aria-label={titulo}
        aria-valuemin={0}
        aria-valuemax={tope}
        aria-valuenow={Math.min(usados, tope)}
        className="h-1.5 overflow-hidden rounded-full bg-white/80"
      >
        <div className={`h-full rounded-full ${COLOR_BARRA[nivel]}`} style={{ width: `${porcentaje}%` }} />
      </div>
    </div>
  )
}

// Tope diario de pedidos a la IA: leyenda fija + consumo del usuario y de su consultoría.
// Si no se pudo leer el consumo, queda solo la leyenda. Lo ve únicamente el equipo.
// conVideo: en la evidencia de un video se agrega el tope PROPIO del análisis de video (O14), que antes solo se
// conocía al llegar al rechazo.
export function IndicadorUsoIA({ uso, estado, conVideo = false }: { uso: UsoIA | null; estado: EstadoUsoIA | null; conVideo?: boolean }) {
  const nivel = estado?.nivel ?? 'normal'
  const estadoVideo = estadoUsoVideo(uso?.video)
  const nivelVideo = estadoVideo.agotado ? 'agotado' : 'normal'
  return (
    <div className={`space-y-2 rounded-lg border p-3 text-xs ${COLOR_CAJA[nivel]}`} data-testid="indicador-uso-ia">
      <p className="flex items-start gap-2">
        <Gauge className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{leyendaTopeIA(uso)}</span>
      </p>
      {uso && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Barra titulo="Tus pedidos hoy" usados={uso.usuarioUsados} tope={uso.usuarioTope} nivel={nivel} />
          <Barra titulo="Tu consultoría hoy" usados={uso.consultoriaUsados} tope={uso.consultoriaTope} nivel={nivel} />
        </div>
      )}
      {conVideo && uso?.video && (
        <div className="space-y-2" data-testid="indicador-uso-video">
          <p>{leyendaTopeVideo(uso.video)}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Barra titulo="Tus análisis de video hoy" usados={uso.video.usuarioUsados} tope={uso.video.usuarioTope} nivel={nivelVideo} />
            <Barra titulo="Tu consultoría (video) hoy" usados={uso.video.consultoriaUsados} tope={uso.video.consultoriaTope} nivel={nivelVideo} />
          </div>
          {estadoVideo.mensaje && <p role="alert" className="font-medium">{estadoVideo.mensaje}</p>}
        </div>
      )}
      {estado?.mensaje && (
        <p role={estado.agotado ? 'alert' : 'status'} className="font-medium">{estado.mensaje}</p>
      )}
    </div>
  )
}
