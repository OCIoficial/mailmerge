import { Alert, AppShell, Grid, Stack } from '@mantine/core'
import { useLocalStorage } from '@mantine/hooks'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { AppHeader, type View } from './components/AppHeader.tsx'
import type { AttachmentTree } from './attachments/tree.ts'
import { AttachmentsPanel } from './components/AttachmentsPanel.tsx'
import { NormalizedData } from './components/NormalizedData.tsx'
import { ReviewView } from './components/ReviewView.tsx'
import { SendPanel } from './components/SendPanel.tsx'
import { SpreadsheetPanel } from './components/SpreadsheetPanel.tsx'
import { TemplateEditor } from './components/TemplateEditor.tsx'
import { missingConfig } from './config.ts'
import { useAuth } from './google/AuthContext.tsx'
import type { Dataset } from './merge/dataset.ts'
import { DEFAULT_NORMALIZATION, normalizeDataset, type Normalization } from './merge/normalize.ts'
import { compileTemplate, renderEmail } from './merge/render.ts'
import { EMPTY_TEMPLATE, type EmailTemplate } from './merge/template.ts'

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

  const [normalization, setNormalization] = useLocalStorage<Normalization>({
    key: 'mail-merge:normalization',
    defaultValue: DEFAULT_NORMALIZATION,
    getInitialValueInEffect: false,
  })

  const updateTemplate = useCallback(
    (patch: Partial<EmailTemplate>) => setTemplate((current) => ({ ...current, ...patch })),
    [setTemplate],
  )

  const changeDataset = useCallback((next: Dataset | null) => {
    setDataset(next)
    setDatasetVersion((version) => version + 1)
  }, [])

  // Los correos se renderizan con los datos ya normalizados.
  const normalized = useMemo(
    () => (dataset ? normalizeDataset(dataset, normalization) : null),
    [dataset, normalization],
  )

  // El render de todas las filas no bloquea la escritura en el editor.
  const deferredTemplate = useDeferredValue(template)
  const compiled = useMemo(() => compileTemplate(deferredTemplate), [deferredTemplate])
  const emails = useMemo(
    () => (compiled.errors.length > 0 ? [] : (normalized?.rows ?? []).map((row, i) => renderEmail(compiled, row, i, tree))),
    [compiled, normalized, tree],
  )
  const problemCount = emails.filter((email) => email.problems.length > 0).length

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <AppHeader view={view} onViewChange={changeView} problemCount={problemCount} />
      </AppShell.Header>
      <AppShell.Main>
        <Stack gap="md">
          {missingConfig.length > 0 && (
            <Alert color="orange" title="Incomplete configuration">
              Missing environment variables: {missingConfig.join(', ')}. See <code>.env.example</code>.
            </Alert>
          )}
          {auth.error && (
            <Alert color="red" title="Could not sign in with Google">
              {auth.error}
            </Alert>
          )}
          {/* Edit se oculta en vez de desmontarse, para conservar el estado de sus paneles. */}
          <div hidden={view !== 'edit'}>
            {/* Las columnas se estiran al mismo alto, así las bases de Spreadsheet y Attachments quedan alineadas. */}
            <Grid gap="md">
              <Grid.Col span={{ base: 12, lg: 7 }}>
                <SpreadsheetPanel onChange={changeDataset}>
                  {normalized && (
                    <NormalizedData dataset={normalized} normalization={normalization} onChange={setNormalization} />
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
              emails={emails}
              templateErrors={compiled.errors}
              problemCount={problemCount}
              sendPanel={<SendPanel emails={emails} problemCount={problemCount} sample={Boolean(dataset?.sample)} />}
            />
          )}
        </Stack>
      </AppShell.Main>
    </AppShell>
  )
}

export default App
