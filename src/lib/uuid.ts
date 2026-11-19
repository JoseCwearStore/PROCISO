/**
 * Genera un UUID v4. Usa `crypto.randomUUID()` cuando está disponible
 * (contextos seguros: HTTPS o localhost). Cae a una implementación manual
 * en contextos no seguros (HTTP sobre LAN).
 */
export function randomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
