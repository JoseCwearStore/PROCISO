import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY. Copia .env.example a .env.local y complétalo.',
  )
}

// Único cliente de Supabase de la app. La publishable key es pública por diseño:
// la seguridad la da el RLS de la base, no ocultar esta clave.
export const supabase = createClient(url, publishableKey)
