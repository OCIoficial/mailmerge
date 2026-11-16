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

async function readClipboardTable(): Promise<string[][]> {
  if (!navigator.clipboard) throw new Error("This browser doesn't allow reading the clipboard here.")
  let html: string | null = null
  let text: string | null = null
  try {
    // Algunos navegadores solo tienen readText: sin HTML, se usa el texto separado por tabs.
    if (typeof navigator.clipboard.read === 'function') {
      for (const item of await navigator.clipboard.read()) {
        if (item.types.includes('text/html')) html ??= await (await item.getType('text/html')).text()
        if (item.types.includes('text/plain')) text ??= await (await item.getType('text/plain')).text()
      }
    } else {
      text = await navigator.clipboard.readText()
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'NotAllowedError') {
      throw new Error('The browser blocked reading the clipboard. Allow it for this page and try again.')
    }
    throw e
  }
  const rows = trimRows((html ? parseHtmlTable(html) : null) ?? (text ? parseTsv(text) : []))
  if (!rows.some((cells) => cells.length > 0)) {
    throw new Error('The clipboard has no cells. Select and copy cells in a spreadsheet first.')
  }
  return rows
}

/**
 * Planilla pegada desde el portapapeles: una sola hoja, sin Google. Cargar la hoja lee el
 * portapapeles, así "Reload" pega de nuevo lo que se haya copiado después.
 */
export const clipboardSpreadsheets: SpreadsheetSource = {
  async pick() {
    // Se lee aquí para que un portapapeles vacío no reemplace la planilla ya cargada.
    await readClipboardTable()
    // Id fijo: el encabezado y la normalización de lo pegado se recuerdan entre pegados.
    return { id: 'clipboard', title: 'Pasted from clipboard', sheets: ['Pasted'] }
  },
  loadSheet: () => readClipboardTable(),
}
