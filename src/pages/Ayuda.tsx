import { useState } from 'react'
import { BookOpen, ChevronDown, FileQuestion, Shield } from 'lucide-react'
import { SoporteReportes } from '../components/SoporteReportes'

const FAQ = [
  ['¿Cómo inicio un levantamiento?', 'Abre “Levantamiento de procesos”, selecciona primero la empresa y el proyecto, y completa cada sección guiada.'],
  ['¿Qué significa Información pendiente de confirmar?', 'Indica que el sistema no encontró información existente y requiere validación de una persona responsable.'],
  ['¿Puedo usar un documento preliminar?', 'No. Debe revisarse y aprobarse por responsables autorizados antes de su uso oficial.'],
  ['¿Las listas sustituyen una auditoría?', 'No. Son autoevaluaciones o revisiones documentales y no sustituyen una auditoría formal.'],
  ['¿Qué edición de ISO 9001 debo usar?', 'ISO 9001:2026, publicada el 16 de septiembre de 2026, es la edición vigente. Usa ISO 9001:2015 únicamente para clientes que todavía se encuentren en transición y confirma sus plazos con el organismo de certificación.'],
  ['¿Dónde se guardan los archivos?', 'Las evidencias se guardan en un almacenamiento privado, vinculadas a su proyecto. Solo las ven el equipo de la consultoría y la empresa cliente de ese proyecto.'],
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
  const [abierta, setAbierta] = useState<number | null>(0)

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6"><h2 className="text-xl font-bold text-navy">Centro de ayuda</h2><p className="mt-1 text-sm text-slate-500">Orientación paso a paso para gestionar proyectos con ISO 9001:2026 y proyectos en transición desde la edición 2015.</p><p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">ISO 9001:2026 es la edición vigente. Las organizaciones certificadas en ISO 9001:2015 disponen de un periodo de transición. Confirma los plazos con el organismo de certificación de cada cliente.</p></div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5"><div className="mb-4 flex items-center gap-2"><FileQuestion className="h-5 w-5 text-blue-600" /><h3 className="font-semibold text-slate-800">Preguntas frecuentes</h3></div><div className="space-y-2">{FAQ.map(([pregunta, respuesta], index) => <div key={pregunta} className="rounded-lg border border-line"><button onClick={() => setAbierta(abierta === index ? null : index)} className="flex w-full items-center justify-between p-3 text-left text-sm font-medium text-slate-700">{pregunta}<ChevronDown className={`h-4 w-4 transition ${abierta === index ? 'rotate-180' : ''}`} /></button>{abierta === index && <p className="border-t border-line p-3 text-sm leading-relaxed text-slate-500">{respuesta}</p>}</div>)}</div></section>
        <section className="rounded-xl border border-line bg-white p-5"><div className="mb-4 flex items-center gap-2"><BookOpen className="h-5 w-5 text-blue-600" /><h3 className="font-semibold text-slate-800">Guía por módulo</h3></div><div className="grid gap-3 sm:grid-cols-2">{MODULOS.map(([titulo, texto]) => <div key={titulo} className="rounded-lg bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-700">{titulo}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{texto}</p></div>)}</div><div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"><strong>Ayuda contextual:</strong> busca el icono de ayuda junto a los campos del levantamiento para conocer qué información capturar.</div></section>
        <SoporteReportes />
        <section className="rounded-xl border border-line bg-white p-5"><div className="mb-4 flex items-center gap-2"><Shield className="h-5 w-5 text-blue-600" /><h3 className="font-semibold text-slate-800">Información legal</h3></div><div className="space-y-4"><article className="rounded-lg border border-line p-4"><h4 className="text-sm font-semibold text-slate-700">Aviso de privacidad</h4><p className="mt-2 text-xs leading-relaxed text-slate-500">PROCISO es un proyecto con fines académicos. La información que se registra (empresas, proyectos, documentos y evidencias) se guarda en la base de datos del sistema y solo la ve quien tiene permiso: el equipo de la consultoría y la empresa a la que pertenece. Los datos de ejemplo incluidos son de empresas imaginarias. Un uso productivo deberá informar finalidades, transferencias, derechos ARCO y medios de contacto aplicables.</p></article><article className="rounded-lg border border-line p-4"><h4 className="text-sm font-semibold text-slate-700">Condiciones de servicio</h4><p className="mt-2 text-xs leading-relaxed text-slate-500">PROCISO es una herramienta de apoyo para proyectos ISO 9001:2026 y clientes aún certificados en ISO 9001:2015 durante su transición. Las decisiones de certificación, auditoría y cumplimiento corresponden a profesionales y organismos autorizados. Ninguna salida automática sustituye su criterio ni el texto oficial de la norma.</p></article></div></section>
      </div>
    </div>
  )
}
