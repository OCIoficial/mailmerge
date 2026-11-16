import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { readArchive } from '../attachments/archive.ts'
import type { FileSource, SpreadsheetSource } from '../sources.ts'
import { AuthError, getSheetValues, getSpreadsheet, getUserEmail } from './api.ts'
import { requestAccessToken, revokeAccessToken, type AccessToken } from './auth.ts'
import { downloadDriveFile, getDriveFileSize, loadDriveTree } from './drive.ts'
import { sendRawMessage } from './gmail.ts'
import { pickArchive, pickFolder, pickSpreadsheet } from './picker.ts'

/**
 * Todo lo que la app usa de Google. El token nunca sale de aquí: los componentes piden
 * "elige una planilla" o "envía este mensaje", no llaman a las APIs.
 */
export interface Google {
  signedIn: boolean
  email: string | null
  connecting: boolean
  /** Error del último inicio de sesión. */
  error: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  spreadsheets: SpreadsheetSource
  driveFolder: FileSource
  driveArchive: FileSource
  /** Envía un mensaje ya armado (RFC 5322) desde la cuenta conectada. */
  sendMessage: (message: Uint8Array) => Promise<void>
}

const GoogleContext = createContext<Google | null>(null)

export function GoogleProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<AccessToken | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = useCallback(async () => {
    setConnecting(true)
    setError(null)
    try {
      const next = await requestAccessToken()
      setToken(next)
      setEmail(await getUserEmail(next.value))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setConnecting(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    if (token) await revokeAccessToken(token.value)
    setToken(null)
    setEmail(null)
  }, [token])

  /** Ejecuta una llamada a Google; si el token expiró, cierra la sesión local. */
  const run = useCallback(
    async <T,>(call: (token: string) => Promise<T>): Promise<T> => {
      if (!token || token.expiresAt <= Date.now()) {
        setToken(null)
        throw new AuthError('Your Google session expired. Sign in again.')
      }
      try {
        return await call(token.value)
      } catch (e) {
        if (e instanceof AuthError) setToken(null)
        throw e
      }
    },
    [token],
  )

  const value = useMemo((): Google => {
    const spreadsheets: SpreadsheetSource = {
      canReload: true,
      async pick() {
        const picked = await run(pickSpreadsheet)
        return picked && run((token) => getSpreadsheet(token, picked.id))
      },
      loadSheet: (spreadsheet, sheet) => run((token) => getSheetValues(token, spreadsheet.id, sheet)),
    }

    const driveFolder: FileSource = {
      async pick(onProgress) {
        const folder = await run(pickFolder)
        if (!folder) return null
        onProgress({ message: `Reading ${folder.name}…` })
        return run((token) =>
          loadDriveTree(token, folder, (progress) =>
            onProgress(
              progress.phase === 'listing'
                ? { message: `Reading ${folder.name}… ${progress.files} files found` }
                : { message: `Downloading ${folder.name}`, done: progress.done, total: progress.total, unit: 'files' },
            ),
          ),
        )
      },
    }

    const driveArchive: FileSource = {
      async pick(onProgress) {
        const file = await run(pickArchive)
        if (!file) return null
        const message = `Downloading ${file.name}`
        onProgress({ message })
        // El tamaño viene de los datos del archivo: no se depende de Content-Length en la descarga.
        const total = (await run((token) => getDriveFileSize(token, file.id))) ?? undefined
        const data = await run((token) =>
          downloadDriveFile(token, file.id, (done) => onProgress({ message, done, total, unit: 'bytes' })),
        )
        onProgress({ message: `Reading ${file.name}…` })
        return readArchive(file.name, data)
      },
    }

    return {
      signedIn: token !== null,
      email,
      connecting,
      error,
      signIn,
      signOut,
      spreadsheets,
      driveFolder,
      driveArchive,
      sendMessage: async (message) => {
        await run((token) => sendRawMessage(token, message))
      },
    }
  }, [token, email, connecting, error, signIn, signOut, run])

  return <GoogleContext.Provider value={value}>{children}</GoogleContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useGoogle(): Google {
  const context = useContext(GoogleContext)
  if (!context) throw new Error('useGoogle must be used inside GoogleProvider')
  return context
}
