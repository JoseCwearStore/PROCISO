import { useApp } from '../context/AppContext'
import { MENSAJES_ERROR_ESCRITURA } from '../lib/escrituras'
import { servicioEscritura } from '../lib/servicios'
import type { IndicadorGestion, Rol, Usuario } from '../types'

const ADMINS: Rol[] = ['Admin PROCISO', 'Admin Consultoría']

// Única puerta de escritura de indicadores. Espejo de las políticas de la BD (solo UX):
//   · internos ("PROCISO"): solo el admin;
//   · SGC: el admin o el consultor que trabaja con esa empresa;
//   · el cliente ve el SGC de su empresa en lectura.
export function useAccionesIndicador() {
  const { state, dispatch, showToast } = useApp()
  const esAdmin = ADMINS.includes(state.currentRole)
  const esConsultor = state.currentRole === 'Consultor'
  // El RLS ya dejó en el estado solo los proyectos de este usuario: sus empresas salen de ahí.
  const empresasDondeTrabajo = new Set(state.proyectos.map((p) => p.empresaId))

  const puedeGestionar = (ambito: IndicadorGestion['ambito'], empresaId?: string) =>
    esAdmin || (esConsultor && ambito === 'SGC' && (!empresaId || empresasDondeTrabajo.has(empresaId)))

  return {
    esCliente: state.currentRole === 'Usuario Cliente',
    puedeGestionar,
    // Empresas para las que este usuario puede crear indicadores del SGC.
    empresasGestionables: state.empresas.filter((e) => esAdmin || (esConsultor && empresasDondeTrabajo.has(e.id))),

    // Mismo criterio que validar_indicador: equipo de la consultoría o cliente de ESA empresa.
    responsables: (ambito: IndicadorGestion['ambito'], empresaId?: string): Usuario[] =>
      state.usuarios.filter(
        (u) =>
          u.activo &&
          ((u.rol === 'Admin Consultoría' || u.rol === 'Consultor') ||
            (ambito === 'SGC' && u.rol === 'Usuario Cliente' && !!empresaId && u.empresaId === empresaId)),
      ),

    async guardar(indicador: IndicadorGestion): Promise<IndicadorGestion | null> {
      const nuevo = !state.indicadores.some((i) => i.id === indicador.id)
      const resultado = await servicioEscritura.guardarIndicador(state.currentUser?.consultoriaId ?? null, indicador, nuevo)
      if (!resultado.ok) {
        showToast(MENSAJES_ERROR_ESCRITURA[resultado.error], 'error')
        return null
      }
      dispatch({ type: 'UPSERT_INDICADOR', indicador: resultado.valor })
      return resultado.valor
    },
  }
}
