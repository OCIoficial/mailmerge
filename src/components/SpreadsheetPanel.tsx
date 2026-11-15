import { Badge, Button, Card, Checkbox, Group, Select, Stack, Text, Title } from '@mantine/core'
import { useLocalStorage } from '@mantine/hooks'
import { useState, type ReactNode } from 'react'
import { getSheetValues, getSpreadsheet, type SpreadsheetInfo } from '../google/api.ts'
import { useAuth } from '../google/AuthContext.tsx'
import { pickSpreadsheet } from '../google/picker.ts'
import { toDataset, type Dataset } from '../merge/dataset.ts'
import { Notice } from './Notice.tsx'

interface LoadedSpreadsheet extends SpreadsheetInfo {
  /** Solo para la planilla de ejemplo: los valores vienen del código, no de Google. */
  sampleValues?: Record<string, string[][]>
}

interface Props {
  onChange: (dataset: Dataset | null) => void
  /** Se muestra al final de la tarjeta (normalización y tabla de datos). */
  children?: ReactNode
}

export function SpreadsheetPanel({ onChange, children }: Props) {
  const auth = useAuth()
  const [spreadsheet, setSpreadsheet] = useState<LoadedSpreadsheet | null>(null)
  const [sheet, setSheet] = useState<string | null>(null)
  // Valores crudos de la hoja, para rearmar las filas al cambiar el checkbox sin volver a pedirlos.
  const [values, setValues] = useState<string[][] | null>(null)
  const [hasHeader, setHasHeader] = useLocalStorage({
    key: 'mail-merge:has-header',
    defaultValue: false,
    getInitialValueInEffect: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSample = Boolean(spreadsheet?.sampleValues)
  const canLoad = isSample || Boolean(auth.token)

  async function withLoading(task: () => Promise<void>) {
    setLoading(true)
    setError(null)
    try {
      await task()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function emit(info: LoadedSpreadsheet, next: string[][], header: boolean) {
    onChange({ ...toDataset(next, header), sample: Boolean(info.sampleValues) })
  }

  async function loadSheet(info: LoadedSpreadsheet, name: string) {
    const next = info.sampleValues
      ? (info.sampleValues[name] ?? [])
      : await auth.run((token) => getSheetValues(token, info.id, name))
    setSheet(name)
    setValues(next)
    emit(info, next, hasHeader)
  }

  function changeHasHeader(next: boolean) {
    setHasHeader(next)
    if (spreadsheet && values) emit(spreadsheet, values, next)
  }

  const choose = () =>
    withLoading(async () => {
      const picked = await auth.run(pickSpreadsheet)
      if (!picked) return
      const info = await auth.run((token) => getSpreadsheet(token, picked.id))
      setSpreadsheet(info)
      await loadSheet(info, info.sheets[0])
    })

  const loadSample = () =>
    withLoading(async () => {
      // Import dinámico dentro de DEV: el ejemplo no queda en el build de producción.
      const { SAMPLE_SPREADSHEET } = await import('../sample/sampleSpreadsheet.ts')
      const info: LoadedSpreadsheet = {
        id: 'sample',
        title: SAMPLE_SPREADSHEET.title,
        sheets: Object.keys(SAMPLE_SPREADSHEET.sheets),
        sampleValues: SAMPLE_SPREADSHEET.sheets,
      }
      setSpreadsheet(info)
      await loadSheet(info, info.sheets[0])
    })

  return (
    <Card withBorder h="100%">
      <Stack gap="sm">
        <Title order={4}>1. Spreadsheet</Title>
        <Group gap="sm">
          <Button onClick={choose} loading={loading && !spreadsheet} disabled={!auth.token}>
            {spreadsheet ? 'Change spreadsheet' : 'Choose spreadsheet'}
          </Button>
          {import.meta.env.DEV && (
            <Button variant="light" color="grape" onClick={loadSample} disabled={loading}>
              Use sample data
            </Button>
          )}
          {spreadsheet && sheet && !isSample && (
            <Button
              variant="default"
              loading={loading}
              disabled={!auth.token}
              onClick={() => withLoading(() => loadSheet(spreadsheet, sheet))}
            >
              Reload
            </Button>
          )}
        </Group>
        {!auth.token && !isSample && (
          <Text size="sm" c="dimmed">
            Sign in with Google to choose a spreadsheet.
          </Text>
        )}
        {spreadsheet && (
          <>
            <Group gap="xs">
              <Text fw={500}>{spreadsheet.title}</Text>
              {isSample && (
                <Badge color="grape" variant="light">
                  Sample data
                </Badge>
              )}
            </Group>
            <Select
              label="Sheet"
              data={spreadsheet.sheets}
              value={sheet}
              allowDeselect={false}
              disabled={!canLoad || loading}
              onChange={(name) => name && withLoading(() => loadSheet(spreadsheet, name))}
            />
          </>
        )}
        <Checkbox
          label="First row is a header"
          description="Use the first row as variable names. Otherwise variables are the column letters: {{ A }}, {{ B }}..."
          checked={hasHeader}
          onChange={(event) => changeHasHeader(event.currentTarget.checked)}
        />
        {children}
        {error && (
          <Notice tone="error" title="Could not load the spreadsheet">
            {error}
          </Notice>
        )}
      </Stack>
    </Card>
  )
}
