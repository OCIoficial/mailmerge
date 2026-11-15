import { zip } from 'fflate'
import { downloadDriveFile, exportDriveFileAsPdf } from '../google/drive.ts'
import { fileName, filesIn, type FileNode, type TreeNode } from './tree.ts'

/** Límite de Gmail para el total de adjuntos de un correo. */
export const MAX_ATTACHMENTS_SIZE = 25 * 1024 * 1024

export interface ResolvedAttachment {
  filename: string
  kind: 'file' | 'zip'
  /** En un ZIP es la suma sin comprimir (cota superior); null si incluye archivos de tamaño desconocido. */
  size: number | null
  node: TreeNode
  /** Contenido del ZIP, con rutas relativas a la carpeta. */
  files: string[]
}

export function toAttachment(node: TreeNode): ResolvedAttachment {
  if (node.kind === 'file') {
    return { filename: fileName(node), kind: 'file', size: node.size, node, files: [] }
  }
  const files = filesIn(node)
  const size = files.some(({ file }) => file.size === null) ? null : files.reduce((sum, { file }) => sum + (file.size ?? 0), 0)
  return { filename: `${node.name}.zip`, kind: 'zip', size, node, files: files.map(({ path }) => path) }
}

/** Contenido ya descargado por id de nodo, para no descargar dos veces un archivo usado en varios correos. */
export type ContentCache = Map<string, Promise<Uint8Array>>

function fileContent(file: FileNode, token: string | null, cache?: ContentCache): Promise<Uint8Array> {
  const cached = cache?.get(file.id)
  if (cached) return cached
  const source = file.source
  let content: Promise<Uint8Array>
  if (source.type === 'bytes') content = Promise.resolve(source.data)
  else if (!token) content = Promise.reject(new Error('Sign in with Google to download attachments from Drive.'))
  else content = source.exportPdf ? exportDriveFileAsPdf(token, source.id) : downloadDriveFile(token, source.id)
  // Si falla, no queda en caché: el siguiente intento vuelve a descargar.
  cache?.set(file.id, content)
  content.catch(() => cache?.delete(file.id))
  return content
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

function mimeTypeOf(file: FileNode): string {
  if (file.source.type === 'drive') return file.source.exportPdf ? 'application/pdf' : file.source.mimeType
  // Archivos de un comprimido: por extensión.
  return MIME_TYPES[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'
}

function zipAsync(files: Record<string, Uint8Array>) {
  return new Promise<Uint8Array>((resolve, reject) =>
    zip(files, { level: 6 }, (error, data) => (error ? reject(error) : resolve(data))),
  )
}

export interface AttachmentContent {
  filename: string
  mimeType: string
  data: Uint8Array
}

/** Descarga el archivo, o descarga y comprime la carpeta. Se usa al enviar. */
export async function buildAttachment(
  attachment: ResolvedAttachment,
  token: string | null,
  cache?: ContentCache,
): Promise<AttachmentContent> {
  const { node } = attachment
  if (node.kind === 'file') {
    return { filename: attachment.filename, mimeType: mimeTypeOf(node), data: await fileContent(node, token, cache) }
  }
  const entries = await Promise.all(
    filesIn(node).map(async ({ path, file }) => [path, await fileContent(file, token, cache)] as const),
  )
  return { filename: attachment.filename, mimeType: 'application/zip', data: await zipAsync(Object.fromEntries(entries)) }
}
