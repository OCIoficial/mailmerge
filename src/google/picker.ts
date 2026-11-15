import { googleConfig } from '../config.ts'
import { loadScript } from './loadScript.ts'

let pickerReady: Promise<void> | null = null

function loadPicker() {
  pickerReady ??= loadScript('https://apis.google.com/js/api.js').then(
    () => new Promise<void>((resolve) => gapi.load('picker', () => resolve())),
  )
  return pickerReady
}

export interface PickedFile {
  id: string
  name: string
}

/** Abre Google Picker con una vista. Devuelve null si el usuario cancela. */
async function pick(token: string, title: string, view: google.picker.DocsView): Promise<PickedFile | null> {
  await loadPicker()
  return new Promise((resolve) => {
    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(googleConfig.apiKey)
      .setAppId(googleConfig.appId)
      .setLocale('en')
      .setTitle(title)
      .setCallback((data) => {
        const action = data[google.picker.Response.ACTION]
        if (action === google.picker.Action.PICKED) {
          const doc = data[google.picker.Response.DOCUMENTS]?.[0]
          resolve(
            doc
              ? { id: doc[google.picker.Document.ID] ?? '', name: doc[google.picker.Document.NAME] ?? '' }
              : null,
          )
        } else if (action === google.picker.Action.CANCEL) {
          resolve(null)
        }
      })
      .build()
    picker.setVisible(true)
  })
}

// Las vistas usan google.picker, que existe recién después de cargar el script.
export async function pickSpreadsheet(token: string) {
  await loadPicker()
  const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS).setMode(google.picker.DocsViewMode.LIST)
  return pick(token, 'Choose a spreadsheet', view)
}

export async function pickFolder(token: string) {
  await loadPicker()
  const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(true)
    .setMimeTypes('application/vnd.google-apps.folder')
    .setMode(google.picker.DocsViewMode.LIST)
  return pick(token, 'Choose a folder', view)
}

const ARCHIVE_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-gzip',
  'application/x-compressed-tar',
]

export async function pickArchive(token: string) {
  await loadPicker()
  const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
    .setMimeTypes(ARCHIVE_TYPES.join(','))
    .setMode(google.picker.DocsViewMode.LIST)
  return pick(token, 'Choose a ZIP or TAR.GZ file', view)
}
