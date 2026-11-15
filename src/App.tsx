import { Alert, AppShell, Grid, Stack } from '@mantine/core'
import { useLocalStorage } from '@mantine/hooks'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { AppHeader } from './components/AppHeader.tsx'
import { AttachmentsPanel } from './components/AttachmentsPanel.tsx'
import { PreviewList } from './components/PreviewList.tsx'
import { SendPanel } from './components/SendPanel.tsx'
import { SpreadsheetPanel } from './components/SpreadsheetPanel.tsx'
import { TemplateEditor } from './components/TemplateEditor.tsx'
import { missingConfig } from './config.ts'
import { useAuth } from './google/AuthContext.tsx'
import type { Dataset } from './merge/dataset.ts'
import { compileTemplate, renderEmail } from './merge/render.ts'
import { EMPTY_TEMPLATE, type EmailTemplate } from './merge/template.ts'

function App() {
  const auth = useAuth()
  const [dataset, setDataset] = useState<Dataset | null>(null)
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

  const updateTemplate = useCallback(
    (patch: Partial<EmailTemplate>) => setTemplate((current) => ({ ...current, ...patch })),
    [setTemplate],
  )

  const changeDataset = useCallback((next: Dataset | null) => {
    setDataset(next)
    setDatasetVersion((version) => version + 1)
  }, [])

  // El render de todas las filas no bloquea la escritura en el editor.
  const deferredTemplate = useDeferredValue(template)
  const compiled = useMemo(() => compileTemplate(deferredTemplate), [deferredTemplate])
  const emails = useMemo(
    () => (compiled.errors.length > 0 ? [] : (dataset?.rows ?? []).map((row, i) => renderEmail(compiled, row, i))),
    [compiled, dataset],
  )
  const problemCount = emails.filter((email) => email.problems.length > 0).length

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <AppHeader />
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
          <Grid gap="md">
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Stack gap="md">
                <SpreadsheetPanel dataset={dataset} onChange={changeDataset} />
                <TemplateEditor template={template} columns={dataset?.columns ?? []} onChange={updateTemplate} />
                <AttachmentsPanel />
                <SendPanel emails={emails} problemCount={problemCount} sample={Boolean(dataset?.sample)} />
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 7 }}>
              <PreviewList
                key={datasetVersion}
                emails={emails}
                templateErrors={compiled.errors}
                problemCount={problemCount}
              />
            </Grid.Col>
          </Grid>
        </Stack>
      </AppShell.Main>
    </AppShell>
  )
}

export default App
