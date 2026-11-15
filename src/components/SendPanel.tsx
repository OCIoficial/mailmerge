import { Button, Card, Group, Modal, Progress, Stack, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useAuth } from '../google/AuthContext.tsx'
import type { Sender } from '../mail/useSender.ts'
import { ADDRESS_FIELDS, type ProblemField, type RenderedEmail } from '../merge/render.ts'
import { Notice, WarningIcon } from './Notice.tsx'

interface Props {
  emails: RenderedEmail[]
  sender: Sender
  /** Datos de ejemplo: solo se permite el envío de prueba. */
  sample: boolean
}

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`)

export function SendPanel({ emails, sender, sample }: Props) {
  const auth = useAuth()
  // null = aún no editado: se usa el correo de la cuenta conectada.
  const [testAddress, setTestAddress] = useState<string | null>(null)
  const testTo = testAddress ?? auth.email ?? ''
  const [testing, setTesting] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const first = emails[0]
  // La prueba ignora los destinatarios de la fila, así que solo importan los errores de render.
  const firstRenders = first?.problems.every((problem) => (ADDRESS_FIELDS as ProblemField[]).includes(problem.field))

  const sent = emails.filter((email) => sender.statuses.get(email.index)?.state === 'sent')
  const failed = emails.filter((email) => sender.statuses.get(email.index)?.state === 'failed')
  const pending = emails.filter((email) => sender.statuses.get(email.index)?.state !== 'sent')
  // Solo bloquean los problemas de los correos que faltan por enviar.
  const blocking = pending.filter((email) => email.problems.length > 0).length
  const attachmentCount = pending.reduce((sum, email) => sum + email.attachments.length, 0)

  async function sendTest() {
    if (!first) return
    setTesting(true)
    try {
      await sender.sendTest(first, testTo)
      notifications.show({ color: 'green', message: `Test email sent to ${testTo}.` })
    } catch (e) {
      notifications.show({ color: 'red', title: 'Test email not sent', message: (e as Error).message })
    } finally {
      setTesting(false)
    }
  }

  function confirmSend() {
    setConfirming(false)
    void sender.sendAll(emails)
  }

  const sendLabel =
    sent.length === 0 ? `Send ${plural(pending.length, 'email', 'emails')}` : `Send remaining ${pending.length}`

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Title order={4}>4. Send</Title>
        <Group align="end" gap="sm">
          <TextInput
            label="Test email"
            description="Sends the first email to this address, without Cc or Bcc."
            value={testTo}
            onChange={(event) => setTestAddress(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <Button
            variant="default"
            loading={testing}
            disabled={!auth.token || !testTo.includes('@') || !firstRenders || sender.running}
            onClick={sendTest}
          >
            Send test
          </Button>
        </Group>

        {sender.progress ? (
          <Stack gap={6}>
            <Group justify="space-between">
              <Text size="sm">
                Sending {Math.min(sender.progress.done + 1, sender.progress.total)} of {sender.progress.total}…
              </Text>
              <Button size="compact-sm" variant="default" onClick={sender.stop}>
                Stop
              </Button>
            </Group>
            <Progress value={(sender.progress.done / sender.progress.total) * 100} />
          </Stack>
        ) : pending.length > 0 ? (
          <Button
            disabled={!auth.token || sample || blocking > 0}
            onClick={() => setConfirming(true)}
          >
            {sendLabel}
          </Button>
        ) : (
          emails.length > 0 && (
            <Text size="sm" c="dimmed">
              All {plural(emails.length, 'email was', 'emails were')} sent.
            </Text>
          )
        )}

        {!sender.running && (sent.length > 0 || failed.length > 0) && (
          <Text size="sm" c="dimmed">
            {plural(sent.length, 'email', 'emails')} sent
            {failed.length > 0 && `, ${failed.length} failed. Failed emails are marked in the list`}.
          </Text>
        )}
        {!sender.running && sender.stopReason && (
          <Notice tone="error" title="Sending stopped">
            {sender.stopReason} Emails not sent yet stay pending.
          </Notice>
        )}

        {sample && (
          <Text size="sm" c="dimmed">
            Sample data can't be sent to its recipients. Use Send test instead.
          </Text>
        )}
        {blocking > 0 && (
          <Group gap={6} wrap="nowrap" align="flex-start">
            <Text c="orange" style={{ display: 'flex', paddingTop: 2 }}>
              <WarningIcon size={14} />
            </Text>
            <Text size="sm" c="dimmed">
              Fix the {blocking === 1 ? 'email that needs' : `${blocking} emails that need`} fixing to send.
            </Text>
          </Group>
        )}
      </Stack>

      <Modal opened={confirming} onClose={() => setConfirming(false)} title={`${sendLabel}?`} centered>
        <Stack gap="md">
          <Text size="sm">
            {plural(pending.length, 'email', 'emails')} will be sent from <b>{auth.email}</b>, one per row
            {attachmentCount > 0 && `, with ${plural(attachmentCount, 'attachment', 'attachments')} in total`}.
          </Text>
          <Text size="sm" c="dimmed">
            Sent emails can't be recalled. Keep this page open until sending finishes.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSend}>{sendLabel}</Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  )
}
