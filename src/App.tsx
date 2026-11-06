import { AppProvider, useApp } from './context/AppContext'
import { Layout } from './components/layout/Layout'
import Login from './pages/auth/Login'
import RecuperarAcceso from './pages/auth/RecuperarAcceso'
import CambioContrasena from './pages/auth/CambioContrasena'

function AppRouter() {
  const { state, dispatch } = useApp()
  const { authScreen } = state

  if (authScreen === 'checking') {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center text-sm text-fg/50" role="status">
        Verificando sesión…
      </div>
    )
  }
  if (authScreen === 'login') return <Login />
  if (authScreen === 'recovery' || authScreen === 'recovery-sent') return <RecuperarAcceso />
  if (authScreen === 'change-password') return <CambioContrasena />

  if (state.datosSesion === 'error') {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-3 px-4 text-center" role="alert">
        <p className="text-sm text-fg/70">No pudimos cargar tus datos. Revisa tu conexión e intenta de nuevo.</p>
        <button
          onClick={() => dispatch({ type: 'DATOS_REINTENTAR' })}
          className="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition"
        >
          Reintentar
        </button>
      </div>
    )
  }
  if (state.datosSesion !== 'listo') {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center text-sm text-fg/50" role="status">
        Cargando tus datos…
      </div>
    )
  }
  return <Layout />
}

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  )
}
