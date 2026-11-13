import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  avisosDeEvidencia, avisoTranscripcion, AVISO_VIDEO_NATIVO, criteriosSugeridos, clausulasSugeridas,
  detalleFalloAnalisis, esAnalisisDeVideo,
  ETIQUETA_SUGERENCIA_IA, etiquetaSugerencia, fuenteAnalizada, limiteSubidaMb, NOTA_CONTENIDO_NO_CONFIABLE, partirMarcasDeTiempo,
  textoAvisoFallo,
} from './ia'
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
    expect(panel).toMatch(/avisosDeEvidencia\(/)
    expect(panel).toMatch(/\{a\.texto\}/)
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

// O13: en un video salían DOS cajas azules, y la segunda solo vale para "Analizar transcripción". Ahora es UNA caja
// con cada línea rotulada con el botón al que se refiere.
describe('avisosDeEvidencia (la caja azul del panel de IA, O13)', () => {
  it('un video: una línea para "Analizar video" y otra, rotulada, para "Analizar transcripción"', () => {
    const avisos = avisosDeEvidencia('Video')
    expect(avisos).toEqual([
      { etiqueta: 'Analizar video', texto: AVISO_VIDEO_NATIVO },
      { etiqueta: 'Analizar transcripción', texto: avisoTranscripcion('Video') },
    ])
  })

  it('un audio: una sola línea, sin rótulo (solo hay un botón)', () => {
    expect(avisosDeEvidencia('Audio')).toEqual([{ etiqueta: null, texto: avisoTranscripcion('Audio') }])
  })

  it('los demás tipos no llevan aviso', () => {
    for (const tipo of ['Foto', 'Documento', 'Formulario', '', null, undefined]) expect(avisosDeEvidencia(tipo), String(tipo)).toEqual([])
  })
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

// ─── Análisis de video nativo ──────────────────────────────────────────────

describe('partirMarcasDeTiempo', () => {
  it('separa las marcas MM:SS para resaltarlas y conserva el texto', () => {
    expect(partirMarcasDeTiempo('En 00:05 se ve el montaje y de 1:12 a 1:30 la prueba.')).toEqual([
      { texto: 'En ', marca: false },
      { texto: '00:05', marca: true },
      { texto: ' se ve el montaje y de ', marca: false },
      { texto: '1:12', marca: true },
      { texto: ' a ', marca: false },
      { texto: '1:30', marca: true },
      { texto: ' la prueba.', marca: false },
    ])
  })

  it('una marca al principio no deja un tramo vacío antes', () => {
    expect(partirMarcasDeTiempo('00:05 inicio')).toEqual([{ texto: '00:05', marca: true }, { texto: ' inicio', marca: false }])
  })

  it('un texto sin marcas es un solo tramo', () => {
    expect(partirMarcasDeTiempo('No se ve el equipo.')).toEqual([{ texto: 'No se ve el equipo.', marca: false }])
  })

  it('una marca sola, y el texto vacío, no dejan tramos vacíos', () => {
    expect(partirMarcasDeTiempo('[01:12]')).toEqual([{ texto: '[', marca: false }, { texto: '01:12', marca: true }, { texto: ']', marca: false }])
    expect(partirMarcasDeTiempo('')).toEqual([])
  })

  it('no toma una proporción ni una escala como marca', () => {
    expect(partirMarcasDeTiempo('escala 1:100 y 3:75 y 100:50')).toEqual([{ texto: 'escala 1:100 y 3:75 y 100:50', marca: false }])
  })

  // Misma regla que la guarda del servidor (AUD09-M1): minutos de 0 a 59 y no una hora H:MM:SS.
  it('no resalta minutos fuera de rango ni una hora H:MM:SS, igual que la guarda del servidor', () => {
    expect(partirMarcasDeTiempo('falla en 99:59')).toEqual([{ texto: 'falla en 99:59', marca: false }])
    expect(partirMarcasDeTiempo('a la 1:05:00')).toEqual([{ texto: 'a la 1:05:00', marca: false }])
    expect(partirMarcasDeTiempo('en 59:59').filter((x) => x.marca).map((x) => x.texto)).toEqual(['59:59'])
  })

  it('la unión de los tramos da el texto original', () => {
    const t = 'a 10:00, luego 02:30-02:45 y 9:59.'
    expect(partirMarcasDeTiempo(t).map((x) => x.texto).join('')).toBe(t)
  })
})

describe('análisis de video: avisos y etiquetas', () => {
  it('avisa que el video sale de la plataforma a un proveedor externo, que se ve la imagen y que lo revisa una persona', () => {
    expect(AVISO_VIDEO_NATIVO).toMatch(/proveedor externo/i)
    expect(AVISO_VIDEO_NATIVO).toMatch(/sale de la plataforma/i)
    expect(AVISO_VIDEO_NATIVO).toMatch(/imagen/i)
    expect(AVISO_VIDEO_NATIVO).toMatch(/revis/i)
  })

  it('avisa que el video puede durar como máximo 5 minutos (decisión del usuario, 12/11)', () => {
    expect(AVISO_VIDEO_NATIVO).toMatch(/máximo 5 minutos/i)
  })

  it('la etiqueta de sugerencia dice que es de la IA y que se verifica con el video', () => {
    expect(ETIQUETA_SUGERENCIA_IA).toMatch(/IA/)
    expect(ETIQUETA_SUGERENCIA_IA).toMatch(/verificar con el video/i)
  })

  it('reconoce un análisis hecho por el modelo de video por su proveedor', () => {
    expect(esAnalisisDeVideo({ proveedor: 'gemini' })).toBe(true)
    expect(esAnalisisDeVideo({ proveedor: 'openai-compatible' })).toBe(false)
    expect(esAnalisisDeVideo({})).toBe(false)
  })

  describe('etiquetaSugerencia', () => {
    it('un análisis del modelo de video se verifica con el video', () => {
      expect(etiquetaSugerencia('Video', { proveedor: 'gemini' })).toBe(ETIQUETA_SUGERENCIA_IA)
    })
    it('un análisis de audio, o de la transcripción de un video, se verifica con el audio', () => {
      expect(etiquetaSugerencia('Audio', { proveedor: 'openai-compatible' })).toBe('Sugerencia de la IA: verificar con el audio')
      expect(etiquetaSugerencia('Video', { proveedor: 'openai-compatible' })).toBe('Sugerencia de la IA: verificar con el audio')
    })
    it('otras fuentes mantienen "Sugerencia"', () => {
      expect(etiquetaSugerencia('Documento', {})).toBe('Sugerencia')
      expect(etiquetaSugerencia(null, {})).toBe('Sugerencia')
    })
  })

  it('el límite de subida es 200 MB para un video y 25 MB para lo demás', () => {
    expect(limiteSubidaMb('Video')).toBe(200)
    expect(limiteSubidaMb('Foto')).toBe(25)
    expect(limiteSubidaMb('Audio')).toBe(25)
    expect(limiteSubidaMb('Documento')).toBe(25)
  })
})

// El aviso de un análisis que falló: visible junto a los botones y con el motivo real (decisión del 12/11).
describe('detalleFalloAnalisis (qué se le dice a quien pidió un análisis que falló)', () => {
  it('lleva el motivo real y un título fijo', () => {
    const d = detalleFalloAnalisis({ errorDetalle: 'El modelo está saturado.', sinConsumo: true })
    expect(d.titulo).toBe('El análisis no se pudo completar')
    expect(d.motivo).toBe('El modelo está saturado.')
  })

  it('si no se registró el motivo, lo dice en vez de mostrar un hueco', () => {
    expect(detalleFalloAnalisis({}).motivo).toMatch(/no se registró/i)
    expect(detalleFalloAnalisis({ errorDetalle: '   ' }).motivo).toMatch(/no se registró/i)
  })

  it('sin gasto: avisa que NO se descontó del cupo diario', () => {
    const d = detalleFalloAnalisis({ errorDetalle: 'x', sinConsumo: true })
    expect(d.cupo).toMatch(/no se descontó de tu cupo diario/i)
  })

  it('con gasto: avisa que SÍ cuenta', () => {
    const d = detalleFalloAnalisis({ errorDetalle: 'x', sinConsumo: false })
    expect(d.cupo).toMatch(/sí cuenta/i)
    expect(d.cupo).not.toMatch(/no se descontó/i)
  })

  it('si no se sabe (dato ausente), no afirma nada sobre el cupo', () => {
    expect(detalleFalloAnalisis({ errorDetalle: 'x' }).cupo).toBeNull()
  })

  it('el texto del aviso pasajero lleva el título y el motivo', () => {
    expect(textoAvisoFallo({ errorDetalle: 'El modelo está saturado.', sinConsumo: true }))
      .toBe('El análisis no se pudo completar: El modelo está saturado.')
  })
})

describe('cableado del aviso de fallo (no queda sin conectar)', () => {
  const panel = readFileSync(resolve(__dirname, '../components/PanelAnalisisIA.tsx'), 'utf8')
  const hook = readFileSync(resolve(__dirname, '../hooks/useAccionesIA.ts'), 'utf8')

  it('el panel muestra el fallo como alerta visible, con el cupo, junto a los botones', () => {
    expect(panel).toMatch(/detalleFalloAnalisis\(/)
    expect(panel).toMatch(/role="alert"/)
  })

  it('el aviso pasajero lleva el motivo real y no un texto genérico', () => {
    expect(hook).toMatch(/textoAvisoFallo\(/)
    expect(hook).not.toMatch(/El motivo quedó registrado/)
  })
})

describe('cableado del análisis de video (no queda sin conectar)', () => {
  const leer = (...partes: string[]) => readFileSync(resolve(__dirname, '..', ...partes), 'utf8')

  it('el panel ofrece "Analizar video", muestra el aviso, resalta las marcas y etiqueta la sugerencia', () => {
    const panel = leer('components', 'PanelAnalisisIA.tsx')
    expect(panel).toContain('Analizar video')
    // O13: los avisos salen en UNA caja desde avisosDeEvidencia; el aviso de video no se pinta suelto.
    expect(panel).toMatch(/avisosDeEvidencia\(/)
    expect(panel).not.toMatch(/\{AVISO_VIDEO_NATIVO\}/)
    expect(panel).toMatch(/\{etiquetaSugerencia\(tipoEvidencia, analisis\)\}/)
    expect(panel).toMatch(/partirMarcasDeTiempo\(/)
    // Tope de 5 minutos (12/11): el panel manda la duración del video con el pedido.
    expect(panel).toMatch(/ia\.analizar\(fuente, seleccion, 'video', duracionSegundos\)/)
    // El aviso de "transcribe primero" aplica solo al botón de transcripción: en video se aclara.
    expect(panel).toContain('Solo para «Analizar transcripción»')
  })

  it('el hook manda el modo "video" con la duración a la función y no manda nada en el análisis de texto', () => {
    const hook = leer('hooks', 'useAccionesIA.ts')
    expect(hook).toMatch(/modo === 'video' \? \{ modo, duracionSegundos \} : \{\}/)
  })

  it('la pantalla de evidencias usa el límite por tipo', () => {
    expect(leer('pages', 'Evidencias.tsx')).toMatch(/limiteSubidaMb\(tipoArchivo\(archivo\)\)/)
  })

  it('el pedido de video lleva la duración también en la función: se valida antes de registrar el pedido', () => {
    const analisis = leer('..', 'supabase', 'functions', '_compartido', 'analisis.ts')
    expect(analisis).toMatch(/motivoDuracionInvalida\(e\.duracionSegundos\)/)
  })
})

// Reemplaza a la "duración recomendada" de 10 minutos (commit 9b4eec2, 13/11): la decisión del usuario del 12/11 es un tope de
// 5 minutos por video, no una recomendación. Medido con un video de 10:31: 57, 84 y 120 s en tres corridas y una falla a los
// 140 s, así que a 5 minutos hay margen. La lógica (formato, tope, bloqueo) está en duracionVideo.ts, con sus propios tests.
describe('tope de 5 minutos por video: cableado de la pantalla', () => {
  const leer = (...p: string[]) => readFileSync(resolve(__dirname, '..', ...p), 'utf8')

  it('el panel bloquea "Analizar video" si el video pasa de 5 minutos y explica el motivo', () => {
    const panel = leer('components', 'PanelAnalisisIA.tsx')
    expect(panel).toMatch(/estadoDuracionVideo\(duracionSegundos\)/)
    expect(panel).toMatch(/!duracion\.permitido/)
    expect(panel).toContain('Solo para «Analizar video»')
    // Nunca se pide el análisis sin una duración válida (el servidor igual la exige).
    expect(panel).toMatch(/if \(!duracion\.permitido \|\| typeof duracionSegundos !== 'number'\) return/)
  })

  it('la recomendación vieja de 10 minutos ya no está en el panel', () => {
    const panel = leer('components', 'PanelAnalisisIA.tsx')
    expect(panel).not.toMatch(/AVISO_DURACION_VIDEO|alertaDuracionVideo|DURACION_RECOMENDADA/)
  })

  it('la pantalla de evidencias mide el reproductor, se lo pasa al panel y frena la subida de más de 5 minutos', () => {
    const pantalla = leer('pages', 'Evidencias.tsx')
    expect(pantalla).toMatch(/ref=\{medirReproductor\}/)
    expect(pantalla).toMatch(/duracionSegundos=\{duracionVideo\}/)
    expect(pantalla).toMatch(/motivoSubidaVideo\(await medirDuracionDeArchivo\(file\)\)/)
  })
})
