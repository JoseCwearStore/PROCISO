import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { mensajeDeError } from './escrituras'
import {
  adaptarTranscripcion,
  crearServicioTranscripciones,
  estadoTranscripcion,
  etiquetaTranscripcion,
  MAX_TRANSCRIPCION,
  mensajeDeEstado,
  puedeAnalizarConTranscripcion,
  type ClienteTranscripciones,
  type Transcripcion,
} from './transcripciones'

const EV = '34343434-0000-0000-0004-000000000001'

const FILA = {
  id: 't-1', consultoria_id: 'c-1', proyecto_id: 'p-1', evidencia_id: EV,
  texto_automatico: 'Las quejas se resuelven en 5 días.', texto: 'Las quejas se resuelven en cinco días hábiles.',
  proveedor: 'api.groq.com', modelo: 'whisper-large-v3-turbo', creada_por: 'u-1',
  creada_en: '2026-11-11T22:00:00Z', corregida_por: 'u-2', corregida_en: '2026-11-11T22:30:00Z',
}

const TRANSCRIPCION: Transcripcion = {
  evidenciaId: EV, texto: 'Las quejas se resuelven en cinco días hábiles.', textoAutomatico: 'Las quejas se resuelven en 5 días.',
  proveedor: 'api.groq.com', modelo: 'whisper-large-v3-turbo', creadaEn: '2026-11-11T22:00:00Z',
  corregidaPorId: 'u-2', corregidaEn: '2026-11-11T22:30:00Z',
}

describe('adaptarTranscripcion', () => {
  it('traduce una fila de la BD', () => {
    expect(adaptarTranscripcion(FILA)).toEqual(TRANSCRIPCION)
  })

  it('una transcripción sin corregir deja los campos de corrección sin definir', () => {
    const t = adaptarTranscripcion({ ...FILA, corregida_por: null, corregida_en: null })
    expect(t?.corregidaEn).toBeUndefined()
    expect(t?.corregidaPorId).toBeUndefined()
  })

  it('una fila que no tiene la forma esperada es null (no un objeto a medias)', () => {
    for (const mala of [null, undefined, 'x', 42, [], {}, { ...FILA, evidencia_id: null }, { ...FILA, texto: '' },
      { ...FILA, texto: 123 }, { ...FILA, texto_automatico: undefined }, { ...FILA, creada_en: null }]) {
      expect(adaptarTranscripcion(mala), JSON.stringify(mala)).toBeNull()
    }
  })
})

describe('estadoTranscripcion: cuándo se puede analizar un audio o video', () => {
  it('lo que no es audio ni video no depende de la transcripción', () => {
    for (const tipo of ['Foto', 'Documento', 'Formulario', '', null, undefined]) {
      expect(estadoTranscripcion(tipo, null, ''), String(tipo)).toBe('no_aplica')
    }
  })

  it('un audio o video sin transcripción guardada: falta', () => {
    expect(estadoTranscripcion('Audio', null, '')).toBe('falta')
    expect(estadoTranscripcion('Video', null, 'texto escrito a mano')).toBe('falta')
  })

  it('con la transcripción guardada y el cuadro igual a lo guardado: lista', () => {
    expect(estadoTranscripcion('Audio', TRANSCRIPCION, TRANSCRIPCION.texto)).toBe('lista')
    expect(estadoTranscripcion('Video', TRANSCRIPCION, `  ${TRANSCRIPCION.texto}  \n`)).toBe('lista')
  })

  it('si el cuadro tiene cambios sin guardar: sin_guardar (no se analiza un texto que la BD no tiene)', () => {
    expect(estadoTranscripcion('Audio', TRANSCRIPCION, `${TRANSCRIPCION.texto} y algo más`)).toBe('sin_guardar')
    expect(estadoTranscripcion('Audio', TRANSCRIPCION, '')).toBe('sin_guardar')
  })

  it('solo se analiza en no_aplica y lista', () => {
    expect(puedeAnalizarConTranscripcion('no_aplica')).toBe(true)
    expect(puedeAnalizarConTranscripcion('lista')).toBe(true)
    expect(puedeAnalizarConTranscripcion('falta')).toBe(false)
    expect(puedeAnalizarConTranscripcion('sin_guardar')).toBe(false)
  })

  it('cada estado que bloquea dice qué hacer; los que dejan analizar no dicen nada', () => {
    expect(mensajeDeEstado('falta')).toMatch(/transcrib/i)
    expect(mensajeDeEstado('sin_guardar')).toMatch(/guarda/i)
    expect(mensajeDeEstado('lista')).toBeNull()
    expect(mensajeDeEstado('no_aplica')).toBeNull()
  })
})

describe('etiquetaTranscripcion', () => {
  it('sin corregir: dice que es automática y que nadie la revisó', () => {
    expect(etiquetaTranscripcion({ ...TRANSCRIPCION, corregidaEn: undefined, corregidaPorId: undefined })).toMatch(/autom[aá]tica.*sin corregir/i)
  })

  it('corregida: dice que una persona la corrigió', () => {
    expect(etiquetaTranscripcion(TRANSCRIPCION)).toMatch(/corregida/i)
    expect(etiquetaTranscripcion(TRANSCRIPCION)).not.toMatch(/sin corregir/i)
  })
})

// ─── Servicio ───────────────────────────────────────────────────────────────

type Respuesta<T> = PromiseLike<T>
function crearCliente(parcial: {
  fila?: unknown
  errorLectura?: { code?: string; message: string } | null
  errorRpc?: { code?: string; message: string } | null
  funcion?: { data: unknown; error: { message: string; status?: number } | null }
  lanza?: boolean
}) {
  const eq = vi.fn((_columna: string, _valor: string) => ({
    maybeSingle: (): Respuesta<{ data: unknown; error: { code?: string; message: string } | null }> => {
      if (parcial.lanza) throw new Error('red caída')
      return Promise.resolve({ data: parcial.fila ?? null, error: parcial.errorLectura ?? null })
    },
  }))
  const select = vi.fn((_columnas: string) => ({ eq }))
  const from = vi.fn((_tabla: 'transcripciones') => ({ select }))
  const rpc = vi.fn(async (_f: 'corregir_transcripcion', _args: { p_evidencia_id: string; p_texto: string }) => {
    if (parcial.lanza) throw new Error('red caída')
    return { error: parcial.errorRpc ?? null }
  })
  const invoke = vi.fn(async (_n: 'transcribir-evidencia', _o: { body: { evidenciaId: string } }) => {
    if (parcial.lanza) throw new Error('red caída')
    return parcial.funcion ?? { data: { estado: 'Completado', evidenciaId: EV }, error: null }
  })
  const cliente: ClienteTranscripciones = { from, rpc, functions: { invoke } }
  return { cliente, from, select, eq, rpc, invoke }
}

describe('servicio de transcripciones: leer', () => {
  it('lee la fila de ESA evidencia', async () => {
    const { cliente, from, select, eq } = crearCliente({ fila: FILA })
    const r = await crearServicioTranscripciones(cliente).leer(EV)
    expect(r).toEqual({ ok: true, valor: TRANSCRIPCION })
    expect(from).toHaveBeenCalledWith('transcripciones')
    expect(select.mock.calls[0][0]).toMatch(/evidencia_id.*texto_automatico.*texto.*corregida_en/)
    expect(eq).toHaveBeenCalledWith('evidencia_id', EV)
  })

  it('"no hay transcripción" es ok con valor null', async () => {
    expect(await crearServicioTranscripciones(crearCliente({ fila: null }).cliente).leer(EV)).toEqual({ ok: true, valor: null })
  })

  it('"no se pudo leer" NO es "no hay": es un error (si no, la pantalla ofrecería transcribir y pisar el texto corregido)', async () => {
    const conError = await crearServicioTranscripciones(crearCliente({ errorLectura: { code: '500', message: 'x' } }).cliente).leer(EV)
    expect(conError.ok).toBe(false)
    const cayo = await crearServicioTranscripciones(crearCliente({ lanza: true }).cliente).leer(EV)
    expect(cayo.ok).toBe(false)
  })

  it('una fila que existe pero no se puede interpretar también es un error, no "no hay"', async () => {
    const r = await crearServicioTranscripciones(crearCliente({ fila: { evidencia_id: EV } }).cliente).leer(EV)
    expect(r.ok).toBe(false)
  })
})

describe('servicio de transcripciones: transcribir', () => {
  it('llama a la función con el id de la evidencia y nada más', async () => {
    const { cliente, invoke } = crearCliente({})
    const r = await crearServicioTranscripciones(cliente).transcribir(EV)
    expect(r).toEqual({ ok: true, valor: { estado: 'Completado' } })
    expect(invoke).toHaveBeenCalledWith('transcribir-evidencia', { body: { evidenciaId: EV } })
  })

  it('una falla del servicio de transcripción vuelve como resultado para mostrar, con su motivo', async () => {
    const { cliente } = crearCliente({ funcion: { data: { estado: 'Error', error: 'No se detectó voz en el archivo.' }, error: null } })
    expect(await crearServicioTranscripciones(cliente).transcribir(EV)).toEqual({ ok: true, valor: { estado: 'Error', error: 'No se detectó voz en el archivo.' } })
  })

  it('una respuesta sin forma esperada es un resultado "Error" con un mensaje genérico, no un TypeError', async () => {
    for (const data of [null, {}, { estado: 'Otro' }, 'texto']) {
      const r = await crearServicioTranscripciones(crearCliente({ funcion: { data, error: null } }).cliente).transcribir(EV)
      expect(r.ok, JSON.stringify(data)).toBe(true)
      expect(r.ok && r.valor.estado).toBe('Error')
    }
  })

  it('traduce el status HTTP de la función: 429 es el tope de transcripciones, no el de la IA', async () => {
    const con = (status?: number) => crearServicioTranscripciones(crearCliente({ funcion: { data: null, error: { message: 'x', status } } }).cliente).transcribir(EV)
    expect(await con(429)).toMatchObject({ ok: false, error: 'limite_transcripciones' })
    expect(await con(403)).toMatchObject({ ok: false, error: 'sin_permiso' })
    expect(await con(400)).toMatchObject({ ok: false, error: 'datos_invalidos' })
    expect(await con(500)).toMatchObject({ ok: false, error: 'servicio' })
    expect(await con(undefined)).toMatchObject({ ok: false, error: 'servicio' })
  })

  it('un id vacío no llama a la función', async () => {
    const { cliente, invoke } = crearCliente({})
    expect(await crearServicioTranscripciones(cliente).transcribir('')).toMatchObject({ ok: false, error: 'datos_invalidos' })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('si se cae la red es un error de servicio, no una excepción', async () => {
    expect(await crearServicioTranscripciones(crearCliente({ lanza: true }).cliente).transcribir(EV)).toMatchObject({ ok: false, error: 'servicio' })
  })

  it('el mensaje del tope de transcripciones habla de transcripciones', () => {
    expect(mensajeDeError({ error: 'limite_transcripciones' })).toMatch(/transcripciones/i)
  })
})

describe('servicio de transcripciones: corregir', () => {
  it('manda el texto a la función de la BD', async () => {
    const { cliente, rpc } = crearCliente({})
    const r = await crearServicioTranscripciones(cliente).corregir(EV, 'Texto corregido.')
    expect(r).toEqual({ ok: true, valor: undefined })
    expect(rpc).toHaveBeenCalledWith('corregir_transcripcion', { p_evidencia_id: EV, p_texto: 'Texto corregido.' })
  })

  it('manda el texto sin espacios ni saltos de línea de los bordes', async () => {
    const { cliente, rpc } = crearCliente({})
    await crearServicioTranscripciones(cliente).corregir(EV, '  \n Texto corregido.  \n')
    expect(rpc).toHaveBeenCalledWith('corregir_transcripcion', { p_evidencia_id: EV, p_texto: 'Texto corregido.' })
  })

  it('rechaza antes de ir a la BD un texto vacío o demasiado largo', async () => {
    const { cliente, rpc } = crearCliente({})
    const servicio = crearServicioTranscripciones(cliente)
    expect(await servicio.corregir(EV, '   ')).toMatchObject({ ok: false, error: 'datos_invalidos' })
    expect(await servicio.corregir(EV, 'a'.repeat(MAX_TRANSCRIPCION + 1))).toMatchObject({ ok: false, error: 'datos_invalidos' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('acepta justo el máximo', async () => {
    const { cliente, rpc } = crearCliente({})
    expect((await crearServicioTranscripciones(cliente).corregir(EV, 'a'.repeat(MAX_TRANSCRIPCION))).ok).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('traduce los errores de la BD: 42501 sin permiso, 22023 regla de negocio con su mensaje, el resto servicio', async () => {
    const con = (code: string, message = 'x') => crearServicioTranscripciones(crearCliente({ errorRpc: { code, message } }).cliente).corregir(EV, 'texto')
    expect(await con('42501')).toMatchObject({ ok: false, error: 'sin_permiso' })
    expect(await con('22023', 'Esa evidencia todavía no tiene transcripción')).toMatchObject({
      ok: false, error: 'datos_invalidos', detalle: 'Esa evidencia todavía no tiene transcripción',
    })
    expect(await con('XX000')).toMatchObject({ ok: false, error: 'servicio' })
  })

  it('si se cae la red es un error de servicio, no una excepción', async () => {
    expect(await crearServicioTranscripciones(crearCliente({ lanza: true }).cliente).corregir(EV, 'texto')).toMatchObject({ ok: false, error: 'servicio' })
  })
})

// ─── Cableado: que cada pieza esté USADA (no solo importada) ────────────────
// El proyecto no tiene tests de componentes: se exige por el código fuente que la pantalla use lo que decide
// cuándo se puede analizar. Sin esto, un panel que ofrece "Analizar" sobre un audio sin transcribir pasaría todo.
describe('cableado de la transcripción en la pantalla', () => {
  const fuente = (...ruta: string[]) => readFileSync(resolve(__dirname, '..', ...ruta), 'utf8')

  it('servicios.ts arma el servicio con el cliente real, y el adaptador conserva el status HTTP de la función', () => {
    const servicios = fuente('lib', 'servicios.ts')
    expect(servicios).toMatch(/export const servicioTranscripciones\s*=\s*crearServicioTranscripciones\(adaptarClienteTranscripciones\(supabase\)\)/)
    const adaptador = servicios.slice(servicios.indexOf('function adaptarClienteTranscripciones'))
    expect(adaptador).toMatch(/context\?\.status/)
    expect(adaptador).toMatch(/functions\.invoke/)
  })

  it('el hook usa los tres métodos del servicio y muestra el error de cada uno', () => {
    const hook = fuente('hooks', 'useTranscripcion.ts')
    expect(hook).toMatch(/export function useTranscripcion\(/)
    for (const metodo of ['leer', 'transcribir', 'corregir']) expect(hook, metodo).toContain(`servicioTranscripciones.${metodo}(`)
    expect(hook).toMatch(/mensajeDeError\(/)
  })

  it('el componente muestra la transcripción editable, conserva lo que escuchó la IA y el cliente solo la lee', () => {
    const c = fuente('components', 'TranscripcionEvidencia.tsx')
    expect(c).toMatch(/Guardar corrección/)
    expect(c).toMatch(/Transcribir/)
    expect(c).toMatch(/maxLength=\{MAX_TRANSCRIPCION\}/)
    expect(c).toMatch(/\{etiquetaTranscripcion\(/)
    expect(c).toMatch(/Lo que escuchó la IA/)
    expect(c).toMatch(/\{transcripcion\.textoAutomatico\}/)
    expect(c).toMatch(/readOnly=\{!puedeEditar\}/)
    // Volver a transcribir pisa las correcciones y los cambios sin guardar: pide confirmación en esos casos,
    // y al confirmar transcribe.
    expect(c).toMatch(/<ConfirmDialog/)
    expect(c).toMatch(/transcripcion\.corregidaEn \|\| hayCambios \? setConfirmando\(true\) : void tr\.transcribir\(\)/)
    expect(c).toMatch(/onConfirm=\{\(\) => \{\s*setConfirmando\(false\)\s*void tr\.transcribir\(\)/)
    // Si no se pudo LEER, no se ofrece transcribir (pisaría un texto ya corregido).
    expect(c).toMatch(/errorLectura/)
  })

  it('el panel de IA usa el estado de la transcripción para bloquear "Analizar" y explica por qué', () => {
    const panel = fuente('components', 'PanelAnalisisIA.tsx')
    expect(panel).toMatch(/useTranscripcion\(/)
    expect(panel).toMatch(/estadoTranscripcion\(/)
    expect(panel).toMatch(/puedeAnalizarConTranscripcion\(/)
    expect(panel).toMatch(/mensajeDeEstado\(/)
    // Se muestra cuando la evidencia es audio o video (no escondido detrás de una condición que nunca se cumple).
    expect(panel).toMatch(/\{tipoMedia && \(\s*<TranscripcionEvidencia/)
    expect(panel).toMatch(/disabled=\{[^}]*!puedeAnalizar[^}]*\}/)
    // Y le dice a quien mira POR QUÉ está bloqueado (un botón gris sin explicación no se entiende).
    expect(panel).toMatch(/\{motivoBloqueo\}/)
  })
})
