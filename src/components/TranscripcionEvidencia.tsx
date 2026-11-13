import { useState } from 'react'
import { AlertTriangle, FileText, Loader2, Save } from 'lucide-react'
import { Button } from './ui/Button'
import { ConfirmDialog } from './ui/ConfirmDialog'
import type { useTranscripcion } from '../hooks/useTranscripcion'
import { etiquetaTranscripcion, MAX_TRANSCRIPCION } from '../lib/transcripciones'

type Transcripcion = ReturnType<typeof useTranscripcion>

// La transcripción automática de un audio o video, para REVISARLA y corregirla antes de analizar: la transcripción
// se equivoca (medido: códigos y cifras decimales) y la IA analiza exactamente el texto que se ve acá. El equipo
// transcribe y corrige; el cliente solo la lee. Se conserva siempre lo que escuchó la IA.
export function TranscripcionEvidencia({ tipo, puedeEditar, tieneArchivo, tr, texto, onTexto }: {
  tipo: 'Audio' | 'Video'
  puedeEditar: boolean
  tieneArchivo: boolean
  tr: Transcripcion
  texto: string
  onTexto: (texto: string) => void
}) {
  const [confirmando, setConfirmando] = useState(false)
  const { transcripcion } = tr
  const transcribiendo = tr.trabajo === 'transcribiendo'
  const guardando = tr.trabajo === 'guardando'
  const hayCambios = !!transcripcion && texto.trim() !== transcripcion.texto

  const iconoTranscribir = transcribiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />

  return (
    <section className="mb-4 rounded-lg border border-line p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <FileText className="h-4 w-4 text-sky-600" />
          Transcripción {tipo === 'Video' ? 'del audio del video' : 'del audio'}
        </h4>
        {transcripcion && (
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${transcripcion.corregidaEn ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
            {etiquetaTranscripcion(transcripcion)}
          </span>
        )}
      </div>

      {!tr.cargado ? (
        <p className="text-sm text-slate-400">Cargando transcripción…</p>
      ) : tr.errorLectura ? (
        // No se pudo LEER: no se ofrece transcribir (pisaría un texto ya corregido).
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />No se pudo leer la transcripción.</span>
          <Button variant="outline" onClick={() => void tr.recargar()}>Reintentar</Button>
        </div>
      ) : !transcripcion ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {!tieneArchivo
              ? 'No hay un archivo para transcribir.'
              : puedeEditar ? 'Todavía no hay transcripción de este archivo.' : 'El equipo todavía no transcribió este archivo.'}
          </p>
          {puedeEditar && tieneArchivo && (
            <Button onClick={() => void tr.transcribir()} disabled={transcribiendo} icon={iconoTranscribir}>
              {transcribiendo ? 'Transcribiendo…' : 'Transcribir'}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            {puedeEditar
              ? 'La IA analizará exactamente este texto. Corrige lo que esté mal (códigos, cifras, nombres) y guarda antes de analizar.'
              : 'Este es el texto que analiza la IA.'}
          </p>
          <textarea
            aria-label="Texto de la transcripción"
            rows={7}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            maxLength={MAX_TRANSCRIPCION}
            readOnly={!puedeEditar}
            value={texto}
            onChange={(e) => onTexto(e.target.value)}
          />
          {puedeEditar && (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void tr.corregir(texto)}
                disabled={!hayCambios || guardando || !texto.trim()}
                icon={guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              >
                {guardando ? 'Guardando…' : 'Guardar corrección'}
              </Button>
              <Button variant="outline" disabled={!hayCambios || guardando} onClick={() => onTexto(transcripcion.texto)}>
                Descartar cambios
              </Button>
              <Button
                variant="outline"
                disabled={transcribiendo || guardando}
                icon={iconoTranscribir}
                onClick={() => (transcripcion.corregidaEn || hayCambios ? setConfirmando(true) : void tr.transcribir())}
              >
                {transcribiendo ? 'Transcribiendo…' : 'Volver a transcribir'}
              </Button>
            </div>
          )}
          {transcripcion.textoAutomatico !== transcripcion.texto && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer font-medium text-slate-600">Lo que escuchó la IA (texto automático, sin corregir)</summary>
              <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-2 text-slate-600">{transcripcion.textoAutomatico}</p>
            </details>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmando}
        onClose={() => setConfirmando(false)}
        onConfirm={() => {
          setConfirmando(false)
          void tr.transcribir()
        }}
        title="Volver a transcribir"
        message="Volver a transcribir reemplaza el texto actual, incluidas las correcciones y los cambios sin guardar. ¿Continuar?"
        confirmLabel="Volver a transcribir"
      />
    </section>
  )
}
