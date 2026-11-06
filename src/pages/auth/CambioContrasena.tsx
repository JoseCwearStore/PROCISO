import { useState } from 'react'
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { servicioAuth } from '../../lib/servicios'
import type { ErrorCambioContrasena } from '../../lib/auth'

const MENSAJES_ERROR: Record<ErrorCambioContrasena, string> = {
  debil: 'La contraseña no cumple los requisitos de seguridad.',
  igual: 'La nueva contraseña debe ser distinta de la actual.',
  servicio: 'No pudimos guardar la contraseña. Intenta de nuevo en unos momentos.',
}

function getStrength(pw: string): { level: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  if (pw.length === 0) return { level: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const levels = [
    { level: 0 as const, label: '', color: '' },
    { level: 1 as const, label: 'Débil', color: 'bg-red-400' },
    { level: 2 as const, label: 'Regular', color: 'bg-amber-400' },
    { level: 3 as const, label: 'Fuerte', color: 'bg-emerald-400' },
    { level: 4 as const, label: 'Muy fuerte', color: 'bg-emerald-600' },
  ]
  return levels[score]
}

// Deben coincidir con password_requirements de supabase/config.toml, que es
// quien realmente las hace cumplir.
const REQUIREMENTS = [
  { label: 'Mínimo 8 caracteres', test: (pw: string) => pw.length >= 8 },
  { label: 'Al menos una minúscula', test: (pw: string) => /[a-z]/.test(pw) },
  { label: 'Al menos una mayúscula', test: (pw: string) => /[A-Z]/.test(pw) },
  { label: 'Al menos un número', test: (pw: string) => /[0-9]/.test(pw) },
  { label: 'Al menos un carácter especial', test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
]

export default function CambioContrasena() {
  const { state, dispatch, showToast } = useApp()
  // Los términos se aceptan en el primer acceso, no cada vez que se recupera la contraseña.
  const esPrimerAcceso = state.loginReason !== 'recovery'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [terms, setTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const strength = getStrength(password)
  const allReqs = REQUIREMENTS.every((r) => r.test(password))
  const matches = password === confirm && password.length > 0
  const canSubmit = allReqs && matches && (terms || !esPrimerAcceso)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setLoading(true)

    const resultado = await servicioAuth.cambiarContrasena(password)
    setLoading(false)

    if (!resultado.ok) {
      setError(MENSAJES_ERROR[resultado.error])
      return
    }
    showToast('Contraseña actualizada exitosamente.', 'success')
    dispatch({ type: 'SET_AUTH_SCREEN', screen: 'app' })
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-[440px]">
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
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-5 h-5 text-navy" />
            <h2 className="text-lg font-semibold text-fg">Cambio de contraseña</h2>
          </div>
          <p className="text-sm text-fg/50 mb-6">
            {esPrimerAcceso
              ? 'Tu acceso usa una contraseña temporal. Establece una contraseña personal segura para continuar.'
              : 'Elige una contraseña nueva para tu cuenta.'}
          </p>

          {error && (
            <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New password */}
            <div>
              <label className="block text-sm font-medium text-fg mb-1.5">Nueva contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg/30 pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 border border-line rounded-lg text-sm text-fg bg-white focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy/60 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-fg/30 hover:text-fg/60"
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength bar */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 h-1.5">
                    {[1, 2, 3, 4].map((n) => (
                      <div
                        key={n}
                        className={`flex-1 rounded-full transition-all ${n <= strength.level ? strength.color : 'bg-line'}`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs mt-1 font-medium ${strength.level <= 1 ? 'text-red-500' : strength.level <= 2 ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {strength.label}
                  </p>
                </div>
              )}

              {/* Requirements */}
              <ul className="mt-2 space-y-1">
                {REQUIREMENTS.map((req) => {
                  const ok = req.test(password)
                  return (
                    <li key={req.label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-emerald-600' : 'text-fg/40'}`}>
                      <CheckCircle className={`w-3.5 h-3.5 ${ok ? 'text-emerald-500' : 'text-fg/20'}`} />
                      {req.label}
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-sm font-medium text-fg mb-1.5">Confirmar contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg/30 pointer-events-none" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-10 py-2.5 border rounded-lg text-sm text-fg bg-white focus:outline-none focus:ring-2 transition ${
                    confirm.length > 0
                      ? matches
                        ? 'border-emerald-400 focus:ring-emerald-200'
                        : 'border-red-300 focus:ring-red-200'
                      : 'border-line focus:ring-navy/30 focus:border-navy/60'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-fg/30 hover:text-fg/60"
                  aria-label={showConfirm ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirm.length > 0 && !matches && (
                <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden.</p>
              )}
            </div>

            {/* Terms */}
            {esPrimerAcceso && (
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                className="mt-0.5 rounded border-line"
              />
              <span className="text-xs text-fg/60 group-hover:text-fg/80 transition">
                Acepto los{' '}
                <span className="text-navy font-medium cursor-pointer hover:underline">Términos de uso</span>{' '}
                y la{' '}
                <span className="text-navy font-medium cursor-pointer hover:underline">Política de privacidad</span>{' '}
                de PROCISO.
              </span>
            </label>
            )}

            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="w-full py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando...' : 'Establecer contraseña y continuar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-fg/30 mt-6">© {new Date().getFullYear()} PROCISO · ISO 9001:2026</p>
      </div>
    </div>
  )
}
