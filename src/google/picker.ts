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

/** Abre Google Picker para elegir una planilla. Devuelve null si el usuario cancela. */
export async function pickSpreadsheet(token: string): Promise<PickedFile | null> {
  await loadPicker()
  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS).setMode(
      google.picker.DocsViewMode.LIST,
    )
    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(googleConfig.apiKey)
      .setAppId(googleConfig.appId)
      .setLocale('en')
      .setTitle('Choose a spreadsheet')
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
