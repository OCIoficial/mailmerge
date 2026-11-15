import { Table, Text } from '@mantine/core'
import type { Dataset } from '../merge/dataset.ts'

/** Contenido de la hoja cargada; el # coincide con el de la vista previa. */
export function DataTable({ dataset }: { dataset: Dataset }) {
  return (
    <Table.ScrollContainer minWidth={dataset.columns.length * 120} maxHeight={320} type="native">
      <Table stickyHeader striped withTableBorder withColumnBorders fz="xs" verticalSpacing={4}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            {dataset.columns.map((column) => (
              <Table.Th key={column.key}>
                <Text size="xs" fw={600} ff="monospace">
                  {column.key}
                </Text>
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {dataset.rows.map((row, index) => (
            <Table.Tr key={index}>
              <Table.Td c="dimmed">{index + 1}</Table.Td>
              {dataset.columns.map((column) => (
                <Table.Td key={column.key}>{row[column.key]}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
