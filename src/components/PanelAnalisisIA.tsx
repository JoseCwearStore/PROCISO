import { useEffect, useState } from 'react'
import { AlertTriangle, Clapperboard, Loader2, ShieldAlert, Sparkles, X } from 'lucide-react'
import { Button } from './ui/Button'
import { IndicadorUsoIA } from './IndicadorUsoIA'
import { TranscripcionEvidencia } from './TranscripcionEvidencia'
import { useAccionesIA, type FuenteAnalisis } from '../hooks/useAccionesIA'
import { useTranscripcion } from '../hooks/useTranscripcion'
import {
  avisoTranscripcion, AVISO_VIDEO_NATIVO, criteriosSugeridos, detalleFalloAnalisis, esAnalisisDeVideo, etiquetaSugerencia,
  fuenteAnalizada, NOTA_CONTENIDO_NO_CONFIABLE, partirMarcasDeTiempo,
} from '../lib/ia'
import { estadoTranscripcion, mensajeDeEstado, puedeAnalizarConTranscripcion } from '../lib/transcripciones'
import type { AnalisisIA, Documento, EstadoResultadoIA } from '../types'

const COLOR: Record<EstadoResultadoIA, string> = {
  'Cubierto': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Parcial': 'bg-amber-50 text-amber-700 border-amber-200',
  'Hueco': 'bg-red-50 text-red-700 border-red-200',
  'No evaluable': 'bg-slate-50 text-slate-600 border-slate-200',
  'No aplica': 'bg-slate-50 text-slate-600 border-slate-200',
}

// Aviso acordado con el usuario para el proyecto escolar (ver MEMORY.md): resalta
// la 2026 y menciona, sin el número, que la base es una edición anterior (transparencia).
export const AVISO_EDICION = 'ISO 9001:2026'
export const AVISO_PREEVALUACION =
  'con fines de demostración. Proyecto estudiantil con fines académicos: los criterios son propios y toman como base una edición anterior de la norma. ' +
  'Esto es una preevaluación generada con IA: requiere revisión humana y no constituye un dictamen de conformidad ni una certificación.'

export function PanelAnalisisIA({ fuente, tipoDocumento = null, tipoEvidencia = null, tieneArchivo = true }: {
  fuente: FuenteAnalisis
  tipoDocumento?: Documento['tipo'] | null
  tipoEvidencia?: string | null
  // Solo importa para audio y video: sin archivo no se puede transcribir ni analizar el video (E8).
  tieneArchivo?: boolean
}) {
  const ia = useAccionesIA()
  const aviso = avisoTranscripcion(tipoEvidencia)
  const [seleccion, setSeleccion] = useState<string[]>(() => criteriosSugeridos(tipoDocumento, ia.criterios))

  // Audio y video: se analiza el texto GUARDADO de la transcripción (el que el equipo pudo corregir), no el audio.
  const tipoMedia = tipoEvidencia === 'Audio' || tipoEvidencia === 'Video' ? tipoEvidencia : null
  const tr = useTranscripcion(tipoMedia ? fuente.id : null)
  const [textoEditado, setTextoEditado] = useState('')
  const guardado = tr.transcripcion?.texto ?? ''
  useEffect(() => setTextoEditado(guardado), [guardado, fuente.id])
  const estadoTr = estadoTranscripcion(tipoEvidencia, tr.transcripcion, textoEditado, tieneArchivo)
  // Mientras se lee la transcripción no se sabe si falta: no se muestra un aviso que después desaparece.
  const puedeAnalizar = puedeAnalizarConTranscripcion(estadoTr)
  const motivoBloqueo = tipoMedia && !tr.cargado ? null : mensajeDeEstado(estadoTr)
  const [analizando, setAnalizando] = useState(false)
  const [analizandoVideo, setAnalizandoVideo] = useState(false)
  // El último análisis que falló: se muestra como alerta junto a los botones (no solo enterrado en el historial).
  const [fallo, setFallo] = useState<AnalisisIA | null>(null)
  useEffect(() => setFallo(null), [fuente.id])
  const esVideo = tipoEvidencia === 'Video'
  const porId = new Map(ia.criterios.map((c) => [c.id, c]))
  const historial = ia.analisisDe(fuente)

  async function analizar() {
    setFallo(null)
    setAnalizando(true)
    const resultado = await ia.analizar(fuente, seleccion)
    setAnalizando(false)
    setFallo(resultado?.estado === 'Error' ? resultado : null)
  }

  // Video nativo: el modelo mira la imagen y oye el audio; no depende de la transcripción.
  async function analizarVideo() {
    setFallo(null)
    setAnalizandoVideo(true)
    const resultado = await ia.analizar(fuente, seleccion, 'video')
    setAnalizandoVideo(false)
    setFallo(resultado?.estado === 'Error' ? resultado : null)
  }

  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-600" />
        <h3 className="text-sm font-semibold text-slate-800">Preevaluación con IA</h3>
      </div>
      <p className="mb-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Matriz presentada como <strong>{AVISO_EDICION}</strong> {AVISO_PREEVALUACION}</span>
      </p>
      <p className="mb-4 flex gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{NOTA_CONTENIDO_NO_CONFIABLE}</span>
      </p>

      {tipoMedia && (
        <TranscripcionEvidencia tipo={tipoMedia} puedeEditar={ia.puedePedir} tieneArchivo={tieneArchivo} tr={tr} texto={textoEditado} onTexto={setTextoEditado} />
      )}

      {ia.puedePedir && (
        <div className="mb-4 space-y-2">
          {esVideo && (
            <p className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
              <Clapperboard className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{AVISO_VIDEO_NATIVO}</span>
            </p>
          )}
          {aviso && (
            <p className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{aviso}</span>
            </p>
          )}
          <IndicadorUsoIA uso={ia.usoIA} estado={ia.estadoUsoIA} />
          <p className="text-xs font-medium text-slate-600">Cláusulas a evaluar {tipoDocumento ? '(sugeridas según el tipo; puedes cambiarlas)' : ''}</p>
          <div className="flex flex-wrap gap-1.5">
            {seleccion.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
                {porId.get(id)?.clausula} · {porId.get(id)?.titulo}
                <button aria-label={`Quitar ${porId.get(id)?.clausula}`} onClick={() => setSeleccion(seleccion.filter((x) => x !== id))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {!seleccion.length && <span className="text-xs text-slate-400">Elige al menos una cláusula.</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Agregar cláusula"
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm"
              value=""
              onChange={(e) => e.target.value && setSeleccion([...seleccion, e.target.value])}
            >
              <option value="">Agregar cláusula…</option>
              {ia.criterios.filter((c) => !seleccion.includes(c.id)).map((c) => (
                <option key={c.id} value={c.id}>{c.clausula} · {c.titulo}</option>
              ))}
            </select>
            {esVideo && (
              <Button
                onClick={() => void analizarVideo()}
                disabled={analizando || analizandoVideo || !seleccion.length || !!ia.estadoUsoIA?.agotado || !tieneArchivo}
                title={ia.estadoUsoIA?.agotado ? (ia.estadoUsoIA.mensaje ?? undefined) : undefined}
                icon={analizandoVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
              >
                {analizandoVideo ? 'Analizando video…' : 'Analizar video'}
              </Button>
            )}
            <Button
              onClick={() => void analizar()}
              disabled={analizando || analizandoVideo || !seleccion.length || !!ia.estadoUsoIA?.agotado || !puedeAnalizar}
              title={ia.estadoUsoIA?.agotado ? (ia.estadoUsoIA.mensaje ?? undefined) : undefined}
              icon={analizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            >
              {analizando ? 'Analizando…' : esVideo ? 'Analizar transcripción' : 'Analizar con IA'}
            </Button>
          </div>
          {fallo && <AvisoFallo analisis={fallo} onCerrar={() => setFallo(null)} />}
          {motivoBloqueo && (
            <p className="text-xs text-amber-700">{esVideo && estadoTr !== 'sin_archivo' ? <strong>Solo para «Analizar transcripción»: </strong> : null}{motivoBloqueo}</p>
          )}
        </div>
      )}

      {!historial.length ? (
        <p className="text-sm text-slate-400">Todavía no hay preevaluaciones de esta fuente.</p>
      ) : (
        <div className="space-y-3">{historial.map((a) => <TarjetaAnalisis key={a.id} analisis={a} porId={porId} tipoEvidencia={tipoEvidencia} />)}</div>
      )}
    </section>
  )
}

// Un análisis que falló: alerta bien visible junto a los botones, con el motivo real y si se descontó del cupo diario.
function AvisoFallo({ analisis, onCerrar }: { analisis: AnalisisIA; onCerrar: () => void }) {
  const { titulo, motivo, cupo } = detalleFalloAnalisis(analisis)
  return (
    <div role="alert" className="flex gap-3 rounded-lg border-2 border-red-300 bg-red-50 p-3 text-sm text-red-800">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold">{titulo}</p>
        <p>{motivo}</p>
        {cupo && <p className="text-xs text-red-700">{cupo}</p>}
      </div>
      <button type="button" aria-label="Cerrar aviso" onClick={onCerrar} className="h-fit text-red-600 hover:text-red-800">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// Resalta las marcas de tiempo MM:SS de un hallazgo de video para ir a verlas.
function TextoConMarcas({ texto }: { texto: string }) {
  return (
    <>
      {partirMarcasDeTiempo(texto).map((t, i) =>
        t.marca ? <code key={i} className="rounded bg-violet-100 px-1 font-mono text-[0.85em] text-violet-800">{t.texto}</code> : <span key={i}>{t.texto}</span>,
      )}
    </>
  )
}

function TarjetaAnalisis({ analisis, porId, tipoEvidencia }: { analisis: AnalisisIA; porId: Map<string, { clausula: string; titulo: string }>; tipoEvidencia: string | null }) {
  const video = esAnalisisDeVideo(analisis)
  return (
    <article className="rounded-lg border border-line p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>{analisis.fecha}{analisis.modelo ? ` · ${analisis.modelo}` : ''}</span>
        <span className={`rounded-full border px-2 py-0.5 font-medium ${analisis.estado === 'Error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {analisis.estado}
        </span>
      </div>
      <p className="mb-2 text-xs text-slate-500">{fuenteAnalizada(analisis.fuenteTipo)}</p>
      {video && (
        <p className="mb-2 text-xs text-slate-500">
          Se analizó el video (imagen y audio) con un proveedor externo de IA. Las marcas de tiempo (MM:SS) indican dónde verlo.
        </p>
      )}
      {analisis.estado === 'Error' && (
        <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{analisis.errorDetalle}</p>
      )}
      {analisis.resumen && <p className="mb-2 text-sm text-slate-700">{video ? <TextoConMarcas texto={analisis.resumen} /> : analisis.resumen}</p>}
      {analisis.resultados.map((r) => (
        <div key={r.criterioId} className="border-t border-line py-2 first:border-t-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${COLOR[r.estado]}`}>{r.estado}</span>
            <span className="text-sm font-medium text-slate-800">{porId.get(r.criterioId)?.clausula} · {porId.get(r.criterioId)?.titulo}</span>
          </div>
          {r.hallazgos && <p className="mt-1 text-sm text-slate-600">{video ? <TextoConMarcas texto={r.hallazgos} /> : r.hallazgos}</p>}
          {r.sugerencias && (
            <p className="mt-1 text-xs text-violet-700">
              <strong>{etiquetaSugerencia(tipoEvidencia, analisis)}:</strong> {video ? <TextoConMarcas texto={r.sugerencias} /> : r.sugerencias}
            </p>
          )}
        </div>
      ))}
    </article>
  )
}
