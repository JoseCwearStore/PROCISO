import { describe, expect, it } from 'vitest'
import { destinoDeEntidad, destinoDeTarjeta, type TarjetaInicio } from './destinosInicio'

describe('destinoDeTarjeta (a dónde lleva cada tarjeta del Inicio)', () => {
  it('"Pendientes de información" lleva a Evidencias, no a Levantamiento (E1)', () => {
    expect(destinoDeTarjeta('pendientes-informacion')).toBe('evidencias')
  })

  it('"Evidencias por validar" lleva a Evidencias, no a Levantamiento (E1)', () => {
    expect(destinoDeTarjeta('evidencias-por-validar')).toBe('evidencias')
  })

  it('fija el destino del resto de las tarjetas', () => {
    const esperado: Record<TarjetaInicio, string> = {
      empresas: 'empresas',
      proyectos: 'proyectos',
      'pendientes-informacion': 'evidencias',
      'proximos-vencer': 'tablero-tareas',
      documentos: 'documentacion',
      'actividades-vencidas': 'tablero-tareas',
      'evidencias-por-validar': 'evidencias',
    }
    for (const [tarjeta, pagina] of Object.entries(esperado)) {
      expect(destinoDeTarjeta(tarjeta as TarjetaInicio), tarjeta).toBe(pagina)
    }
  })
})

describe('destinoDeEntidad (clic en un evento del historial del Inicio)', () => {
  it('un evento de una evidencia abre Evidencias (mismo error que E1)', () => {
    expect(destinoDeEntidad('evidencia')).toBe('evidencias')
  })

  it('fija el destino de los demás tipos y cae en Inicio con uno desconocido', () => {
    expect(destinoDeEntidad('proyecto')).toBe('proyecto-detalle')
    expect(destinoDeEntidad('empresa')).toBe('empresa-detalle')
    expect(destinoDeEntidad('tarea')).toBe('tareas')
    expect(destinoDeEntidad('documento')).toBe('documentacion')
    expect(destinoDeEntidad('algo-raro')).toBe('inicio')
  })
})
