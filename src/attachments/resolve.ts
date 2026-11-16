import { zip } from 'fflate'
import { filesIn, type TreeNode } from './tree.ts'

/** Límite de Gmail para el total de adjuntos de un correo. */
export const MAX_ATTACHMENTS_SIZE = 25 * 1024 * 1024

export interface ResolvedAttachment {
  filename: string
  kind: 'file' | 'zip'
  /** En un ZIP es la suma sin comprimir (cota superior). */
  size: number
  node: TreeNode
  /** Contenido del ZIP, con rutas relativas a la carpeta. */
  files: string[]
}

export function toAttachment(node: TreeNode): ResolvedAttachment {
  if (node.kind === 'file') {
    return { filename: node.filename, kind: 'file', size: node.size, node, files: [] }
  }
  const files = filesIn(node)
  const size = files.reduce((sum, { file }) => sum + file.size, 0)
  return { filename: `${node.name}.zip`, kind: 'zip', size, node, files: files.map(({ path }) => path) }
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

/** Arma el adjunto con el contenido ya cargado en el árbol; una carpeta se comprime en un ZIP. */
export async function buildAttachment(attachment: ResolvedAttachment): Promise<AttachmentContent> {
  const { node } = attachment
  if (node.kind === 'file') return { filename: attachment.filename, mimeType: node.mimeType, data: node.data }
  const entries = filesIn(node).map(({ path, file }) => [path, file.data] as const)
  return {
    filename: attachment.filename,
    mimeType: 'application/zip',
    data: await zipAsync(Object.fromEntries(entries)),
  }
}
