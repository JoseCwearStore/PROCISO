import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Modal } from './ui/Modal'
import type { PageId } from '../types'

interface Resultado {
  id: string
  tipo: string
  titulo: string
  detalle: string
  pagina: PageId
  params?: { id?: string }
}

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, navigate, getEmpresa, getProyecto } = useApp()
  const [query, setQuery] = useState('')
  const [tipo, setTipo] = useState('')

  const resultados = useMemo(() => {
    let items: Resultado[]
    if (state.currentRole === 'Admin PROCISO') {
      items = [
        ...state.consultorias.map((item) => ({ id: item.id, tipo: 'Consultoría', titulo: item.nombre, detalle: `${item.plan} · ${item.activa ? 'Activa' : 'Suspendida'}`, pagina: 'inicio' as PageId })),
        ...state.usuarios.map((item) => ({ id: item.id, tipo: 'Usuario', titulo: item.nombre, detalle: `${item.rol} · ${item.activo ? 'Activo' : 'Suspendido'}`, pagina: 'usuarios' as PageId })),
      ]
    } else {
      const usuario = state.usuarios.find((item) => item.email === state.currentUser?.email)
      const cliente = usuario?.empresaId ? usuario : state.usuarios.find((item) => item.rol === 'Usuario Cliente' && item.activo)
      const empresaId = state.currentRole === 'Usuario Cliente' ? cliente?.empresaId : undefined
      const empresas = empresaId ? state.empresas.filter((item) => item.id === empresaId) : state.empresas
      const proyectos = empresaId ? state.proyectos.filter((item) => item.empresaId === empresaId) : state.proyectos
      const proyectoIds = new Set(proyectos.map((item) => item.id))
      const procesos = empresaId ? state.procesos.filter((item) => proyectoIds.has(item.proyectoId)) : state.procesos
      items = [
        ...(state.currentRole === 'Usuario Cliente' ? [] : empresas.map((item) => ({ id: item.id, tipo: 'Empresa', titulo: item.nombre, detalle: `${item.sector} · ${item.ciudad}`, pagina: 'empresa-detalle' as PageId, params: { id: item.id } }))),
        ...(state.currentRole === 'Usuario Cliente' ? [] : proyectos.map((item) => ({ id: item.id, tipo: 'Proyecto', titulo: item.nombre, detalle: getEmpresa(item.empresaId)?.nombre || '', pagina: 'proyecto-detalle' as PageId, params: { id: item.id } }))),
        ...(state.currentRole === 'Usuario Cliente' ? [] : procesos.map((item) => ({ id: item.id, tipo: 'Proceso', titulo: item.nombre, detalle: getProyecto(item.proyectoId)?.nombre || '', pagina: 'procesos' as PageId, params: { id: item.id } }))),
        ...(state.currentRole === 'Usuario Cliente' ? [] : procesos.flatMap((proceso) => (proceso.actividades || []).map((item) => ({ id: item.id, tipo: 'Actividad', titulo: item.descripcion, detalle: proceso.nombre, pagina: 'procesos' as PageId, params: { id: proceso.id } })))),
        ...state.documentos.filter((item) => !empresaId || proyectoIds.has(item.proyectoId)).map((item) => ({ id: item.id, tipo: 'Documento', titulo: item.nombre, detalle: `${item.codigo || 'Sin código'} · ${item.estado}`, pagina: 'documentacion' as PageId })),
        ...state.evidencias.filter((item) => !empresaId || proyectoIds.has(item.proyectoId)).map((item) => ({ id: item.id, tipo: 'Evidencia', titulo: item.nombre, detalle: `${item.tipo} · ${item.estado}`, pagina: 'evidencias' as PageId })),
        ...state.tareas.filter((item) => !empresaId || proyectoIds.has(item.proyectoId)).map((item) => ({ id: item.id, tipo: 'Tarea', titulo: item.titulo, detalle: `${item.prioridad} · ${item.estado}`, pagina: 'tablero-tareas' as PageId })),
      ]
    }
    const q = query.trim().toLowerCase()
    return items.filter((item) => (!tipo || item.tipo === tipo) && (!q || `${item.titulo} ${item.detalle} ${item.id}`.toLowerCase().includes(q))).slice(0, 50)
  }, [getEmpresa, getProyecto, query, state.consultorias, state.currentRole, state.currentUser?.email, state.documentos, state.empresas, state.evidencias, state.procesos, state.proyectos, state.tareas, state.usuarios, tipo])

  return (
    <Modal open={open} onClose={onClose} title="Búsqueda global" size="xl">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-lg border border-line py-2 pl-9 pr-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="Buscar por nombre, código o descripción..." /></label>
          <select value={tipo} onChange={(event) => setTipo(event.target.value)} className="rounded-lg border border-line bg-white px-3 py-2 text-sm"><option value="">Todos los tipos</option>{(state.currentRole === 'Admin PROCISO' ? ['Consultoría', 'Usuario'] : state.currentRole === 'Usuario Cliente' ? ['Documento', 'Evidencia', 'Tarea'] : ['Empresa', 'Proyecto', 'Proceso', 'Actividad', 'Documento', 'Evidencia', 'Tarea']).map((item) => <option key={item}>{item}</option>)}</select>
        </div>
        <p className="text-xs text-slate-400">{resultados.length} resultados</p>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          {resultados.map((item) => <button key={`${item.tipo}-${item.id}`} onClick={() => { navigate(item.pagina, item.params); onClose() }} className="flex w-full items-start gap-3 rounded-lg border border-line p-3 text-left hover:border-blue-200 hover:bg-blue-50"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-500">{item.tipo}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{item.titulo}</p><p className="mt-1 truncate text-xs text-slate-400">{item.id} · {item.detalle}</p></div></button>)}
          {resultados.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">Sin resultados para la búsqueda y filtros seleccionados.</p>}
        </div>
      </div>
    </Modal>
  )
}
