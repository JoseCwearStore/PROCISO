import { createClient } from '@supabase/supabase-js'
import { esEnlaceDeRecuperacion } from './auth'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY. Copia .env.example a .env.local y complétalo.',
  )
}

// Se lee ANTES de crear el cliente: al crearse, el cliente consume el hash de
// la URL y lo borra, y su evento PASSWORD_RECOVERY puede dispararse antes de
// que React alcance a suscribirse.
export const llegoDesdeEnlaceDeRecuperacion = esEnlaceDeRecuperacion(window.location.hash)

// Único cliente de Supabase de la app. La publishable key es pública por diseño:
// la seguridad la da el RLS de la base, no ocultar esta clave.
export const supabase = createClient(url, publishableKey)
