import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useGoogle } from '../google/index.ts'
import { ADDRESS_FIELDS, type ProblemField, type RenderedEmail } from '../merge/render.ts'
import type { Sender } from './useSender.ts'

export const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`)

/**
 * Estado del envío, compartido entre la tarjeta Send, la barra fija del teléfono y el
 * diálogo de confirmación. Vive en App para sobrevivir al cambiar entre lista y vista previa.
 */
export function useSendControls(emails: RenderedEmail[], sender: Sender) {
  const google = useGoogle()
  // null = aún no editado: se usa el correo de la cuenta conectada.
  const [testAddress, setTestAddress] = useState<string | null>(null)
  const testTo = testAddress ?? google.email ?? ''
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

  return {
    sender,
    signedIn: google.signedIn,
    account: google.email,
    emails,
    testTo,
    setTestAddress,
    testing,
    sendTest,
    canTest: google.signedIn && testTo.includes('@') && Boolean(firstRenders) && !sender.running,
    confirming,
    setConfirming,
    confirmSend,
    sent,
    failed,
    pending,
    blocking,
    attachmentCount,
    canSend: google.signedIn && blocking === 0,
    sendLabel:
      sent.length === 0 ? `Send ${plural(pending.length, 'email', 'emails')}` : `Send remaining ${pending.length}`,
  }
}

export type SendControls = ReturnType<typeof useSendControls>
