import { Anchor, Checkbox, Group, Stack, Switch, Text } from '@mantine/core'
import { useState } from 'react'
import type { GlobalNormalization, Normalization, NormalizedDataset, Step } from '../merge/normalize.ts'
import { DataTable } from './DataTable.tsx'

const GLOBAL_OPTIONS: { key: keyof GlobalNormalization; label: string; description: string }[] = [
  { key: 'trim', label: 'Trim spaces', description: 'Remove spaces at the start and end.' },
  { key: 'collapse', label: 'Collapse repeated spaces', description: 'Turn runs of spaces into one.' },
  { key: 'invisible', label: 'Remove invisible characters', description: 'Non-breaking and zero-width spaces.' },
]

interface Props {
  dataset: NormalizedDataset
  normalization: Normalization
  onChange: (normalization: Normalization) => void
  excluded: Set<number>
  onExcludedChange: (excluded: Set<number>) => void
}

export function NormalizedData({ dataset, normalization, onChange, excluded, onExcludedChange }: Props) {
  const [showOriginal, setShowOriginal] = useState(false)

  return (
    <Stack gap="sm">
      <Stack gap={6}>
        <Text size="sm" fw={500}>
          Normalize all columns
        </Text>
        <Group gap="lg">
          {GLOBAL_OPTIONS.map(({ key, label, description }) => (
            <Checkbox
              key={key}
              size="xs"
              label={label}
              title={description}
              checked={normalization.global[key]}
              onChange={(event) =>
                onChange({ ...normalization, global: { ...normalization.global, [key]: event.currentTarget.checked } })
              }
            />
          ))}
        </Group>
      </Stack>

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {excluded.size > 0 ? (
            <>
              {dataset.rows.length - excluded.size} of {dataset.rows.length} rows included (
              <Anchor component="button" type="button" fz="inherit" onClick={() => onExcludedChange(new Set())}>
                Include all
              </Anchor>
              )
            </>
          ) : (
            `${dataset.rows.length} rows`
          )}
          , {dataset.columns.length} columns, {dataset.changedCells} cells changed
        </Text>
        <Switch
          size="xs"
          label="Show original"
          checked={showOriginal}
          onChange={(event) => setShowOriginal(event.currentTarget.checked)}
        />
      </Group>

      <DataTable
        dataset={dataset}
        normalization={normalization}
        showOriginal={showOriginal}
        excluded={excluded}
        onExcludedChange={onExcludedChange}
        onColumnStepsChange={(key, steps: Step[]) =>
          onChange({ ...normalization, columns: { ...normalization.columns, [key]: steps } })
        }
      />
    </Stack>
  )
}
