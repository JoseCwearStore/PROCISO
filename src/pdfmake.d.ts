// pdfmake 0.3 no trae tipos. Solo lo que usa src/lib/exportarPdf.ts.
declare module 'pdfmake/build/pdfmake' {
  interface PdfDocumento {
    getBuffer(): Promise<Uint8Array>
  }
  const pdfMake: {
    addVirtualFileSystem(vfs: Record<string, string>): void
    createPdf(definicion: object): PdfDocumento
  }
  export default pdfMake
}

declare module 'pdfmake/build/vfs_fonts' {
  const vfs: Record<string, string>
  export default vfs
}
