import { Button, Card, Group, Stack, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useAuth } from '../google/AuthContext.tsx'
import { ADDRESS_FIELDS, type RenderedEmail } from '../merge/render.ts'

interface Props {
  emails: RenderedEmail[]
  problemCount: number
  /** Datos de ejemplo: solo se permite el envío de prueba. */
  sample: boolean
}

function notImplemented() {
  notifications.show({ color: 'yellow', message: 'Sending is not implemented yet.' })
}

export function SendPanel({ emails, problemCount, sample }: Props) {
  const auth = useAuth()
  // null = aún no editado: se usa el correo de la cuenta conectada.
  const [testAddress, setTestAddress] = useState<string | null>(null)
  const testTo = testAddress ?? auth.email ?? ''

  const first = emails[0]
  // La prueba ignora los destinatarios de la fila, así que solo importan los errores de render.
  const firstRenders = first?.problems.every((problem) => ADDRESS_FIELDS.includes(problem.field))

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Title order={4}>4. Send</Title>
        <Group align="end" gap="sm">
          <TextInput
            label="Test email"
            description="Sends the first email to this address."
            value={testTo}
            onChange={(event) => setTestAddress(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <Button variant="default" disabled={!auth.token || !testTo || !firstRenders} onClick={notImplemented}>
            Send test
          </Button>
        </Group>
        <Button disabled={!auth.token || sample || emails.length === 0 || problemCount > 0} onClick={notImplemented}>
          Send {emails.length} emails
        </Button>
        {sample && (
          <Text size="sm" c="dimmed">
            Sample data can't be sent to its recipients. Use Send test instead.
          </Text>
        )}
        {problemCount > 0 && (
          <Text size="sm" c="red">
            Fix the {problemCount} emails with problems before sending.
          </Text>
        )}
      </Stack>
    </Card>
  )
}
