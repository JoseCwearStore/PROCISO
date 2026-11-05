import { useState } from 'react'
import { Eye, EyeOff, Lock, Mail, AlertCircle, Info } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { DEMO_CREDENTIALS } from '../../types'

const BLOCKED_EMAIL = 'bloqueado@demo.mx'
const TEMP_EMAIL = 'temporal@demo.mx'
const MAX_ATTEMPTS = 3

export default function Login() {
  const { state, dispatch } = useApp()
  const { loginAttempts, loginReason } = state

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState('')

  const isBlocked = loginAttempts >= MAX_ATTEMPTS

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isBlocked) return
    setLoading(true)
    setLocalError('')

    setTimeout(() => {
      setLoading(false)

      if (email.toLowerCase() === BLOCKED_EMAIL) {
        dispatch({
          type: 'SET_AUTH_SCREEN',
          screen: 'login',
          reason: 'blocked',
        })
        setLocalError('Esta cuenta ha sido bloqueada. Contacte al administrador.')
        dispatch({ type: 'LOGIN_FAIL', error: 'blocked' })
        return
      }

      const cred = DEMO_CREDENTIALS.find(
        (c) => c.email === email.toLowerCase() && c.password === password
      )

      if (!cred) {
        const newAttempts = loginAttempts + 1
        const remaining = MAX_ATTEMPTS - newAttempts
        dispatch({ type: 'LOGIN_FAIL', error: 'invalid' })
        if (newAttempts >= MAX_ATTEMPTS) {
          setLocalError('Cuenta bloqueada temporalmente por demasiados intentos fallidos.')
        } else {
          setLocalError(
            `Correo o contraseña incorrectos. ${remaining} intento${remaining === 1 ? '' : 's'} restante${remaining === 1 ? '' : 's'}.`
          )
        }
        return
      }

      if (cred.rol === null) {
        setLocalError('Esta cuenta no tiene acceso activo. Contacte al administrador.')
        dispatch({ type: 'LOGIN_FAIL', error: 'blocked' })
        return
      }

      const isTemp = email.toLowerCase() === TEMP_EMAIL

      dispatch({
        type: 'LOGIN_SUCCESS',
        user: {
          id: `usr-${email}`,
          nombre: cred.nombre ?? email,
          email: cred.email,
          rol: cred.rol as import('../../types').Rol,
          passwordTemp: isTemp,
        },
      })
    }, 700)
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-8 border-0 border-none flex flex-col">
          <img
            src="/prociso-logo-horizontal.svg"
            alt="PROCISO"
            className="mx-auto mb-4 h-16 w-auto max-w-full"
          />
          <p className="text-sm text-fg/50 mt-1">Sistema de Gestión de Calidad ISO 9001:2026</p>
        </div>

        {/* Session expired / reason banner */}
        {loginReason === 'expired' && (
          <div className="mb-4 flex gap-2 items-start bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Tu sesión expiró. Inicia sesión nuevamente.</span>
          </div>
        )}

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-line p-8">
          <h2 className="text-lg font-semibold text-fg mb-1">Iniciar sesión</h2>
          <p className="text-sm text-fg/50 mb-6">Ingresa tus credenciales de acceso.</p>

          {/* Blocked state */}
          {isBlocked ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 text-center">
              <Lock className="w-8 h-8 mx-auto mb-2 text-red-400" />
              <p className="font-medium">Cuenta bloqueada temporalmente</p>
              <p className="mt-1 text-red-600/80">Demasiados intentos fallidos. Usa "¿Olvidaste tu contraseña?" para recuperar acceso.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {localError && (
                <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{localError}</span>
                </div>
              )}

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

              <div>
                <label className="block text-sm font-medium text-fg mb-1.5">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg/30 pointer-events-none" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
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
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-fg/40">
                  <input type="checkbox" disabled className="rounded border-line" />
                  Recordar sesión · Requiere integración
                </label>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_AUTH_SCREEN', screen: 'recovery' })}
                  className="text-navy hover:underline font-medium"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Verificando...' : 'Iniciar sesión'}
              </button>
            </form>
          )}

          {isBlocked && (
            <button
              onClick={() => dispatch({ type: 'SET_AUTH_SCREEN', screen: 'recovery' })}
              className="mt-4 w-full py-2.5 border border-navy text-navy text-sm font-semibold rounded-lg hover:bg-navy/5 transition"
            >
              Recuperar acceso
            </button>
          )}
        </div>

        {/* Demo credentials panel */}
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-amber-800">
            <Info className="w-4 h-4 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wide">ENTORNO DEMO — Credenciales visibles</span>
          </div>
          <div className="space-y-1.5">
            {DEMO_CREDENTIALS.filter((c) => c.rol !== null).map((c) => (
              <button
                key={c.email}
                onClick={() => {
                  setEmail(c.email)
                  setPassword(c.password)
                  dispatch({ type: 'LOGIN_RESET_ATTEMPTS' })
                }}
                className="w-full flex items-center justify-between text-left px-3 py-2 bg-white border border-amber-100 rounded-lg hover:border-amber-300 hover:bg-amber-50/60 transition text-xs"
              >
                <div>
                  <span className="font-medium text-amber-900">{c.nombre}</span>
                  <span className="text-amber-600 ml-1.5">· {c.rol}</span>
                </div>
                <span className="text-amber-500 font-mono">{c.email}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-amber-600 mt-2">Haz clic en cualquier fila para autocompletar las credenciales.</p>
        </div>

        <p className="text-center text-xs text-fg/30 mt-6">
          © {new Date().getFullYear()} PROCISO · ISO 9001:2026 · Simulación de demostración
        </p>
      </div>
    </div>
  )
}
