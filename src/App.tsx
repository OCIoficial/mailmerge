import { AppShell, Grid, Stack } from '@mantine/core'
import { useLocalStorage } from '@mantine/hooks'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { AppHeader, type View } from './components/AppHeader.tsx'
import type { AttachmentTree } from './attachments/tree.ts'
import { AttachmentsPanel } from './components/AttachmentsPanel.tsx'
import { NormalizedData } from './components/NormalizedData.tsx'
import { ReviewView } from './components/ReviewView.tsx'
import { SendPanel } from './components/SendPanel.tsx'
import { useSender } from './mail/useSender.ts'
import { SpreadsheetPanel } from './components/SpreadsheetPanel.tsx'
import { TemplateEditor } from './components/TemplateEditor.tsx'
import { missingConfig } from './config.ts'
import { useAuth } from './google/AuthContext.tsx'
import type { Dataset } from './merge/dataset.ts'
import { normalizeDataset, type Normalization } from './merge/normalize.ts'
import { DEFAULT_SHEET_SETTINGS, useSheetSettings } from './merge/sheetSettings.ts'
import { compileTemplate, renderEmail } from './merge/render.ts'
import { EMPTY_TEMPLATE, type EmailTemplate } from './merge/template.ts'
import { Notice } from './components/Notice.tsx'

/** La vista se guarda en la URL (#review), para que recargar deje al usuario donde estaba. */
const viewFromHash = (): View => (window.location.hash === '#review' ? 'review' : 'edit')

function App() {
  const auth = useAuth()
  const [view, setView] = useState<View>(viewFromHash)
  useEffect(() => {
    const sync = () => setView(viewFromHash())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const changeView = (next: View) => {
    // Edit no deja un "#" suelto en la URL; el botón Atrás vuelve entre vistas.
    if (next === 'review') window.location.hash = 'review'
    else history.pushState(null, '', window.location.pathname + window.location.search)
    setView(next)
  }
  const [dataset, setDataset] = useState<Dataset | null>(null)
  // Árbol de archivos para los adjuntos; no se guarda entre sesiones.
  const [tree, setTree] = useState<AttachmentTree | null>(null)
  const [datasetVersion, setDatasetVersion] = useState(0)
  const [template, setTemplate] = useLocalStorage<EmailTemplate>({
    key: 'mail-merge:template',
    defaultValue: EMPTY_TEMPLATE,
    // Se lee de inmediato para que el editor arranque con el contenido guardado.
    getInitialValueInEffect: false,
    // Completa con los valores por defecto los campos que no existían al guardar.
    deserialize: (value) => {
      try {
        return { ...EMPTY_TEMPLATE, ...(value ? JSON.parse(value) : {}) }
      } catch {
        return EMPTY_TEMPLATE
      }
    },
  })

  // Encabezado y normalización se guardan por hoja: cada hoja tiene sus columnas.
  const sheetSettings = useSheetSettings()

  const updateTemplate = useCallback(
    (patch: Partial<EmailTemplate>) => setTemplate((current) => ({ ...current, ...patch })),
    [setTemplate],
  )

  // Filas excluidas del envío, por índice. Se reinician al cambiar de hoja o de encabezado,
  // porque los índices dejan de corresponder a las mismas filas.
  const [excluded, setExcluded] = useState<Set<number>>(() => new Set())
  // Estado de envío por fila; se reinicia con la planilla por la misma razón.
  const sender = useSender()
  const resetSender = sender.reset

  const changeDataset = useCallback(
    (next: Dataset | null) => {
      setDataset(next)
      setExcluded(new Set())
      resetSender()
      setDatasetVersion((version) => version + 1)
    },
    [resetSender],
  )

  const currentSheet = dataset?.sheetKey
  const normalization = currentSheet
    ? sheetSettings.settingsFor(currentSheet).normalization
    : DEFAULT_SHEET_SETTINGS.normalization
  const updateSheetSettings = sheetSettings.update
  const setNormalization = useCallback(
    (next: Normalization) => currentSheet && updateSheetSettings(currentSheet, { normalization: next }),
    [currentSheet, updateSheetSettings],
  )

  // Los correos se renderizan con los datos ya normalizados.
  const normalized = useMemo(
    () => (dataset ? normalizeDataset(dataset, normalization) : null),
    [dataset, normalization],
  )

  // El render de todas las filas no bloquea la escritura en el editor.
  const deferredTemplate = useDeferredValue(template)
  const compiled = useMemo(() => compileTemplate(deferredTemplate), [deferredTemplate])
  // Todas las filas (Review también muestra las excluidas); se envían solo las incluidas.
  const allEmails = useMemo(
    () => (compiled.errors.length > 0 ? [] : (normalized?.rows ?? []).map((row, i) => renderEmail(compiled, row, i, tree))),
    [compiled, normalized, tree],
  )
  const emails = useMemo(() => allEmails.filter((email) => !excluded.has(email.index)), [allEmails, excluded])
  const problemCount = emails.filter((email) => email.problems.length > 0).length

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <AppHeader view={view} onViewChange={changeView} problemCount={problemCount} />
      </AppShell.Header>
      <AppShell.Main>
        <Stack gap="md">
          {missingConfig.length > 0 && (
            <Notice tone="warning" title="Incomplete configuration">
              Missing environment variables: {missingConfig.join(', ')}. See <code>.env.example</code>.
            </Notice>
          )}
          {auth.error && (
            <Notice tone="error" title="Could not sign in with Google">
              {auth.error}
            </Notice>
          )}
          {/* Edit se oculta en vez de desmontarse, para conservar el estado de sus paneles. */}
          <div hidden={view !== 'edit'}>
            {/* Las columnas se estiran al mismo alto, así las bases de Spreadsheet y Attachments quedan alineadas. */}
            <Grid gap="md">
              <Grid.Col span={{ base: 12, lg: 7 }}>
                <SpreadsheetPanel onChange={changeDataset} settings={sheetSettings}>
                  {normalized && (
                    <NormalizedData
                      dataset={normalized}
                      normalization={normalization}
                      onChange={setNormalization}
                      excluded={excluded}
                      onExcludedChange={setExcluded}
                    />
                  )}
                </SpreadsheetPanel>
              </Grid.Col>
              <Grid.Col span={{ base: 12, lg: 5 }}>
                <Stack gap="md" h="100%">
                  <TemplateEditor template={template} columns={dataset?.columns ?? []} onChange={updateTemplate} />
                  <div style={{ flex: 1 }}>
                    <AttachmentsPanel
                      tree={tree}
                      onTreeChange={setTree}
                      paths={template.attachments}
                      onPathsChange={(attachments) => updateTemplate({ attachments })}
                    />
                  </div>
                </Stack>
              </Grid.Col>
            </Grid>
          </div>
          {view === 'review' && (
            <ReviewView
              key={datasetVersion}
              emails={allEmails}
              excluded={excluded}
              onExcludedChange={setExcluded}
              templateErrors={compiled.errors}
              problemCount={problemCount}
              statuses={sender.statuses}
              sendPanel={<SendPanel emails={emails} sender={sender} sample={Boolean(dataset?.sample)} />}
            />
          )}
        </Stack>
      </AppShell.Main>
    </AppShell>
  )
}

export default App
