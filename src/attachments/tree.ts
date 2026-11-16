/**
 * Archivo con su contenido ya descargado: el árbol completo se descarga al cargarlo, así
 * los errores aparecen antes de enviar y al enviar no se descarga nada.
 */
export interface FileNode {
  kind: 'file'
  id: string
  /** Nombre en el árbol; es el que usan las rutas de adjuntos. */
  name: string
  /** Nombre con el que se adjunta (un Google Doc exportado lleva ".pdf"). */
  filename: string
  mimeType: string
  size: number
  data: Uint8Array
}

export interface DirNode {
  kind: 'dir'
  id: string
  name: string
  /** Drive permite nombres repetidos en una carpeta, así que no es un mapa. */
  children: TreeNode[]
}

export type TreeNode = FileNode | DirNode

export interface AttachmentTree {
  name: string
  origin: 'drive' | 'archive' | 'sample'
  root: DirNode
  fileCount: number
  totalSize: number
}

export interface TreeEntry {
  /** Ruta relativa a la raíz, separada por "/". */
  path: string
  data: Uint8Array
  /** Si falta, se deduce de la extensión. */
  mimeType?: string
  /** Si falta, el nombre del archivo en la ruta. */
  filename?: string
}

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  html: 'text/html',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  zip: 'application/zip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

const mimeTypeFromName = (name: string) =>
  MIME_TYPES[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'

let nextId = 0
const newId = () => `n${nextId++}`

/** Arma el árbol a partir de una lista plana de archivos; las carpetas se crean según las rutas. */
export function buildTree(name: string, origin: AttachmentTree['origin'], entries: TreeEntry[], emptyDirs: string[] = []): AttachmentTree {
  const root: DirNode = { kind: 'dir', id: newId(), name, children: [] }

  function dirAt(segments: string[]): DirNode {
    let dir = root
    for (const segment of segments) {
      let child = dir.children.find((c): c is DirNode => c.kind === 'dir' && c.name === segment)
      if (!child) {
        child = { kind: 'dir', id: newId(), name: segment, children: [] }
        dir.children.push(child)
      }
      dir = child
    }
    return dir
  }

  for (const path of emptyDirs) dirAt(splitPath(path))
  let totalSize = 0
  for (const entry of entries) {
    const segments = splitPath(entry.path)
    const fileName = segments.pop()
    if (!fileName) continue
    dirAt(segments).children.push({
      kind: 'file',
      id: newId(),
      name: fileName,
      filename: entry.filename ?? fileName,
      mimeType: entry.mimeType ?? mimeTypeFromName(fileName),
      size: entry.data.length,
      data: entry.data,
    })
    totalSize += entry.data.length
  }

  sortTree(root)
  return { name, origin, root, fileCount: entries.length, totalSize }
}

function sortTree(dir: DirNode) {
  dir.children.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1))
  for (const child of dir.children) if (child.kind === 'dir') sortTree(child)
}

export function splitPath(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '' && segment !== '.')
}

export function hasGlob(path: string): boolean {
  return /[*?]/.test(path)
}

/** Convierte un segmento con comodines (`*`, `?`) en una expresión regular exacta. */
function segmentPattern(segment: string): RegExp {
  const source = segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')
  return new RegExp(`^${source}$`)
}

/**
 * Busca la ruta en el árbol. Comparación exacta; `*` y `?` dentro de un nombre,
 * `**` para cualquier cantidad de carpetas. Devuelve todos los nodos que calzan.
 */
export function findPath(tree: AttachmentTree, path: string): TreeNode[] {
  const segments = splitPath(path)
  if (segments.length === 0) return []

  const results = new Set<TreeNode>()
  function walk(node: DirNode, index: number) {
    const segment = segments[index]
    const last = index === segments.length - 1
    if (segment === '**') {
      if (last) {
        // "a/**" calza con todo lo que hay dentro de a.
        for (const child of node.children) results.add(child)
        return
      }
      walk(node, index + 1)
      for (const child of node.children) if (child.kind === 'dir') walk(child, index)
      return
    }
    const pattern = segmentPattern(segment)
    for (const child of node.children) {
      if (!pattern.test(child.name)) continue
      if (last) results.add(child)
      else if (child.kind === 'dir') walk(child, index + 1)
    }
  }
  walk(tree.root, 0)
  return [...results]
}

/** Archivos dentro de una carpeta, con su ruta relativa a ella. */
export function filesIn(dir: DirNode, prefix = ''): { path: string; file: FileNode }[] {
  return dir.children.flatMap((child) =>
    child.kind === 'file'
      ? [{ path: prefix + child.filename, file: child }]
      : filesIn(child, `${prefix}${child.name}/`),
  )
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
