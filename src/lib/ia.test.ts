import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { avisoTranscripcion, criteriosSugeridos, clausulasSugeridas, fuenteAnalizada, NOTA_CONTENIDO_NO_CONFIABLE } from './ia'
import type { CriterioEvaluacion } from '../types'

// AUD04-M1 (c), L5f: lo que sube la empresa evaluada entra al prompt de la IA y esa empresa tiene interés en que
// salga "Cubierto". La defensa técnica (nonce, datos no confiables) ya está en las Edge Functions (L4); esto le
// dice a quien lee el resultado de dónde sale lo que se analizó, para que no lo tome como un dictamen.
describe('nota sobre el contenido analizado (AUD04-M1 c)', () => {
  it('advierte que el contenido puede venir de la empresa evaluada y que busque influir en el resultado', () => {
    expect(NOTA_CONTENIDO_NO_CONFIABLE).toMatch(/empresa evaluada/i)
    expect(NOTA_CONTENIDO_NO_CONFIABLE).toMatch(/influir/i)
  })

  it('aclara que no es un dictamen y que hay que revisarla', () => {
    expect(NOTA_CONTENIDO_NO_CONFIABLE).toMatch(/no es un dictamen/i)
    expect(NOTA_CONTENIDO_NO_CONFIABLE).toMatch(/rev[ií]s/i)
  })

  it('dice qué se analizó según la fuente', () => {
    expect(fuenteAnalizada('documento')).toMatch(/documento/i)
    expect(fuenteAnalizada('evidencia')).toMatch(/evidencia/i)
    expect(fuenteAnalizada('evidencia')).not.toBe(fuenteAnalizada('documento'))
  })

  it('una evidencia se describe como un archivo cargado a la plataforma (puede venir de la empresa)', () => {
    expect(fuenteAnalizada('evidencia')).toMatch(/cargad/i)
  })

  it('el panel de preevaluación muestra la nota y la fuente de cada análisis (no queda sin cablear)', () => {
    const panel = readFileSync(resolve(__dirname, '..', 'components', 'PanelAnalisisIA.tsx'), 'utf8')
    // Se exige el USO dentro del JSX (el nombre solo en el import no alcanza).
    expect(panel).toMatch(/\{NOTA_CONTENIDO_NO_CONFIABLE\}/)
    expect(panel).toMatch(/\{fuenteAnalizada\(/)
  })
})

// Audio y video: para analizarlos se transcribe su audio con un servicio EXTERNO (el archivo sale de la
// plataforma) y la transcripción puede tener errores. Se avisa en el punto donde se pide el análisis.
describe('aviso de transcripción de audio y video', () => {
  it('un audio avisa que sale a un servicio externo y que la transcripción puede tener errores', () => {
    expect(avisoTranscripcion('Audio')).toMatch(/servicio externo/i)
    expect(avisoTranscripcion('Audio')).toMatch(/sale de la plataforma/i)
    expect(avisoTranscripcion('Audio')).toMatch(/errores/i)
  })

  it('un video aclara que solo se transcribe el audio y que no se analiza la imagen', () => {
    expect(avisoTranscripcion('Video')).toMatch(/servicio externo/i)
    expect(avisoTranscripcion('Video')).toMatch(/audio/i)
    expect(avisoTranscripcion('Video')).toMatch(/no se analiza la imagen/i)
  })

  it('explica el flujo nuevo: primero se transcribe, y el texto se corrige ANTES de analizar', () => {
    for (const tipo of ['Audio', 'Video']) {
      expect(avisoTranscripcion(tipo), tipo).toMatch(/primero se transcribe/i)
      expect(avisoTranscripcion(tipo), tipo).toMatch(/corr[ií]gela antes de analizar/i)
    }
  })

  it('el aviso del audio y el del video son distintos', () => {
    expect(avisoTranscripcion('Audio')).not.toBe(avisoTranscripcion('Video'))
  })

  it('los demás tipos no llevan aviso (no sale nada a un servicio externo)', () => {
    for (const tipo of ['Foto', 'Documento', 'Formulario', '', null, undefined]) expect(avisoTranscripcion(tipo)).toBeNull()
  })

  it('el panel de IA muestra el aviso y Evidencias le pasa el tipo (no queda sin cablear)', () => {
    const panel = readFileSync(resolve(__dirname, '..', 'components', 'PanelAnalisisIA.tsx'), 'utf8')
    expect(panel).toMatch(/avisoTranscripcion\(/)
    expect(panel).toMatch(/\{aviso\}/)
    const evidencias = readFileSync(resolve(__dirname, '..', 'pages', 'Evidencias.tsx'), 'utf8')
    expect(evidencias).toMatch(/tipoEvidencia=\{vistaPrevia\.tipo\}/)
  })

  it('Evidencias ya no ofrece un botón deshabilitado que dice que falta un servicio adicional', () => {
    const evidencias = readFileSync(resolve(__dirname, '..', 'pages', 'Evidencias.tsx'), 'utf8')
    expect(evidencias).not.toMatch(/requiere servicio adicional/i)
    expect(evidencias).not.toMatch(/Integración opcional/i)
  })
})

const criterio = (clausula: string, orden: number): CriterioEvaluacion => ({
  id: `c-${clausula}`, clausula, titulo: clausula, intencion: '', evidenciaEsperada: [], preguntas: [],
  senalesDeHueco: [], puedeNoAplicar: false, orden,
})

describe('clausulasSugeridas', () => {
  it('sugiere las cláusulas que corresponden al tipo de documento', () => {
    expect(clausulasSugeridas('Política')).toEqual(['5.2.1', '5.2.2'])
    expect(clausulasSugeridas('Procedimiento')).toEqual(['7.5.2', '7.5.3', '8.1'])
    expect(clausulasSugeridas('Lista de verificación')).toEqual(['9.2.1', '9.2.2'])
  })

  it('para una evidencia no adivina: el consultor elige', () => {
    expect(clausulasSugeridas(null)).toEqual([])
  })
})

describe('criteriosSugeridos', () => {
  it('convierte las cláusulas sugeridas en ids del catálogo, en el orden del catálogo', () => {
    const catalogo = [criterio('5.2.2', 8), criterio('4.1', 1), criterio('5.2.1', 7)]

    expect(criteriosSugeridos('Política', catalogo)).toEqual(['c-5.2.1', 'c-5.2.2'])
  })

  it('ignora una cláusula sugerida que el catálogo no tenga (no rompe si el Excel cambia)', () => {
    expect(criteriosSugeridos('Política', [criterio('5.2.1', 7)])).toEqual(['c-5.2.1'])
  })
})
