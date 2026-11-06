import { useState } from 'react'
import { KeyRound, ShieldCheck, UserPlus, Users as UsersIcon } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Modal } from '../components/ui/Modal'
import { useAccionesAdministracion } from '../hooks/useAccionesAdministracion'
import type { Rol, Usuario } from '../types'

const ROLES: Rol[] = ['Admin PROCISO', 'Admin Consultoría', 'Consultor', 'Usuario Cliente']
const MODULOS = ['Empresas', 'Proyectos', 'Procesos', 'Evidencias', 'Documentación', 'Revisiones', 'Usuarios', 'Configuración']
const PERMISOS: Record<Rol, string[]> = {
  'Admin PROCISO': MODULOS,
  'Admin Consultoría': MODULOS,
  'Consultor': ['Empresas', 'Proyectos', 'Procesos', 'Evidencias', 'Documentación', 'Revisiones'],
  'Usuario Cliente': ['Proyectos', 'Procesos', 'Evidencias', 'Documentación'],
}
const inputClass = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'

export default function Usuarios() {
  const { state, dispatch, showToast } = useApp()
  const acciones = useAccionesAdministracion()
  const [tab, setTab] = useState<'usuarios' | 'matriz'>('usuarios')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [suspender, setSuspender] = useState<Usuario | null>(null)
  const [form, setForm] = useState({ nombre: '', email: '', cargo: '', rol: 'Consultor' as Rol })

  function invitar() {
    if (!form.nombre.trim() || !form.email.trim()) return
    const usuario: Usuario = {
      id: `usr-${Date.now()}`,
      nombre: form.nombre.trim(),
      email: form.email.trim(),
      cargo: form.cargo.trim(),
      rol: form.rol,
      proyectosAsignados: [],
      activo: true,
    }
    dispatch({ type: 'UPSERT_USUARIO', usuario })
    dispatch({
      type: 'APPEND_AUDIT',
      entrada: {
        id: `hist-${Date.now()}`,
        fecha: new Date().toLocaleString('es-MX'),
        autorId: state.currentUser?.id || 'aaaaaaaa-0000-0000-0000-000000000002',
        accion: 'Usuario invitado',
        descripcion: `${usuario.email}; rol ${usuario.rol}. No se generó ni mostró una contraseña.`,
        entidadId: usuario.id,
        entidadTipo: 'empresa',
      },
    })
    setInviteOpen(false)
    setForm({ nombre: '', email: '', cargo: '', rol: 'Consultor' })
    showToast('Invitación simulada. Requiere integración de correo.', 'success')
  }

  async function cambiarAcceso(usuario: Usuario) {
    if (await acciones.cambiarAcceso(usuario, !usuario.activo)) {
      showToast(usuario.activo ? 'Acceso suspendido. Quedó registrado en el historial.' : 'Acceso restablecido.', 'success')
    }
    setSuspender(null)
  }

  async function cambiarRol(usuario: Usuario, rol: Rol) {
    if (await acciones.cambiarRol(usuario, rol)) showToast('Rol actualizado. Quedó registrado en el historial.', 'success')
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-navy">Usuarios y permisos</h2><p className="mt-1 text-sm text-slate-500">Accesos por rol sin exposición de contraseñas.</p></div>{tab === 'usuarios' && <Button onClick={() => setInviteOpen(true)} icon={<UserPlus className="h-4 w-4" />}>Invitar usuario</Button>}</div>
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"><KeyRound className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Procedimiento seguro de acceso</p><p className="mt-1 text-xs">PROCISO nunca muestra contraseñas. Las invitaciones y recuperaciones reales requieren un proveedor de identidad y correo.</p></div></div>
      <div className="mb-5 flex gap-1 border-b border-line"><button onClick={() => setTab('usuarios')} className={`border-b-2 px-4 py-3 text-sm font-medium ${tab === 'usuarios' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Usuarios</button><button onClick={() => setTab('matriz')} className={`border-b-2 px-4 py-3 text-sm font-medium ${tab === 'matriz' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Matriz de permisos</button></div>
      {tab === 'usuarios' ? <div className="overflow-hidden rounded-xl border border-line bg-white">{state.usuarios.map((usuario) => <div key={usuario.id} className="flex flex-wrap items-center gap-4 border-b border-line p-4 last:border-0"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600">{usuario.nombre.split(' ').map((item) => item[0]).slice(0, 2).join('')}</div><div className="min-w-52 flex-1"><p className="text-sm font-semibold text-slate-800">{usuario.nombre}</p><p className="text-xs text-slate-400">{usuario.email} · {usuario.cargo}</p></div>{acciones.puedeCambiarRol(usuario) ? <select className={`${inputClass} max-w-52`} value={usuario.rol} onChange={(event) => void cambiarRol(usuario, event.target.value as Rol)}>{acciones.rolesDelEquipo.map((rol) => <option key={rol}>{rol}</option>)}</select> : <span className="min-w-52 text-sm text-slate-600">{usuario.rol}</span>}<span className={`rounded-full px-2 py-1 text-xs font-medium ${usuario.activo ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{usuario.activo ? 'Activo' : 'Suspendido'}</span><Button variant="outline" size="sm" disabled={!acciones.puedeAdministrar(usuario)} onClick={() => usuario.activo ? setSuspender(usuario) : void cambiarAcceso(usuario)}>{usuario.activo ? 'Suspender' : 'Restablecer acceso'}</Button></div>)}</div> : <div className="overflow-x-auto rounded-xl border border-line bg-white"><table className="min-w-[900px] w-full text-sm"><thead><tr className="border-b border-line bg-slate-50"><th className="px-4 py-3 text-left">Módulo</th>{ROLES.map((rol) => <th key={rol} className="px-4 py-3 text-center text-xs">{rol}</th>)}</tr></thead><tbody>{MODULOS.map((modulo) => <tr key={modulo} className="border-b border-line last:border-0"><td className="px-4 py-3 font-medium text-slate-700">{modulo}</td>{ROLES.map((rol) => <td key={rol} className="px-4 py-3 text-center">{PERMISOS[rol].includes(modulo) ? <ShieldCheck className="mx-auto h-5 w-5 text-emerald-500" /> : <span className="text-slate-300">—</span>}</td>)}</tr>)}</tbody></table></div>}

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invitar usuario" footer={<><Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button><Button onClick={invitar} disabled={!form.nombre.trim() || !form.email.trim()}>Enviar invitación</Button></>}>
        <div className="space-y-4"><label className="block"><span className="mb-1.5 block text-sm font-medium">Nombre *</span><input className={inputClass} value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></label><label className="block"><span className="mb-1.5 block text-sm font-medium">Correo *</span><input type="email" className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="block"><span className="mb-1.5 block text-sm font-medium">Cargo</span><input className={inputClass} value={form.cargo} onChange={(event) => setForm({ ...form, cargo: event.target.value })} /></label><label className="block"><span className="mb-1.5 block text-sm font-medium">Rol</span><select className={inputClass} value={form.rol} onChange={(event) => setForm({ ...form, rol: event.target.value as Rol })}>{ROLES.map((rol) => <option key={rol}>{rol}</option>)}</select></label><p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">DEMO · El envío de la invitación requiere integración de correo. No se generan contraseñas visibles.</p></div>
      </Modal>
      <ConfirmDialog open={!!suspender} onClose={() => setSuspender(null)} onConfirm={() => suspender && cambiarAcceso(suspender)} title="Suspender acceso" message={`Se cerrará el acceso de ${suspender?.nombre || 'este usuario'} sin eliminar su historial. Esta acción queda registrada en la auditoría.`} confirmLabel="Suspender acceso" />
    </div>
  )
}
