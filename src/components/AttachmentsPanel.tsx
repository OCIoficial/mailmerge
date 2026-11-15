import { Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core'

// Espacio reservado: adjuntos desde Google Drive (archivos, árbol de carpetas o zip).
export function AttachmentsPanel() {
  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={4}>3. Attachments</Title>
          <Badge variant="light" color="gray">
            Coming soon
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          Google Drive files, a folder tree with a path template, or a compressed archive.
        </Text>
        <Group gap="sm">
          <Button variant="default" disabled>
            Add from Drive
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}
