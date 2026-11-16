import type { AttachmentTree } from './attachments/tree.ts'

/**
 * De dónde salen los datos. Google (src/google) y los datos de ejemplo (src/sample) implementan
 * las mismas interfaces, así los componentes no saben de dónde vienen.
 */

export interface Spreadsheet {
  id: string
  title: string
  sheets: string[]
}

export interface SpreadsheetSource {
  /** Si volver a cargar una hoja puede traer datos nuevos (no en lo pegado: no hay de dónde recargar). */
  canReload: boolean
  /** Deja elegir una planilla; null si se cancela. */
  pick(): Promise<Spreadsheet | null>
  /** Filas de una hoja, como strings, sin celdas vacías al final. */
  loadSheet(spreadsheet: Spreadsheet, sheet: string): Promise<string[][]>
}

/** Qué está haciendo una carga larga, y cuánto lleva si se puede medir. */
export interface LoadProgress {
  /** Por ejemplo "Downloading alumnos.zip". */
  message: string
  /** Avance medible: sin total no hay barra, solo el indicador animado. */
  done?: number
  total?: number
  unit?: 'bytes' | 'files'
}

export interface FileSource {
  /** Deja elegir y carga el árbol completo, con el contenido de cada archivo; null si se cancela. */
  pick(onProgress: (progress: LoadProgress) => void): Promise<AttachmentTree | null>
}
