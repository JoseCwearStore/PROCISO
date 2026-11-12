import { Building2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { datosDeConsultoria } from '../lib/consultoria'

// Configuración (AUD07-M3, L5c, D7). Antes era una maqueta que no guardaba nada y traía controles de
// seguridad que no hacían nada (sesión inactiva, doble factor) y datos de otra consultoría. Ahora
// muestra solo lo real: los datos de la consultoría, tal como están en la base de datos.
export default function Configuracion() {
  const { state } = useApp()
  const consultorias = state.consultorias

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-navy">Configuración</h2>
        <p className="mt-1 text-sm text-slate-500">
          {consultorias.length > 1 ? 'Datos de las consultorías de la plataforma.' : 'Datos de tu consultoría.'}
        </p>
      </div>

      {consultorias.length === 0 && (
        <p className="rounded-xl border border-line bg-white p-5 text-sm text-slate-500">No hay datos de consultoría para mostrar.</p>
      )}

      <div className="space-y-5">
        {consultorias.map((consultoria) => (
          <section key={consultoria.id} className="rounded-xl border border-line bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-800">{consultoria.nombre}</h3>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              {datosDeConsultoria(consultoria, state.usuarios).map(({ etiqueta, valor }) => (
                <div key={etiqueta} className="rounded-lg bg-slate-50 p-4">
                  <dt className="text-xs text-slate-400">{etiqueta}</dt>
                  <dd className="mt-1 font-semibold text-slate-700">{valor}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <p className="mt-5 text-xs text-slate-400">Para cambiar estos datos, contacta al administrador de PROCISO.</p>
    </div>
  )
}
