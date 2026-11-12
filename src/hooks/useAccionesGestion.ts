import { useApp } from '../context/AppContext'
import { permisosGestion } from '../lib/gestion'

// Única puerta de "qué ofrece la gestión de empresas y proyectos según el rol". Espejo de la BD
// (solo UX): la autorización real la hace el RLS.
export function useAccionesGestion() {
  const { state } = useApp()
  return permisosGestion(state.currentRole)
}
