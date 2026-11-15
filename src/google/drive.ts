import { buildTree, type AttachmentTree, type TreeEntry } from '../attachments/tree.ts'
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

/**
 * Lee el árbol completo de una carpeta (solo nombres y tamaños; el contenido se descarga al enviar).
 * Los atajos se siguen; los archivos nativos de Google que no se pueden exportar a PDF se omiten.
 */
export async function loadDriveTree(
  token: string,
  folder: { id: string; name: string },
  onProgress?: (files: number) => void,
): Promise<AttachmentTree> {
  const entries: TreeEntry[] = []
  const emptyDirs: string[] = []
  // Evita ciclos con atajos a carpetas que contienen al atajo.
  const visited = new Set<string>([folder.id])
  let queue = [{ id: folder.id, path: '' }]

  while (queue.length > 0) {
    // Hasta 5 carpetas en paralelo para no exceder las cuotas de la API.
    const batch = queue.slice(0, 5)
    queue = queue.slice(5)
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
          if (EXPORTABLE.has(mimeType)) {
            entries.push({ path, size: null, source: { type: 'drive', id, mimeType, exportPdf: true } })
          }
        } else {
          entries.push({
            path,
            size: file.size ? Number(file.size) : null,
            source: { type: 'drive', id, mimeType, exportPdf: false },
          })
        }
      }
    }
    onProgress?.(entries.length)
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
