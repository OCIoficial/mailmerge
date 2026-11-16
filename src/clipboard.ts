import type { SpreadsheetSource } from './sources.ts'

/**
 * Celdas de la primera tabla de un HTML. Google Sheets (y Excel) copian las celdas
 * seleccionadas como una <table>, que conserva los saltos de línea dentro de una celda.
 */
export function parseHtmlTable(html: string): string[][] | null {
  const table = new DOMParser().parseFromString(html, 'text/html').querySelector('table')
  if (!table) return null
  return [...table.rows].map((row) =>
    [...row.cells].flatMap((cell) => {
      // <br> es un salto de línea dentro de la celda.
      for (const br of cell.querySelectorAll('br')) br.replaceWith('\n')
      // Una celda combinada ocupa varias columnas: las demás quedan vacías, como en la planilla.
      return [cell.textContent ?? '', ...Array<string>(Math.max(0, cell.colSpan - 1)).fill('')]
    }),
  )
}

/**
 * Texto separado por tabs, como lo copia Google Sheets: una celda con tab, salto de línea o
 * comillas va entre comillas, y sus comillas se duplican.
 */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let i = 0
  while (i < text.length) {
    if (cell === '' && text[i] === '"') {
      // Celda entre comillas: termina en la comilla que no está duplicada.
      i++
      while (i < text.length && !(text[i] === '"' && text[i + 1] !== '"')) {
        cell += text[i]
        i += text[i] === '"' ? 2 : 1
      }
      i++
      continue
    }
    const char = text[i++]
    if (char === '\t') {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  if (cell !== '' || row.length > 0) rows.push([...row, cell])
  return rows
}

/** Quita las celdas vacías al final de cada fila, como la Sheets API, para no crear columnas vacías. */
function trimRows(rows: string[][]): string[][] {
  return rows.map((cells) => {
    let end = cells.length
    while (end > 0 && cells[end - 1].trim() === '') end--
    return cells.slice(0, end)
  })
}

/**
 * Celdas de un pegado. Se usa el evento paste (no navigator.clipboard): no pide permisos y
 * funciona igual en el teléfono, con "Pegar" del menú del sistema.
 */
export function readPastedTable(data: DataTransfer): string[][] {
  const html = data.getData('text/html')
  const text = data.getData('text/plain')
  const rows = trimRows((html ? parseHtmlTable(html) : null) ?? parseTsv(text))
  if (!rows.some((cells) => cells.length > 0)) {
    throw new Error('Nothing to paste. Select and copy cells in a spreadsheet first.')
  }
  return rows
}

/** Planilla pegada: una sola hoja, sin Google. No se recarga: no hay de dónde. */
export function pastedSpreadsheet(rows: string[][]): SpreadsheetSource {
  return {
    canReload: false,
    // Id fijo: el encabezado y la normalización de lo pegado se recuerdan entre pegados.
    pick: async () => ({ id: 'clipboard', title: 'Pasted cells', sheets: ['Pasted'] }),
    loadSheet: async () => rows,
  }
}
