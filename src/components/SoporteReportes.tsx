import { useState } from 'react'
import { Bug, CheckCircle2, LifeBuoy, Send } from 'lucide-react'
import { Button } from './ui/Button'
import { useApp } from '../context/AppContext'
import { useSoporte } from '../hooks/useSoporte'
import { formatearFecha } from '../lib/datos'
import { MAX_ASUNTO, MAX_MENSAJE, type ReporteSoporte, type TipoReporte } from '../lib/soporte'

const inputClass = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'

// Soporte y reporte de errores. El reporte se guarda de verdad (tabla soporte_reportes).
export function SoporteReportes() {
  const { state } = useApp()
  const soporte = useSoporte()
  const [tipo, setTipo] = useState<TipoReporte>('Soporte')
  const [asunto, setAsunto] = useState('')
  const [mensaje, setMensaje] = useState('')

  async function enviar() {
    if (await soporte.enviar({ tipo, asunto, mensaje })) {
      setAsunto('')
      setMensaje('')
    }
  }

  const quien = (id: string) => state.usuarios.find((u) => u.id === id)?.nombre ?? 'Usuario'
  const mios = (soporte.reportes ?? []).filter((r) => r.usuarioId === soporte.miId)
  const recibidos = (soporte.reportes ?? []).filter((r) => r.usuarioId !== soporte.miId)

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        {tipo === 'Error' ? <Bug className="h-5 w-5 text-red-600" /> : <LifeBuoy className="h-5 w-5 text-blue-600" />}
        <h3 className="font-semibold text-slate-800">Soporte y reporte de errores</h3>
      </div>
      <div className="mb-4 flex rounded-lg bg-slate-100 p-1">
        {(['Soporte', 'Error'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={`flex-1 rounded-md px-3 py-2 text-sm ${tipo === t ? 'bg-white font-medium shadow-sm' : 'text-slate-500'}`}
          >
            {t === 'Soporte' ? 'Solicitar soporte' : 'Reportar error'}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <input aria-label="Asunto" className={inputClass} maxLength={MAX_ASUNTO} value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Asunto" />
        <textarea
          aria-label="Descripción"
          rows={5}
          className={inputClass}
          maxLength={MAX_MENSAJE}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder={tipo === 'Error' ? 'Describe qué ocurrió y los pasos para reproducirlo.' : 'Describe cómo podemos ayudarte.'}
        />
        <Button className="w-full" disabled={soporte.enviando || !asunto.trim() || !mensaje.trim()} onClick={() => void enviar()} icon={<Send className="h-4 w-4" />}>
          {soporte.enviando ? 'Enviando…' : 'Enviar'}
        </Button>
      </div>

      {mios.length > 0 && <Lista titulo="Mis reportes" reportes={mios} />}
      {soporte.esAdmin && recibidos.length > 0 && (
        <Lista titulo="Reportes recibidos" reportes={recibidos} quien={quien} onAtender={(id) => void soporte.atender(id)} />
      )}
    </section>
  )
}

function Lista({ titulo, reportes, quien, onAtender }: { titulo: string; reportes: ReporteSoporte[]; quien?: (id: string) => string; onAtender?: (id: string) => void }) {
  return (
    <div className="mt-5 border-t border-line pt-4">
      <h4 className="mb-2 text-sm font-semibold text-slate-700">{titulo}</h4>
      <ul className="space-y-2">
        {reportes.map((r) => (
          <li key={r.id} className="rounded-lg border border-line p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-800">{r.asunto}</span>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${r.estado === 'Atendido' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                {r.estado}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {r.tipo} · {formatearFecha(r.creadoEn)}{quien ? ` · ${quien(r.usuarioId)}` : ''}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-slate-600">{r.mensaje}</p>
            {onAtender && r.estado === 'Abierto' && (
              <Button className="mt-3" size="sm" variant="outline" onClick={() => onAtender(r.id)} icon={<CheckCircle2 className="h-4 w-4" />}>
                Marcar atendido
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
