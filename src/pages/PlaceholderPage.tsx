import { Construction } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button } from '../components/ui/Button'

const PAGE_DESCRIPTIONS: Record<string, string> = {
  levantamiento: 'Formularios guiados para registrar procesos con fotos, videos, audios y respuestas estructuradas.',
  procesos: 'Mapa y gestión de procesos identificados en el SGC del proyecto.',
  evidencias: 'Repositorio de evidencias documentales, fotográficas y multimedia por proceso.',
  documentacion: 'Borradores documentales del SGC: procedimientos, manuales, instrucciones y formatos.',
  revisiones: 'Flujo de revisión y aprobación de documentos del SGC.',
  'listas-verificacion': 'Listas de verificación de cumplimiento de requisitos de la norma.',
  'no-conformidades': 'Registro, análisis y seguimiento de no conformidades y acciones correctivas.',
  indicadores: 'Indicadores de avance e informes de gestión del proyecto.',
  usuarios: 'Gestión de usuarios, roles y permisos de la plataforma.',
  configuracion: 'Configuración del proyecto, edición de la norma y parámetros del SGC.',
  ayuda: 'Guías de uso, preguntas frecuentes y soporte técnico.',
}

export function PlaceholderPage() {
  const { state, navigate } = useApp()
  const description = PAGE_DESCRIPTIONS[state.currentPage] ?? 'Esta sección está en desarrollo.'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
        <Construction className="w-8 h-8 text-slate-400" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-700 mb-1">Próximamente</h2>
        <p className="text-sm text-slate-500 max-w-sm">{description}</p>
        <p className="text-xs text-slate-400 mt-2">Esta sección se desarrollará en fases posteriores del prototipo.</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => navigate('inicio')}>
        Volver al inicio
      </Button>
    </div>
  )
}
