// "1 hallazgo" y "2 hallazgos": la cantidad con su palabra en singular o plural (O33).
export const conCantidad = (n: number, singular: string, plural: string): string => `${n} ${n === 1 ? singular : plural}`
