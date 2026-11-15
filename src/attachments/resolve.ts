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

async function fileContent(file: FileNode, token: string | null): Promise<Uint8Array> {
  if (file.source.type === 'bytes') return file.source.data
  if (!token) throw new Error('Sign in with Google to download attachments from Drive.')
  return file.source.exportPdf ? exportDriveFileAsPdf(token, file.source.id) : downloadDriveFile(token, file.source.id)
}

function mimeTypeOf(file: FileNode): string {
  if (file.source.type === 'drive') return file.source.exportPdf ? 'application/pdf' : file.source.mimeType
  return 'application/octet-stream'
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
export async function buildAttachment(attachment: ResolvedAttachment, token: string | null): Promise<AttachmentContent> {
  const { node } = attachment
  if (node.kind === 'file') {
    return { filename: attachment.filename, mimeType: mimeTypeOf(node), data: await fileContent(node, token) }
  }
  const entries = await Promise.all(
    filesIn(node).map(async ({ path, file }) => [path, await fileContent(file, token)] as const),
  )
  return { filename: attachment.filename, mimeType: 'application/zip', data: await zipAsync(Object.fromEntries(entries)) }
}
