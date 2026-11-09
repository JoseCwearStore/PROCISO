// Paleta de los archivos exportados (Word y PDF), tomada del ejemplo que dio el usuario
// (Seis_plantillas_documentales_PROCISO): azul marino en títulos y encabezados de tabla con
// texto blanco, filas alternadas en gris azulado claro y bordes finos oscuros.
// Los colores van SIN "#" (así los pide Word); el PDF los usa con `#`.
export const PALETA = {
  titulo: '1F3864', // título del documento y encabezados de tabla
  seccion: '1F4E79', // títulos de sección
  textoEncabezado: 'FFFFFF',
  cebra: 'F2F5FA', // filas de datos alternas
  borde: '404040',
  aviso: '92400E',
  suave: '64748B', // pie de página
} as const

export const hex = (color: string) => `#${color}`
