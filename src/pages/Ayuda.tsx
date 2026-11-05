import { useState } from 'react'
import { BookOpen, Bug, ChevronDown, FileQuestion, LifeBuoy, Send, Shield } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useApp } from '../context/AppContext'

const inputClass = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const FAQ = [
  ['¿Cómo inicio un levantamiento?', 'Abre “Levantamiento de procesos”, selecciona primero la empresa y el proyecto, y completa cada sección guiada.'],
  ['¿Qué significa Información pendiente de confirmar?', 'Indica que el sistema no encontró información existente y requiere validación de una persona responsable.'],
  ['¿Puedo usar un documento preliminar?', 'No. Debe revisarse y aprobarse por responsables autorizados antes de su uso oficial.'],
  ['¿Las listas sustituyen una auditoría?', 'No. Son autoevaluaciones o revisiones documentales y no sustituyen una auditoría formal.'],
  ['¿Qué edición de ISO 9001 debo usar?', 'ISO 9001:2026, publicada el 16 de septiembre de 2026, es la edición vigente. Usa ISO 9001:2015 únicamente para clientes que todavía se encuentren en transición y confirma sus plazos con el organismo de certificación.'],
  ['¿Dónde se guardan los archivos?', 'En este prototipo solo se conserva una referencia temporal durante la sesión del navegador.'],
]
const MODULOS = [
  ['Inicio', 'Consulta indicadores, alertas y avance general.'],
  ['Empresas y proyectos', 'Administra el contexto, responsables, fases y entregables.'],
  ['Procesos y evidencias', 'Realiza levantamientos y vincula evidencia objetiva.'],
  ['Documentación', 'Genera borradores, controla versiones y solicita aprobación.'],
  ['Verificación y no conformidades', 'Registra hallazgos y da seguimiento a acciones.'],
  ['Indicadores', 'Define qué medir, cómo calcularlo y quién es responsable.'],
]

export default function Ayuda() {
  const { showToast } = useApp()
  const [abierta, setAbierta] = useState<number | null>(0)
  const [tipo, setTipo] = useState<'soporte' | 'error'>('soporte')
  const [asunto, setAsunto] = useState('')
  const [descripcion, setDescripcion] = useState('')

  function enviar() {
    showToast(`${tipo === 'error' ? 'Reporte' : 'Solicitud'} registrado en modo demostrativo. Requiere integración.`, 'success')
    setAsunto('')
    setDescripcion('')
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6"><h2 className="text-xl font-bold text-navy">Centro de ayuda</h2><p className="mt-1 text-sm text-slate-500">Orientación paso a paso para gestionar proyectos con ISO 9001:2026 y proyectos en transición desde la edición 2015.</p><p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">ISO 9001:2026 es la edición vigente. Las organizaciones certificadas en ISO 9001:2015 disponen de un periodo de transición. Confirma los plazos con el organismo de certificación de cada cliente.</p></div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5"><div className="mb-4 flex items-center gap-2"><FileQuestion className="h-5 w-5 text-blue-600" /><h3 className="font-semibold text-slate-800">Preguntas frecuentes</h3></div><div className="space-y-2">{FAQ.map(([pregunta, respuesta], index) => <div key={pregunta} className="rounded-lg border border-line"><button onClick={() => setAbierta(abierta === index ? null : index)} className="flex w-full items-center justify-between p-3 text-left text-sm font-medium text-slate-700">{pregunta}<ChevronDown className={`h-4 w-4 transition ${abierta === index ? 'rotate-180' : ''}`} /></button>{abierta === index && <p className="border-t border-line p-3 text-sm leading-relaxed text-slate-500">{respuesta}</p>}</div>)}</div></section>
        <section className="rounded-xl border border-line bg-white p-5"><div className="mb-4 flex items-center gap-2"><BookOpen className="h-5 w-5 text-blue-600" /><h3 className="font-semibold text-slate-800">Guía por módulo</h3></div><div className="grid gap-3 sm:grid-cols-2">{MODULOS.map(([titulo, texto]) => <div key={titulo} className="rounded-lg bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-700">{titulo}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{texto}</p></div>)}</div><div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"><strong>Ayuda contextual:</strong> busca el icono de ayuda junto a los campos del levantamiento para conocer qué información capturar.</div></section>
        <section className="rounded-xl border border-line bg-white p-5"><div className="mb-4 flex items-center gap-2">{tipo === 'error' ? <Bug className="h-5 w-5 text-red-600" /> : <LifeBuoy className="h-5 w-5 text-blue-600" />}<h3 className="font-semibold text-slate-800">Soporte y reporte de errores</h3></div><div className="mb-4 flex rounded-lg bg-slate-100 p-1"><button onClick={() => setTipo('soporte')} className={`flex-1 rounded-md px-3 py-2 text-sm ${tipo === 'soporte' ? 'bg-white font-medium shadow-sm' : 'text-slate-500'}`}>Solicitar soporte</button><button onClick={() => setTipo('error')} className={`flex-1 rounded-md px-3 py-2 text-sm ${tipo === 'error' ? 'bg-white font-medium shadow-sm' : 'text-slate-500'}`}>Reportar error</button></div><div className="space-y-3"><input className={inputClass} value={asunto} onChange={(event) => setAsunto(event.target.value)} placeholder="Asunto" /><textarea rows={5} className={inputClass} value={descripcion} onChange={(event) => setDescripcion(event.target.value)} placeholder={tipo === 'error' ? 'Describe qué ocurrió y los pasos para reproducirlo.' : 'Describe cómo podemos ayudarte.'} /><Button className="w-full" disabled={!asunto.trim() || !descripcion.trim()} onClick={enviar} icon={<Send className="h-4 w-4" />}>Enviar · Requiere integración</Button></div></section>
        <section className="rounded-xl border border-line bg-white p-5"><div className="mb-4 flex items-center gap-2"><Shield className="h-5 w-5 text-blue-600" /><h3 className="font-semibold text-slate-800">Información legal</h3></div><div className="space-y-4"><article className="rounded-lg border border-line p-4"><h4 className="text-sm font-semibold text-slate-700">Aviso de privacidad</h4><p className="mt-2 text-xs leading-relaxed text-slate-500">Este prototipo de apoyo para ISO 9001:2026 y la transición desde ISO 9001:2015 utiliza datos ficticios y no debe emplearse para almacenar datos personales reales. La versión productiva deberá informar finalidades, transferencias, derechos ARCO y medios de contacto aplicables.</p></article><article className="rounded-lg border border-line p-4"><h4 className="text-sm font-semibold text-slate-700">Condiciones de servicio</h4><p className="mt-2 text-xs leading-relaxed text-slate-500">PROCISO es una herramienta de apoyo para proyectos ISO 9001:2026 y clientes aún certificados en ISO 9001:2015 durante su transición. Las decisiones de certificación, auditoría y cumplimiento corresponden a profesionales y organismos autorizados. Ninguna salida automática sustituye su criterio ni el texto oficial de la norma.</p></article></div></section>
      </div>
    </div>
  )
}
