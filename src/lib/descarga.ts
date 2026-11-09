// Descarga un archivo generado en el navegador (no pasa por ningún servidor). Pequeño y sin
// lógica: se verifica en el navegador, no con tests.
export function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  // El navegador necesita un instante para empezar la descarga antes de soltar la URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
