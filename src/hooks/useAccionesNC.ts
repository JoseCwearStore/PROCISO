import { useApp } from '../context/AppContext'
import { usuariosAsignables } from '../lib/asignables'
import { formatearFecha } from '../lib/datos'
import { type DatosNC, type TratamientoNC, mensajeDeError, type FallaEscritura } from '../lib/escrituras'
import { accionesNC, lineasDeAccion, tratamientoEditable } from '../lib/noConformidades'
import { servicioEscritura } from '../lib/servicios'
import { fechaISO, hoyLocal } from '../lib/tareas'
import type { EstadoNC, NoConformidad, Rol, Usuario } from '../types'

const EQUIPO: Rol[] = ['Admin PROCISO', 'Admin Consultoría', 'Consultor']

// Única puerta de escritura de no conformidades desde la interfaz. Escritura
// pesimista: primero la BD; si acepta, se refleja lo mismo que hizo el servidor.
export function useAccionesNC() {
  const { state, dispatch, showToast } = useApp()
  const usuarioId = state.currentUser?.id ?? ''
  const consultoriaId = state.currentUser?.consultoriaId ?? null
  const esEquipo = EQUIPO.includes(state.currentRole)

  const fallo = (falla: FallaEscritura) => {
    showToast(mensajeDeError(falla), 'error')
    return null
  }
  const evento = (accion: string, detalle: string) => ({
    id: crypto.randomUUID(),
    fecha: formatearFecha(hoyLocal()),
    autorId: usuarioId,
    accion,
    detalle,
  })
  const conTratamiento = (nc: NoConformidad, t: TratamientoNC): NoConformidad => ({
    ...nc,
    correccionInmediata: t.correccion.trim(),
    analisisCausa: t.causa.trim(),
    accionCorrectiva: t.accion.trim(),
    acciones: lineasDeAccion(t.accion),
    historial: [...(nc.historial ?? []), evento('Tratamiento actualizado', 'Corrección, análisis de causa y acción correctiva.')],
  })

  async function guardarTratamiento(nc: NoConformidad, t: TratamientoNC): Promise<NoConformidad | null> {
    const resultado = await servicioEscritura.guardarTratamientoNC(nc.id, t)
    return resultado.ok ? conTratamiento(nc, t) : fallo(resultado)
  }

  const mismoTratamiento = (nc: NoConformidad, t: TratamientoNC) =>
    (nc.correccionInmediata ?? '') === t.correccion.trim() &&
    (nc.analisisCausa ?? '') === t.causa.trim() &&
    (nc.accionCorrectiva ?? '') === t.accion.trim()

  return {
    esEquipo,
    acciones: (nc: Pick<NoConformidad, 'estado'>) => accionesNC(nc, esEquipo),
    tratamientoEditable,
    responsables: (proyectoId: string): Usuario[] => usuariosAsignables(state.usuarios, proyectoId),

    // Solo el equipo registra. Si además trae tratamiento, se guarda a continuación.
    async registrar(datos: DatosNC, t: TratamientoNC): Promise<NoConformidad | null> {
      const resultado = await servicioEscritura.registrarNoConformidad(consultoriaId, crypto.randomUUID(), datos)
      if (!resultado.ok) return fallo(resultado)
      let nc: NoConformidad = {
        ...resultado.valor,
        empresaId: state.proyectos.find((p) => p.id === datos.proyectoId)?.empresaId,
        historial: [evento('No conformidad registrada', `${resultado.valor.folio}: ${datos.descripcion.trim()}`)],
      }
      if (!mismoTratamiento(nc, t)) {
        const tratada = await guardarTratamiento(nc, t)
        // La NC ya existe en la BD: se muestra igual, aunque el tratamiento haya fallado.
        if (tratada) nc = tratada
      }
      dispatch({ type: 'UPSERT_NC', noConformidad: nc })
      return nc
    },

    // Guarda lo que cambió: el registro (solo equipo) y el tratamiento (mientras se pueda).
    async guardar(nc: NoConformidad, datos: DatosNC | null, t: TratamientoNC): Promise<NoConformidad | null> {
      let actual = nc
      if (datos && esEquipo) {
        const resultado = await servicioEscritura.editarNoConformidad(nc.id, datos)
        if (!resultado.ok) return fallo(resultado)
        actual = {
          ...actual,
          titulo: datos.titulo.trim(),
          descripcion: datos.descripcion.trim(),
          tipo: datos.tipo,
          detectadaEn: datos.detectadaEn.trim(),
          fechaDeteccion: formatearFecha(fechaISO(datos.fechaDeteccion)),
          procesoId: datos.procesoId || undefined,
          evidenciaIds: datos.evidenciaIds,
          responsableId: datos.responsableId,
          responsableAccionId: datos.responsableAccionId || undefined,
          fechaLimite: datos.fechaLimite ? formatearFecha(fechaISO(datos.fechaLimite)) : undefined,
          observaciones: datos.observaciones.trim(),
        }
      }
      if (tratamientoEditable(actual) && !mismoTratamiento(actual, t)) {
        const tratada = await guardarTratamiento(actual, t)
        if (!tratada) return null
        actual = tratada
      }
      dispatch({ type: 'UPSERT_NC', noConformidad: actual })
      return actual
    },

    // Lo mismo que hace cambiar_estado_nc: estado, eficacia, verificación y cierre.
    async cambiarEstado(nc: NoConformidad, estado: EstadoNC, verificacion?: string): Promise<NoConformidad | null> {
      const resultado = await servicioEscritura.cambiarEstadoNC(nc.id, estado, verificacion)
      if (!resultado.ok) return fallo(resultado)

      const verificando = nc.estado === 'En corrección'
      const eficacia = verificando ? (estado === 'Verificada' ? 'Eficaz' : 'No eficaz') : nc.eficacia
      const accion = verificando
        ? `Verificación de eficacia: ${eficacia}`
        : estado === 'Cerrada' ? 'No conformidad cerrada' : 'Cambio de estado'
      const actual: NoConformidad = {
        ...nc,
        estado,
        eficacia,
        verificacionEficacia: verificacion?.trim() || nc.verificacionEficacia,
        fechaCierre: estado === 'Cerrada' ? formatearFecha(hoyLocal()) : undefined,
        historial: [...(nc.historial ?? []), evento(accion, verificacion?.trim() || `${nc.estado} → ${estado}`)],
      }
      dispatch({ type: 'UPSERT_NC', noConformidad: actual })
      return actual
    },
  }
}
