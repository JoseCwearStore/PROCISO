import { AppProvider, useApp } from './context/AppContext'
import { Layout } from './components/layout/Layout'
import Login from './pages/auth/Login'
import RecuperarAcceso from './pages/auth/RecuperarAcceso'
import CambioContrasena from './pages/auth/CambioContrasena'

function AppRouter() {
  const { state } = useApp()
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
  return <Layout />
}

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  )
}
