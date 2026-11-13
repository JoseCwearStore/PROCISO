import { useState } from 'react'
import { Crown, UserMinus, UserPlus, Users } from 'lucide-react'
import { Button } from './ui/Button'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { useApp } from '../context/AppContext'
import { useAccionesEquipo } from '../hooks/useAccionesEquipo'
import { candidatosEquipo, candidatosResponsable, mensajeQuitarDelEquipo, miembrosDelEquipo, type MiembroEquipo } from '../lib/equipoProyecto'
import type { Proyecto, Usuario } from '../types'

const rolColor: Record<string, string> = {
  'Admin PROCISO': 'bg-purple-100 text-purple-700',
  'Admin Consultoría': 'bg-blue-100 text-blue-700',
  Consultor: 'bg-indigo-100 text-indigo-700',
  'Usuario Cliente': 'bg-slate-100 text-slate-600',
}
const selectCls = 'min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm'

// Equipo de un proyecto (L5d, D8). Todos lo ven; solo el Admin de la consultoría lo cambia.
export function EquipoProyecto({ proyecto }: { proyecto: Proyecto }) {
  const { state } = useApp()
  const acciones = useAccionesEquipo()
  const [aAgregar, setAAgregar] = useState('')
  const [nuevoResponsable, setNuevoResponsable] = useState('')
  const [aQuitar, setAQuitar] = useState<Usuario | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const miembros = miembrosDelEquipo(proyecto, state.usuarios)
  const candidatos = candidatosEquipo(proyecto, state.usuarios, acciones.consultoriaId)
  const candidatosResp = candidatosResponsable(proyecto, state.usuarios, acciones.consultoriaId)

  async function ejecutar(accion: () => Promise<boolean>, despues?: () => void) {
    setOcupado(true)
    const ok = await accion()
    setOcupado(false)
    if (ok) despues?.()
  }

  return (
    <div className="space-y-4">
      {acciones.puedeGestionar ? (
        <div className="space-y-3 rounded-xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="w-40 shrink-0 text-sm font-medium text-slate-700" htmlFor="agregar-miembro">Agregar al equipo</label>
            <select id="agregar-miembro" className={selectCls} value={aAgregar} onChange={(e) => setAAgregar(e.target.value)} disabled={!candidatos.length}>
              <option value="">{candidatos.length ? 'Elige una persona…' : 'Todo el equipo ya está en el proyecto'}</option>
              {candidatos.map((u) => <option key={u.id} value={u.id}>{u.nombre} · {u.rol}</option>)}
            </select>
            <Button size="sm" disabled={!aAgregar || ocupado} icon={<UserPlus className="h-4 w-4" />}
              onClick={() => void ejecutar(() => acciones.agregar(proyecto, aAgregar), () => setAAgregar(''))}>
              Agregar
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="w-40 shrink-0 text-sm font-medium text-slate-700" htmlFor="cambiar-responsable">Cambiar responsable</label>
            <select id="cambiar-responsable" className={selectCls} value={nuevoResponsable} onChange={(e) => setNuevoResponsable(e.target.value)} disabled={!candidatosResp.length}>
              <option value="">{candidatosResp.length ? 'Elige al nuevo responsable…' : 'No hay otra persona disponible'}</option>
              {candidatosResp.map((u) => <option key={u.id} value={u.id}>{u.nombre} · {u.rol}</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={!nuevoResponsable || ocupado} icon={<Crown className="h-4 w-4" />}
              onClick={() => void ejecutar(() => acciones.cambiarResponsable(proyecto, nuevoResponsable), () => setNuevoResponsable(''))}>
              Cambiar
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Solo el administrador de la consultoría arma el equipo del proyecto.</p>
      )}

      {miembros.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">Este proyecto todavía no tiene equipo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {miembros.map((m) => <TarjetaMiembro key={m.usuario.id} miembro={m} puedeQuitar={acciones.puedeGestionar} onQuitar={() => setAQuitar(m.usuario)} />)}
        </div>
      )}

      <ConfirmDialog
        open={!!aQuitar}
        onClose={() => setAQuitar(null)}
        onConfirm={() => aQuitar && void ejecutar(() => acciones.quitar(proyecto, aQuitar.id), () => setAQuitar(null))}
        title="Quitar del equipo"
        message={mensajeQuitarDelEquipo(aQuitar?.nombre)}
        confirmLabel="Quitar"
      />
    </div>
  )
}

function TarjetaMiembro({ miembro, puedeQuitar, onQuitar }: { miembro: MiembroEquipo; puedeQuitar: boolean; onQuitar: () => void }) {
  const { usuario, esResponsable } = miembro
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
        {usuario.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('')}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-800">
          <span>{usuario.nombre}</span>
          {esResponsable && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Responsable</span>}
        </p>
        <p className="truncate text-xs text-slate-500">{usuario.cargo}</p>
      </div>
      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${rolColor[usuario.rol] ?? 'bg-slate-100 text-slate-600'}`}>{usuario.rol}</span>
      {puedeQuitar && (
        <Button size="sm" variant="ghost" disabled={esResponsable} title={esResponsable ? 'Es el responsable: cámbialo antes de quitarlo' : undefined}
          aria-label={`Quitar a ${usuario.nombre}`} icon={<UserMinus className="h-4 w-4" />} onClick={onQuitar}>
          Quitar
        </Button>
      )}
    </div>
  )
}
