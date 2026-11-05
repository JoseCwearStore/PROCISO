import { useState } from 'react'
import { Mail, ArrowLeft, CheckCircle, Info } from 'lucide-react'
import { useApp } from '../../context/AppContext'

export default function RecuperarAcceso() {
  const { dispatch } = useApp()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setSent(true)
    }, 900)
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-navy mb-4">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M8 8h10a6 6 0 0 1 0 12H8V8Z" fill="white" fillOpacity=".9"/>
              <path d="M8 20h12" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-navy tracking-tight">PROCISO</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-line p-8">
          {sent ? (
            <div className="text-center py-2">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-fg mb-2">Revisa tu correo</h2>
              <p className="text-sm text-fg/60 mb-6">
                Si existe una cuenta asociada a ese correo, recibirás instrucciones para restablecer tu contraseña en los próximos minutos.
              </p>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 text-left mb-6">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Por seguridad, no confirmamos si el correo existe en el sistema. Revisa también tu carpeta de spam.</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 text-left mb-6">
                <p className="font-semibold mb-1">ENTORNO DEMO — Requiere integración</p>
                <p>El envío real de correo requiere configuración de servidor SMTP. Esta es una simulación.</p>
              </div>
              <button
                onClick={() => dispatch({ type: 'SET_AUTH_SCREEN', screen: 'login' })}
                className="w-full py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition"
              >
                Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => dispatch({ type: 'SET_AUTH_SCREEN', screen: 'login' })}
                className="flex items-center gap-1.5 text-sm text-fg/50 hover:text-fg mb-5 -ml-1 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver
              </button>
              <h2 className="text-lg font-semibold text-fg mb-1">Recuperar acceso</h2>
              <p className="text-sm text-fg/50 mb-6">Ingresa tu correo y te enviaremos instrucciones para restablecer tu contraseña.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-fg mb-1.5">Correo electrónico</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg/30 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="usuario@empresa.mx"
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-line rounded-lg text-sm text-fg bg-white focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy/60 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition disabled:opacity-60"
                >
                  {loading ? 'Enviando...' : 'Enviar instrucciones'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
