import { useCallback, useEffect, useRef, useState } from 'react'
import { buildAttachment } from '../attachments/resolve.ts'
import { AuthError, SendLimitError, useGoogle } from '../google/index.ts'
import type { RenderedEmail } from '../merge/render.ts'
import { buildMessage, type MessageFields } from './mime.ts'

export type SendStatus =
  | { state: 'sending' }
  | { state: 'sent'; at: number }
  | { state: 'failed'; error: string }

export interface SendProgress {
  done: number
  total: number
}

/** Pausa mínima entre envíos: la cuota de la Gmail API permite unos 2,5 correos por segundo. */
const MIN_INTERVAL = 400
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Estado del envío por fila (índice del correo). Vive en memoria: se pierde al recargar,
 * y se reinicia con `reset()` al cambiar de planilla.
 */
export function useSender() {
  const google = useGoogle()
  const [statuses, setStatuses] = useState<Map<number, SendStatus>>(() => new Map())
  const [progress, setProgress] = useState<SendProgress | null>(null)
  /** Motivo por el que se detuvo un envío antes de terminar (sesión, límite diario o Stop). */
  const [stopReason, setStopReason] = useState<string | null>(null)
  const stopRequested = useRef(false)
  const running = progress !== null

  const setStatus = (index: number, status: SendStatus) =>
    setStatuses((current) => new Map(current).set(index, status))

  const sendMessage = google.sendMessage
  const deliver = useCallback(
    async (fields: MessageFields, email: RenderedEmail) => {
      // Los archivos ya están en el árbol: solo el envío necesita la sesión de Google.
      const message = buildMessage(fields, await Promise.all(email.attachments.map(buildAttachment)))
      await sendMessage(message)
    },
    [sendMessage],
  )

  /** Envía los correos que aún no se han enviado, de a uno. Sigue ante errores de un correo. */
  const sendAll = useCallback(
    async (emails: RenderedEmail[]) => {
      const pending = emails.filter((email) => statuses.get(email.index)?.state !== 'sent')
      if (pending.length === 0) return
      stopRequested.current = false
      setStopReason(null)
      setProgress({ done: 0, total: pending.length })

      for (const [i, email] of pending.entries()) {
        if (stopRequested.current) {
          setStopReason('Sending was stopped.')
          break
        }
        const started = Date.now()
        setStatus(email.index, { state: 'sending' })
        try {
          await deliver({ ...email, html: email.body }, email)
          setStatus(email.index, { state: 'sent', at: Date.now() })
        } catch (e) {
          const error = (e as Error).message
          setStatus(email.index, { state: 'failed', error })
          // Sin sesión o sin cuota no tiene sentido seguir: el resto queda pendiente.
          if (e instanceof AuthError || e instanceof SendLimitError) {
            setStopReason(error)
            break
          }
        }
        setProgress({ done: i + 1, total: pending.length })
        await sleep(Math.max(0, MIN_INTERVAL - (Date.now() - started)))
      }
      setProgress(null)
    },
    [statuses, deliver],
  )

  /** Envía el correo a una dirección de prueba: sin Cc ni Bcc, y con "[Test]" en el asunto. */
  const sendTest = useCallback(
    async (email: RenderedEmail, address: string) => {
      const fields: MessageFields = { to: address, cc: '', bcc: '', replyTo: email.replyTo, subject: `[Test] ${email.subject}`, html: email.body }
      await deliver(fields, email)
    },
    [deliver],
  )

  const stop = useCallback(() => {
    stopRequested.current = true
  }, [])

  const reset = useCallback(() => {
    setStatuses(new Map())
    setStopReason(null)
  }, [])

  // Advierte al cerrar o recargar la página en medio de un envío.
  useEffect(() => {
    if (!running) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [running])

  return { statuses, progress, running, stopReason, sendAll, sendTest, stop, reset }
}

export type Sender = ReturnType<typeof useSender>
