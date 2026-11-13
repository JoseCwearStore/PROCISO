// Cómo se escribe el nombre de un estado en un distintivo (O6). Casi todos se muestran completos, igual que en los
// selectores; solo estos cuatro, que son largos, se abrevian para que quepan, y el distintivo trae su nombre
// completo como título (al pasar el cursor). "Análisis de procesos" ya no se acorta a "Análisis": así se parecía al
// "En análisis" de una no conformidad y no coincidía con el selector.
const ETIQUETAS_ABREVIADAS: Readonly<Record<string, string>> = {
  'Recopilación de información': 'Recopilación',
  'Elaboración documental': 'Elaboración doc.',
  'Requiere corrección': 'Req. corrección',
  'Pendiente de revisión': 'Pend. revisión',
}

export const etiquetaDeEstado = (estado: string): string => ETIQUETAS_ABREVIADAS[estado] ?? estado

export const tituloDeEstado = (estado: string): string | undefined => (estado in ETIQUETAS_ABREVIADAS ? estado : undefined)
