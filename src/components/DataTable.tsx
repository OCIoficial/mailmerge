import { Badge, Group, Stack, Table, Text } from '@mantine/core'
import { STEP_LABELS, type Normalization, type NormalizedDataset, type Step } from '../merge/normalize.ts'
import { ColumnSteps } from './ColumnSteps.tsx'

interface Props {
  dataset: NormalizedDataset
  normalization: Normalization
  showOriginal: boolean
  onColumnStepsChange: (key: string, steps: Step[]) => void
}

/** Contenido de la hoja (ya normalizado); el # coincide con el de la vista previa. */
export function DataTable({ dataset, normalization, showOriginal, onColumnStepsChange }: Props) {
  const rows = showOriginal ? dataset.original : dataset.rows
  return (
    <Table.ScrollContainer minWidth={dataset.columns.length * 140} maxHeight={360} type="native">
      <Table stickyHeader striped withTableBorder withColumnBorders fz="xs" verticalSpacing={4}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            {dataset.columns.map(({ key }) => {
              const steps = normalization.columns[key] ?? []
              return (
                <Table.Th key={key} style={{ verticalAlign: 'top' }}>
                  <Stack gap={4}>
                    <Group gap={4} justify="space-between" wrap="nowrap">
                      <Text size="xs" fw={600} ff="monospace">
                        {key}
                      </Text>
                      <ColumnSteps
                        columnKey={key}
                        steps={steps}
                        onChange={(next) => onColumnStepsChange(key, next)}
                      />
                    </Group>
                    {steps.length > 0 && (
                      <Group gap={4}>
                        {steps.map((step, i) => (
                          <Badge key={i} size="xs" variant="light" radius="sm" tt="none">
                            {STEP_LABELS[step.type].replace('…', '')}
                          </Badge>
                        ))}
                      </Group>
                    )}
                  </Stack>
                </Table.Th>
              )
            })}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, index) => (
            <Table.Tr key={index}>
              <Table.Td c="dimmed">{index + 1}</Table.Td>
              {dataset.columns.map(({ key }) => {
                const original = dataset.original[index][key]
                const changed = !showOriginal && dataset.rows[index][key] !== original
                return (
                  <Table.Td
                    key={key}
                    title={changed ? `Original: "${original}"` : undefined}
                    bg={changed ? 'var(--mantine-color-yellow-light)' : undefined}
                    style={{ whiteSpace: 'pre-wrap' }}
                  >
                    {row[key]}
                  </Table.Td>
                )
              })}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
