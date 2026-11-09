import type { Documento, Proceso, SeccionDocumento, TipoProceso } from '../types'

// Plantillas documentales del usuario (Seis_plantillas_documentales_PROCISO.docx y
// el expediente de ejemplo). Son SOLO la estructura y el relleno desde el
// Levantamiento: no hay IA ni acceso a la BD acá. La 6ª plantilla del usuario
// (procedimientos e instrucciones) se parte en dos: procedimiento e instrucción.
//
// Convención de las tablas: la PRIMERA fila de `filas` es el encabezado (así ya
// la pintan el editor y Revisiones, que no tienen un concepto de columnas).

export const PENDIENTE = 'Información pendiente de confirmar'

export interface PreguntaGuiada {
  id: string
  texto: string
}

export interface ContextoPlantilla {
  codigo: string
  edicionNorma: string
  organizacion?: string
  proceso?: Proceso
  procesos?: Proceso[]
  nombreUsuario?: (id?: string) => string
  nuevoId?: () => string
  // Respuestas del cuestionario guiado, por id de pregunta (solo Alcance, Política y Objetivos).
  respuestas?: Record<string, string>
}

export interface SeccionPlantilla {
  titulo: string
  tipo: 'texto' | 'tabla'
  columnas?: string[]
  // Texto: el contenido inicial (sin dato queda PENDIENTE).
  texto?: (c: ContextoPlantilla) => string | undefined
  // Tabla: las filas del cuerpo (sin ninguna queda una fila vacía para completar).
  llenar?: (c: ContextoPlantilla) => string[][]
}

export interface Plantilla {
  id: string
  nombre: string
  tipoDocumento: Documento['tipo']
  codigoBase: string
  proposito: string
  requiereProceso: boolean
  requiereProcesosDelProyecto: boolean
  preguntas?: PreguntaGuiada[]
  secciones: SeccionPlantilla[]
}

// ─── Constructores y utilidades ─────────────────────────────────────────────

const texto = (titulo: string, contenido?: (c: ContextoPlantilla) => string | undefined): SeccionPlantilla => ({
  titulo,
  tipo: 'texto',
  ...(contenido ? { texto: contenido } : {}),
})

const tabla = (titulo: string, columnas: string[], llenar?: (c: ContextoPlantilla) => string[][]): SeccionPlantilla => ({
  titulo,
  tipo: 'tabla',
  columnas,
  ...(llenar ? { llenar } : {}),
})

const unir = (lista?: string[]) => (lista?.length ? lista.join('; ') : '')
// La respuesta a una pregunta guiada, sin espacios sobrantes ('' si no se contestó).
const resp = (c: ContextoPlantilla, id: string) => c.respuestas?.[id]?.trim() ?? ''
const filaVacia = (ancho: number) => Array<string>(ancho).fill('')
const camposVacios = (campos: string[]): string[][] => campos.map((campo) => [campo, ''])
const porOrden = (proceso?: Proceso) => [...(proceso?.actividades ?? [])].sort((a, b) => a.orden - b.orden)

function encabezado(titulo = 'Encabezado y control documental'): SeccionPlantilla {
  return texto(titulo, (c) =>
    [`Código: ${c.codigo || PENDIENTE}`, `Referencia normativa: ${c.edicionNorma}`, ...(c.organizacion ? [`Organización: ${c.organizacion}`] : [])].join('\n'),
  )
}

const aprobacion = (): SeccionPlantilla => tabla('Aprobación', ['Elaboró', 'Revisó', 'Aprobó'])

// ─── Preguntas guiadas (alimentan el cuestionario del bloque B2) ────────────

const PREGUNTAS_POLITICA: PreguntaGuiada[] = [
  { id: 'productos', texto: '¿Qué productos o servicios ofrece la empresa?' },
  { id: 'clientes', texto: '¿Quiénes son sus principales clientes o usuarios?' },
  { id: 'necesidades', texto: '¿Qué necesidades y expectativas busca satisfacer?' },
  { id: 'calidad', texto: '¿Qué características distinguen la calidad de sus productos o servicios?' },
  { id: 'requisitos', texto: '¿Cómo se compromete a cumplir los requisitos aplicables?' },
  { id: 'mejora', texto: '¿Cómo mejorará continuamente el SGC?' },
]

const PREGUNTAS_ALCANCE: PreguntaGuiada[] = [
  { id: 'actividad', texto: '¿A qué se dedica la organización?' },
  { id: 'productos', texto: '¿Qué productos y servicios proporciona?' },
  { id: 'ubicaciones', texto: '¿En qué ubicaciones opera?' },
  { id: 'procesos', texto: '¿Qué procesos y áreas cubre el sistema de gestión?' },
  { id: 'externas', texto: '¿Qué actividades se subcontratan o suministran externamente?' },
  { id: 'exclusiones', texto: '¿Hay algún requisito que no aplique? ¿Por qué?' },
]

const PREGUNTAS_OBJETIVOS: PreguntaGuiada[] = [
  { id: 'resultados', texto: '¿Qué resultados de calidad quiere mejorar (entregas, defectos, satisfacción, etc.)?' },
  { id: 'linea_base', texto: '¿Con qué datos actuales cuenta como punto de partida?' },
  { id: 'responsables', texto: '¿Quién será responsable de cada objetivo y cada cuánto se medirá?' },
  { id: 'acciones', texto: '¿Qué acciones y recursos se necesitan para alcanzarlos?' },
]

// ─── Plantillas ─────────────────────────────────────────────────────────────

const ALCANCE: Plantilla = {
  id: 'alcance',
  nombre: 'Alcance del SGC',
  tipoDocumento: 'Alcance',
  codigoBase: 'SGC-ALC-001',
  proposito: 'Definir los límites, la aplicabilidad y las actividades cubiertas por el SGC.',
  requiereProceso: false,
  requiereProcesosDelProyecto: false,
  preguntas: PREGUNTAS_ALCANCE,
  secciones: [
    encabezado(),
    tabla('Identificación de la organización', ['Campo', 'Información'], (c) => [
      ['Razón social', c.organizacion ?? ''],
      ['Nombre comercial', ''],
      ['Domicilio y ubicaciones', resp(c, 'ubicaciones')],
      ['Actividad económica', resp(c, 'actividad')],
      ['Productos', resp(c, 'productos')],
      ...camposVacios(['Servicios', 'Personal aproximado', 'Responsable del SGC']),
    ]),
    texto('Declaración del alcance'),
    tabla('Límites y cobertura', ['Elemento', 'Descripción'], (c) => [
      ['Ubicaciones incluidas', resp(c, 'ubicaciones')],
      // Lo que escribió el usuario manda; si no, los procesos levantados en el proyecto.
      ['Procesos incluidos', resp(c, 'procesos') || (c.procesos ?? []).map((p) => p.nombre).join('; ')],
      ['Productos y servicios incluidos', resp(c, 'productos')],
      ['Áreas incluidas', ''],
      ['Actividades externas pertinentes', resp(c, 'externas')],
    ]),
    tabla('Cuestiones internas y externas', ['Tipo', 'Cuestión identificada', 'Efecto posible en el SGC'], () => [
      ['Interna', '', ''],
      ['Externa', '', ''],
    ]),
    texto('Requisitos no aplicables, cuando corresponda', (c) => resp(c, 'exclusiones') || undefined),
    aprobacion(),
  ],
}

const POLITICA: Plantilla = {
  id: 'politica',
  nombre: 'Política de calidad',
  tipoDocumento: 'Política',
  codigoBase: 'SGC-POL-001',
  proposito: 'Establecer el compromiso y las directrices generales de la organización respecto a la calidad.',
  requiereProceso: false,
  requiereProcesosDelProyecto: false,
  preguntas: PREGUNTAS_POLITICA,
  secciones: [
    encabezado(),
    tabla('Preguntas guiadas', ['Pregunta', 'Respuesta de la organización'], (c) => PREGUNTAS_POLITICA.map((p) => [p.texto, resp(c, p.id)])),
    texto('Declaración de la política de calidad'),
    tabla('Comunicación y disponibilidad', ['Aspecto', 'Definición'], () =>
      camposVacios(['Medio de comunicación interno', 'Responsable de comunicarla', 'Disponibilidad externa, cuando aplique', 'Condición de revisión']),
    ),
    tabla('Historial de cambios', ['Versión', 'Fecha', 'Descripción del cambio', 'Responsable'], () => [['00', '', 'Emisión inicial', '']]),
    aprobacion(),
  ],
}

const OBJETIVOS: Plantilla = {
  id: 'objetivos',
  nombre: 'Objetivos de calidad',
  tipoDocumento: 'Objetivos',
  codigoBase: 'SGC-OBJ-001',
  proposito: 'Establecer resultados de calidad medibles, responsables, recursos, plazos y métodos de seguimiento.',
  requiereProceso: false,
  requiereProcesosDelProyecto: false,
  preguntas: PREGUNTAS_OBJETIVOS,
  secciones: [
    encabezado(),
    texto(
      'Criterios de formulación',
      () =>
        'Los objetivos se alinean con la política de calidad, se expresan de forma medible, consideran requisitos aplicables, cuentan con responsables y recursos, y se revisan con una frecuencia definida.',
    ),
    tabla('Matriz de objetivos', ['ID', 'Objetivo', 'Indicador / fórmula', 'Meta', 'Responsable', 'Frecuencia'], (c) => [
      ['OC-01', resp(c, 'resultados'), '', '', resp(c, 'responsables'), ''],
    ]),
    tabla('Plan para alcanzar los objetivos', ['ID', 'Actividad / acción', 'Recursos', 'Responsable', 'Fecha compromiso', 'Evidencia'], (c) => [
      ['OC-01', resp(c, 'acciones'), '', '', '', ''],
    ]),
    tabla('Seguimiento de resultados', ['Periodo', 'Objetivo', 'Resultado', 'Cumplimiento', 'Análisis / desviación', 'Acción definida'], (c) =>
      resp(c, 'linea_base') ? [['', 'OC-01', resp(c, 'linea_base'), '', '', '']] : [],
    ),
    tabla('Revisión y aprobación', ['Elaboró', 'Revisó', 'Aprobó']),
  ],
}

const MAPA: Plantilla = {
  id: 'mapa',
  nombre: 'Mapa de procesos',
  tipoDocumento: 'Mapa de procesos',
  codigoBase: 'SGC-MAP-001',
  proposito: 'Representar los procesos de la organización y sus interacciones.',
  requiereProceso: false,
  requiereProcesosDelProyecto: true,
  secciones: [
    encabezado(),
    tabla('Clasificación de procesos', ['Tipo', 'Descripción', 'Procesos de la organización'], (c) => {
      // Los procesos sin tipo (levantados antes de que existiera) no se clasifican solos.
      const de = (tipo: TipoProceso) => (c.procesos ?? []).filter((p) => p.tipo === tipo).map((p) => p.nombre).join('; ')
      return [
        ['Estratégicos', 'Definen dirección, políticas, objetivos y seguimiento.', de('Estratégico')],
        ['Operativos / clave', 'Transforman requisitos y materiales en productos y servicios para el cliente.', de('Operativo')],
        ['Apoyo', 'Proporcionan recursos y soporte a los demás procesos.', de('Apoyo')],
      ]
    }),
    texto('Diagrama general del mapa de procesos'),
    tabla('Matriz de interacción', ['Proceso', 'Entradas', 'Salidas', 'Cliente interno / externo', 'Procesos relacionados'], (c) =>
      (c.procesos ?? []).map((p) => [p.nombre, unir(p.entradas), unir(p.salidas), unir(p.clientes), '']),
    ),
    texto('Control del mapa'),
  ],
}

const FICHA: Plantilla = {
  id: 'ficha',
  nombre: 'Ficha de caracterización de procesos',
  tipoDocumento: 'Ficha de proceso',
  codigoBase: 'SGC-FCP-001',
  proposito: 'Describir el proceso, propósito, alcance, responsables, entradas, actividades, salidas, recursos e indicadores.',
  requiereProceso: true,
  requiereProcesosDelProyecto: false,
  secciones: [
    encabezado(),
    tabla('Identificación del proceso', ['Campo', 'Información'], ({ proceso: p }) => [
      ['Nombre del proceso', p?.nombre ?? ''],
      ['Código', ''],
      ['Tipo', p?.tipo ?? ''],
      ['Responsable / propietario', p?.puestoResponsable ?? ''],
      ['Objetivo', p?.objetivo || p?.descripcion || ''],
      ['Alcance', p?.alcance ?? ''],
      ['Ubicación / área', ''],
    ]),
    tabla('Entradas, actividades y salidas', ['Proveedor / origen', 'Entrada / requisito', 'Actividad principal', 'Salida / resultado', 'Cliente / destino'], ({ proceso }) => {
      const actividades = porOrden(proceso)
      if (actividades.length) return actividades.map((a) => ['', a.entradas, a.descripcion, a.resultado, ''])
      // Sin actividades levantadas no se pierde lo que el proceso sí declara: una fila resumen.
      const resumen = [unir(proceso?.proveedores), unir(proceso?.entradas), '', unir(proceso?.salidas), unir(proceso?.clientes)]
      return resumen.some(Boolean) ? [resumen] : []
    }),
    tabla('Responsabilidades', ['Puesto / rol', 'Responsabilidad', 'Autoridad / decisión'], ({ proceso }) =>
      proceso?.puestoResponsable ? [[proceso.puestoResponsable, '', '']] : [],
    ),
    tabla('Recursos y controles', ['Categoría', 'Recursos / controles necesarios'], ({ proceso: p }) => [
      ['Personal y competencias', p?.personalInvolucrado ?? ''],
      ['Infraestructura y equipo', unir([...(p?.equipos ?? []), ...(p?.sistemas ?? [])])],
      ['Ambiente de operación', ''],
      ['Información documentada', unir(p?.registros)],
      ['Proveedores externos', unir(p?.proveedores)],
      ['Controles', unir(p?.controles)],
    ]),
    tabla('Indicadores de desempeño', ['Indicador', 'Fórmula / método', 'Meta', 'Frecuencia', 'Fuente de datos', 'Responsable'], ({ proceso }) =>
      (proceso?.indicadores ?? []).map((indicador) => [indicador, '', '', '', '', '']),
    ),
    tabla('Riesgos y oportunidades', ['Riesgo / oportunidad', 'Consecuencia / beneficio', 'Acción o control', 'Responsable', 'Seguimiento'], ({ proceso }) =>
      (proceso?.riesgos ?? []).map((riesgo) => [riesgo, '', '', '', '']),
    ),
    texto('Seguimiento y aprobación'),
  ],
}

const PROCEDIMIENTO: Plantilla = {
  id: 'procedimiento',
  nombre: 'Procedimiento',
  tipoDocumento: 'Procedimiento',
  codigoBase: 'SGC-PR-IT-001',
  proposito: 'Establecer la secuencia de un proceso.',
  requiereProceso: true,
  requiereProcesosDelProyecto: false,
  secciones: [
    encabezado(),
    tabla('Datos del procedimiento', ['Campo', 'Información'], ({ proceso: p, codigo }) => [
      ['Nombre del procedimiento', p?.nombre ?? ''],
      ['Código', codigo],
      ['Versión / fecha', '00'],
      ['Área responsable', ''],
      ['Responsable', p?.puestoResponsable ?? ''],
      ['Documentos relacionados', ''],
    ]),
    texto('Objetivo', ({ proceso: p }) => p?.objetivo || p?.descripcion),
    texto('Alcance', ({ proceso: p }) => p?.alcance),
    tabla('Definiciones y abreviaturas', ['Término', 'Definición']),
    tabla('Responsabilidades', ['Puesto / rol', 'Responsabilidad'], ({ proceso }) => (proceso?.puestoResponsable ? [[proceso.puestoResponsable, '']] : [])),
    texto('Recursos y condiciones necesarias', ({ proceso: p }) => [...(p?.recursosMateriales ?? []), ...(p?.equipos ?? []), ...(p?.sistemas ?? [])].join('\n') || undefined),
    tabla('Desarrollo del procedimiento', ['Paso', 'Actividad / descripción', 'Responsable', 'Registro / evidencia'], ({ proceso, nombreUsuario }) =>
      porOrden(proceso).map((a) => [String(a.orden), a.descripcion, nombreUsuario?.(a.responsableId) ?? '', '']),
    ),
    texto('Criterios de aceptación y controles', ({ proceso: p }) => p?.controles?.join('\n') || undefined),
    tabla('Registros generados', ['Registro', 'Código', 'Responsable de conservar', 'Ubicación / medio', 'Retención'], ({ proceso }) =>
      (proceso?.registros ?? []).map((registro) => [registro, '', '', '', '']),
    ),
    texto('Anexos y documentos relacionados'),
    tabla('Historial de cambios y aprobación', ['Versión', 'Fecha', 'Descripción del cambio', 'Elaboró', 'Aprobó'], () => [['00', '', 'Emisión inicial', '', '']]),
  ],
}

const INSTRUCCION: Plantilla = {
  id: 'instruccion',
  nombre: 'Instrucción de trabajo',
  tipoDocumento: 'Instrucción de trabajo',
  codigoBase: 'SGC-PR-IT-001',
  proposito: 'Establecer el detalle de ejecución de una tarea específica.',
  requiereProceso: true,
  requiereProcesosDelProyecto: false,
  secciones: [
    encabezado(),
    tabla('Datos de la instrucción', ['Campo', 'Información'], ({ proceso: p, codigo }) => [
      ['Nombre de la instrucción', p?.nombre ?? ''],
      ['Código', codigo],
      ['Procedimiento relacionado', ''],
      ['Área / equipo', ''],
      ['Responsable', p?.puestoResponsable ?? ''],
      ['Versión / fecha', '00'],
    ]),
    texto('Objetivo y alcance de la tarea', ({ proceso: p }) => [p?.objetivo, p?.alcance].filter(Boolean).join('\n') || undefined),
    texto('Seguridad, precauciones y equipo de protección'),
    tabla('Materiales, herramientas y condiciones previas', ['Material / herramienta / condición', 'Especificación o requisito', 'Verificación previa'], ({ proceso: p }) =>
      [...(p?.recursosMateriales ?? []), ...(p?.equipos ?? [])].map((item) => [item, '', '']),
    ),
    tabla('Secuencia detallada de trabajo', ['N.º', 'Instrucción paso a paso', 'Referencia / evidencia', 'Criterio de aceptación'], ({ proceso }) =>
      porOrden(proceso).map((a) => [String(a.orden), a.descripcion, '', '']),
    ),
    texto('Qué hacer ante una anomalía'),
    tabla('Registro de ejecución', ['Fecha', 'Persona que ejecuta', 'Equipo / lote / orden', 'Resultado', 'Observaciones']),
    aprobacion(),
  ],
}

const FORMATO: Plantilla = {
  id: 'formato',
  nombre: 'Formato / lista de verificación',
  tipoDocumento: 'Formato',
  codigoBase: 'FO-001',
  proposito: 'Registrar datos o verificar el cumplimiento de criterios.',
  requiereProceso: false,
  requiereProcesosDelProyecto: false,
  secciones: [
    encabezado('Encabezado y control'),
    texto('Instrucciones de uso'),
    tabla('Datos de identificación', ['Campo', 'Información']),
    tabla('Criterios de verificación', ['Criterio', 'Resultado', 'Observaciones']),
    texto('Resultado'),
    texto('Firmas y aprobación'),
  ],
}

export const PLANTILLAS: Plantilla[] = [ALCANCE, POLITICA, OBJETIVOS, MAPA, FICHA, PROCEDIMIENTO, INSTRUCCION, FORMATO]

export function plantillaPorId(id: string): Plantilla | undefined {
  return PLANTILLAS.find((p) => p.id === id)
}

// ─── Armado de las secciones ────────────────────────────────────────────────

export function crearSecciones(plantilla: Plantilla, contexto: ContextoPlantilla): SeccionDocumento[] {
  const base = Date.now()
  return plantilla.secciones.map((seccion, index) => {
    const id = contexto.nuevoId ? contexto.nuevoId() : `sec-${base}-${index}`
    if (seccion.tipo === 'texto') {
      return { id, titulo: seccion.titulo, tipo: 'texto', contenido: seccion.texto?.(contexto) || PENDIENTE }
    }
    const columnas = seccion.columnas ?? []
    const cuerpo = seccion.llenar?.(contexto) ?? []
    return {
      id,
      titulo: seccion.titulo,
      tipo: 'tabla',
      contenido: '',
      filas: [columnas, ...(cuerpo.length ? cuerpo : [filaVacia(columnas.length)])],
    }
  })
}
