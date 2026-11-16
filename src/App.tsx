import { AppShell, Grid, Stack } from '@mantine/core'
import { useElementSize } from '@mantine/hooks'
import { useEffect, useState } from 'react'
import { AppHeader, BottomNav, type View } from './components/AppHeader.tsx'
import { AttachmentsPanel } from './components/AttachmentsPanel.tsx'
import { Notice } from './components/Notice.tsx'
import { ReviewView } from './components/ReviewView.tsx'
import { SendBar, SendConfirmModal } from './components/SendPanel.tsx'
import { SpreadsheetPanel } from './components/SpreadsheetPanel.tsx'
import { TemplateEditor } from './components/TemplateEditor.tsx'
import { missingConfig } from './config.ts'
import { useGoogle } from './google/index.ts'
import { useWarnWhileSending } from './mail/sending.ts'
import { useIsMobile } from './media.ts'
import { useStore } from './store.ts'

/** La vista se guarda en la URL (#review), para que recargar deje al usuario donde estaba. */
const viewFromHash = (): View => (window.location.hash === '#review' ? 'review' : 'edit')

/**
 * Solo la estructura de la página. No lee el template ni los correos: si lo hiciera, se
 * re-dibujaría en cada tecla y arrastraría a todos los paneles. Cada panel lee del store.
 */
function App() {
  const google = useGoogle()
  const mobile = useIsMobile()
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
    // Cada vista empieza arriba; si no, Review hereda el scroll de Edit.
    window.scrollTo({ top: 0 })
  }

  useWarnWhileSending()
  const datasetVersion = useStore((state) => state.datasetVersion)
  const hasEmails = useStore((state) => state.allEmails.length > 0)

  // En el teléfono, Review fija Test y Send sobre las pestañas; el pie crece con la barra.
  const showSendBar = mobile && view === 'review' && hasEmails
  const { ref: sendBarRef, height: sendBarHeight } = useElementSize()
  const footerHeight = 64 + (showSendBar ? Math.ceil(sendBarHeight) : 0)

  return (
    // En el teléfono, Edit y Review pasan del encabezado a una barra inferior.
    <AppShell header={{ height: 60 }} footer={{ height: footerHeight, collapsed: !mobile }} padding="md">
      <AppShell.Header>
        <AppHeader view={view} onViewChange={changeView} />
      </AppShell.Header>
      <AppShell.Main>
        <Stack gap="md">
          {missingConfig.length > 0 && (
            <Notice tone="warning" title="Incomplete configuration">
              Missing environment variables: {missingConfig.join(', ')}. See <code>.env.example</code>.
            </Notice>
          )}
          {google.error && (
            <Notice tone="error" title="Could not sign in with Google">
              {google.error}
            </Notice>
          )}
          {/* Edit se oculta en vez de desmontarse, para conservar el estado de sus paneles. */}
          <div hidden={view !== 'edit'}>
            {/* Las columnas se estiran al mismo alto, así las bases de Spreadsheet y Attachments quedan alineadas. */}
            <Grid gap="md">
              <Grid.Col span={{ base: 12, md: 7 }}>
                <SpreadsheetPanel />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 5 }}>
                <Stack gap="md" h="100%">
                  <TemplateEditor />
                  <div style={{ flex: 1 }}>
                    <AttachmentsPanel />
                  </div>
                </Stack>
              </Grid.Col>
            </Grid>
          </div>
          {/* key: una planilla nueva reinicia la selección y los filtros de Review. */}
          {view === 'review' && <ReviewView key={datasetVersion} />}
        </Stack>
      </AppShell.Main>
      {mobile && (
        <AppShell.Footer>
          {showSendBar && (
            <div ref={sendBarRef}>
              <SendBar />
            </div>
          )}
          <BottomNav view={view} onViewChange={changeView} />
        </AppShell.Footer>
      )}
      <SendConfirmModal />
    </AppShell>
  )
}

export default App
