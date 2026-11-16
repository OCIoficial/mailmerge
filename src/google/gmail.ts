import { AuthError } from './api.ts'

/** Límite de la Gmail API para un mensaje enviado por el endpoint de subida. */
export const MAX_MESSAGE_SIZE = 35 * 1024 * 1024

/** Un error que impide seguir enviando (límite diario de Gmail). */
export class SendLimitError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface GmailError {
  error?: { message?: string; errors?: { reason?: string }[] }
}

/**
 * Envía un mensaje ya armado (RFC 5322). Reintenta hasta 3 veces ante límites de frecuencia
 * y errores del servidor, esperando 1, 2 y 4 segundos.
 */
export async function sendRawMessage(token: string, message: Uint8Array): Promise<string> {
  if (message.length > MAX_MESSAGE_SIZE) {
    throw new Error(`The message is ${(message.length / 1024 / 1024).toFixed(1)} MB; Gmail allows up to 35 MB.`)
  }

  for (let attempt = 0; ; attempt++) {
    const response = await fetch('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'message/rfc822' },
      body: message as BlobPart,
    })
    if (response.ok) return ((await response.json()) as { id: string }).id
    if (response.status === 401) throw new AuthError('Your Google session expired. Sign in again.')

    const body = (await response.json().catch(() => ({}))) as GmailError
    const reason = body.error?.errors?.[0]?.reason ?? ''
    const message_ = body.error?.message ?? `Gmail error ${response.status}`
    if (reason === 'dailyLimitExceeded' || /daily.*limit/i.test(message_)) {
      throw new SendLimitError(`Gmail's daily sending limit was reached. Try again tomorrow. (${message_})`)
    }
    const retryable =
      response.status === 429 ||
      response.status >= 500 ||
      reason === 'rateLimitExceeded' ||
      reason === 'userRateLimitExceeded'
    if (!retryable || attempt >= 3) throw new Error(message_)
    await sleep(1000 * 2 ** attempt)
  }
}
