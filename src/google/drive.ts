import { buildTree, formatSize, type AttachmentTree, type TreeEntry } from '../attachments/tree.ts'
import { AuthError } from './api.ts'

const FOLDER = 'application/vnd.google-apps.folder'
const SHORTCUT = 'application/vnd.google-apps.shortcut'
/** Archivos nativos de Google que se adjuntan exportados a PDF. */
const EXPORTABLE = new Set([
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.drawing',
])

interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  shortcutDetails?: { targetId: string; targetMimeType: string }
}

async function driveFetch(token: string, url: string): Promise<Response> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (response.status === 401) throw new AuthError('Your Google session expired. Sign in again.')
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error?.message ?? `Google Drive error ${response.status}`)
  }
  return response
}

async function listChildren(token: string, folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, shortcutDetails)',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const page = (await (await driveFetch(token, `https://www.googleapis.com/drive/v3/files?${params}`)).json()) as {
      files: DriveFile[]
      nextPageToken?: string
    }
    files.push(...page.files)
    pageToken = page.nextPageToken
  } while (pageToken)
  return files
}

/** Tope para el total de una carpeta: protege de elegir por error una carpeta enorme. */
export const MAX_FOLDER_SIZE = 200 * 1024 * 1024

/** Descargas en paralelo, como el listado de carpetas, para no exceder las cuotas de la API. */
const CONCURRENCY = 5

interface PendingFile {
  path: string
  id: string
  mimeType: string
  /** Archivo nativo de Google (Docs, Sheets, Slides) que se exporta a PDF. */
  exportPdf: boolean
  size: number
}

export type DriveTreeProgress =
  | { phase: 'listing'; files: number }
  | { phase: 'downloading'; done: number; total: number }

/**
 * Lee la carpeta completa y descarga todos sus archivos, para que los errores aparezcan al
 * cargarla y no a mitad de un envío. Los atajos se siguen; los archivos nativos de Google
 * que no se pueden exportar a PDF se omiten. Si algún archivo falla, se informan todos juntos.
 */
export async function loadDriveTree(
  token: string,
  folder: { id: string; name: string },
  onProgress?: (progress: DriveTreeProgress) => void,
): Promise<AttachmentTree> {
  const pending: PendingFile[] = []
  const emptyDirs: string[] = []
  // Evita ciclos con atajos a carpetas que contienen al atajo.
  const visited = new Set<string>([folder.id])
  let queue = [{ id: folder.id, path: '' }]

  while (queue.length > 0) {
    const batch = queue.slice(0, CONCURRENCY)
    queue = queue.slice(CONCURRENCY)
    const results = await Promise.all(batch.map((dir) => listChildren(token, dir.id).then((files) => ({ dir, files }))))

    for (const { dir, files } of results) {
      if (files.length === 0 && dir.path) emptyDirs.push(dir.path)
      for (const file of files) {
        const id = file.shortcutDetails?.targetId ?? file.id
        const mimeType = file.mimeType === SHORTCUT ? (file.shortcutDetails?.targetMimeType ?? '') : file.mimeType
        const path = dir.path + file.name
        if (mimeType === FOLDER) {
          if (!visited.has(id)) {
            visited.add(id)
            queue.push({ id, path: `${path}/` })
          }
        } else if (mimeType.startsWith('application/vnd.google-apps.')) {
          if (EXPORTABLE.has(mimeType)) pending.push({ path, id, mimeType, exportPdf: true, size: 0 })
        } else {
          pending.push({ path, id, mimeType, exportPdf: false, size: Number(file.size ?? 0) })
        }
      }
    }
    onProgress?.({ phase: 'listing', files: pending.length })
  }

  // Los exportados no tienen tamaño hasta exportarlos; el tope cuenta solo los conocidos.
  const knownSize = pending.reduce((sum, file) => sum + file.size, 0)
  if (knownSize > MAX_FOLDER_SIZE) {
    throw new Error(
      `"${folder.name}" has ${formatSize(knownSize)} of files; the limit is ${formatSize(MAX_FOLDER_SIZE)}. Choose a smaller folder.`,
    )
  }

  const entries: TreeEntry[] = []
  const failures: string[] = []
  let done = 0
  onProgress?.({ phase: 'downloading', done, total: pending.length })
  let next = 0
  async function worker() {
    while (next < pending.length) {
      const file = pending[next++]
      try {
        const data = file.exportPdf
          ? await exportDriveFileAsPdf(token, file.id)
          : await downloadDriveFile(token, file.id)
        entries.push(
          file.exportPdf
            ? { path: file.path, data, mimeType: 'application/pdf', filename: `${file.path.split('/').pop()}.pdf` }
            : { path: file.path, data, mimeType: file.mimeType },
        )
      } catch (e) {
        // Sin sesión no tiene sentido seguir: se pide iniciar sesión de nuevo.
        if (e instanceof AuthError) throw e
        failures.push(`${file.path}: ${(e as Error).message}`)
      }
      onProgress?.({ phase: 'downloading', done: ++done, total: pending.length })
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker))

  if (failures.length > 0) {
    const count = failures.length === 1 ? '1 file' : `${failures.length} files`
    throw new Error([`Could not download ${count}:`, ...failures].join('\n'))
  }
  return buildTree(folder.name, 'drive', entries, emptyDirs)
}

export async function downloadDriveFile(token: string, id: string): Promise<Uint8Array> {
  const response = await driveFetch(
    token,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`,
  )
  return new Uint8Array(await response.arrayBuffer())
}

/** Exporta un archivo nativo de Google a PDF (la API limita la exportación a 10 MB). */
export async function exportDriveFileAsPdf(token: string, id: string): Promise<Uint8Array> {
  const response = await driveFetch(
    token,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=application%2Fpdf`,
  )
  return new Uint8Array(await response.arrayBuffer())
}
