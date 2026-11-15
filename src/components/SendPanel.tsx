import { Button, Card, Group, Modal, Progress, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconMailForward, IconPlayerStop, IconSend } from '@tabler/icons-react'
import { plural, type SendControls } from '../mail/useSendControls.ts'
import { Notice, WarningIcon } from './Notice.tsx'
import classes from './SendPanel.module.css'

function TestButton({ controls, short = false }: { controls: SendControls; short?: boolean }) {
  return (
    <Button
      variant="default"
      leftSection={<IconMailForward size={16} />}
      loading={controls.testing}
      disabled={!controls.canTest}
      onClick={controls.sendTest}
    >
      {/* En la barra del teléfono no hay espacio para "Send test". */}
      {short ? 'Test' : 'Send test'}
    </Button>
  )
}

function SendingProgress({ controls }: { controls: SendControls }) {
  const progress = controls.sender.progress
  if (!progress) return null
  return (
    <Stack gap={6}>
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm">
          Sending {Math.min(progress.done + 1, progress.total)} of {progress.total}…
        </Text>
        <Button variant="default" leftSection={<IconPlayerStop size={16} />} onClick={controls.sender.stop}>
          Stop
        </Button>
      </Group>
      <Progress value={(progress.done / progress.total) * 100} />
    </Stack>
  )
}

function BlockingNote({ blocking }: { blocking: number }) {
  return (
    <Group gap={6} wrap="nowrap" align="flex-start">
      <Text c="orange" style={{ display: 'flex', paddingTop: 2 }}>
        <WarningIcon size={14} />
      </Text>
      <Text size="sm" c="dimmed">
        Fix the {blocking === 1 ? 'email that needs' : `${blocking} emails that need`} fixing to send.
      </Text>
    </Group>
  )
}

interface PanelProps {
  controls: SendControls
  /** Teléfono: los botones y el progreso van en la barra fija; aquí queda solo la dirección de prueba. */
  compact: boolean
}

export function SendPanel({ controls, compact }: PanelProps) {
  const { sender, sent, failed, pending, emails, blocking, sample } = controls

  const testInput = (
    <TextInput
      label="Test email"
      description={
        compact
          ? 'Test sends the first email to this address, without Cc or Bcc.'
          : 'Sends the first email to this address, without Cc or Bcc.'
      }
      value={controls.testTo}
      onChange={(event) => controls.setTestAddress(event.currentTarget.value)}
      style={{ flex: 1, minWidth: 200 }}
    />
  )

  if (compact) {
    return (
      <Card withBorder>
        <Stack gap="sm">
          <Title order={4}>4. Send</Title>
          {testInput}
        </Stack>
      </Card>
    )
  }

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Title order={4}>4. Send</Title>
        <Group align="end" gap="sm">
          {testInput}
          <TestButton controls={controls} />
        </Group>

        {sender.progress ? (
          <SendingProgress controls={controls} />
        ) : pending.length > 0 ? (
          <Button
            leftSection={<IconSend size={16} />}
            disabled={!controls.canSend}
            onClick={() => controls.setConfirming(true)}
          >
            {controls.sendLabel}
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
        {blocking > 0 && <BlockingNote blocking={blocking} />}
      </Stack>
    </Card>
  )
}

/**
 * Barra fija sobre las pestañas del teléfono: Test y Send siempre al alcance del pulgar,
 * con una línea que explica por qué Send está deshabilitado.
 */
export function SendBar({ controls }: { controls: SendControls }) {
  const { sender, sent, failed, pending, emails, blocking, sample } = controls

  if (sender.progress) {
    return (
      <div className={classes.bar}>
        <SendingProgress controls={controls} />
      </div>
    )
  }

  if (pending.length === 0) {
    return (
      <div className={classes.bar}>
        <Text size="sm" c="dimmed">
          ✓ All {plural(emails.length, 'email was', 'emails were')} sent.
        </Text>
      </div>
    )
  }

  // Una sola línea de estado: primero el resultado del último envío, luego por qué no se puede enviar.
  let status = null
  if (sender.stopReason) {
    status = (
      <Text size="sm" c="red" lineClamp={2}>
        Sending stopped. {sender.stopReason}
      </Text>
    )
  } else if (sent.length > 0 || failed.length > 0) {
    status = (
      <Text size="sm" c="dimmed">
        ✓ {sent.length} sent{failed.length > 0 && ` · ✕ ${failed.length} failed`}
      </Text>
    )
  } else if (!controls.signedIn) {
    status = (
      <Text size="sm" c="dimmed">
        Sign in to send.
      </Text>
    )
  } else if (blocking > 0) {
    status = <BlockingNote blocking={blocking} />
  } else if (sample) {
    status = (
      <Text size="sm" c="dimmed">
        Sample data can't be sent. Use Test.
      </Text>
    )
  }

  return (
    <div className={classes.bar}>
      {status}
      <Group gap="xs" wrap="nowrap">
        <TestButton controls={controls} short />
        <Button
          flex={1}
          leftSection={<IconSend size={16} />}
          disabled={!controls.canSend}
          onClick={() => controls.setConfirming(true)}
        >
          {controls.sendLabel}
        </Button>
      </Group>
    </div>
  )
}

/** Confirmación del envío; una sola, sirve tanto a la tarjeta como a la barra. */
export function SendConfirmModal({ controls }: { controls: SendControls }) {
  const { pending, attachmentCount } = controls
  return (
    <Modal
      opened={controls.confirming}
      onClose={() => controls.setConfirming(false)}
      title={`${controls.sendLabel}?`}
      centered
    >
      <Stack gap="md">
        <Text size="sm">
          {plural(pending.length, 'email', 'emails')} will be sent from <b>{controls.account}</b>, one per row
          {attachmentCount > 0 && `, with ${plural(attachmentCount, 'attachment', 'attachments')} in total`}.
        </Text>
        <Text size="sm" c="dimmed">
          Sent emails can't be recalled. Keep this page open until sending finishes.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => controls.setConfirming(false)}>
            Cancel
          </Button>
          <Button leftSection={<IconSend size={16} />} onClick={controls.confirmSend}>
            {controls.sendLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
