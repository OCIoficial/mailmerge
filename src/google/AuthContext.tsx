import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AuthError, getUserEmail } from './api.ts'
import { requestAccessToken, revokeAccessToken, type AccessToken } from './auth.ts'

interface AuthState {
  /** Token vigente, o null si no hay sesión o expiró. Vive solo en memoria. */
  token: string | null
  email: string | null
  connecting: boolean
  error: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  /** Ejecuta una llamada a Google; si el token expiró, cierra la sesión local. */
  run: <T>(call: (token: string) => Promise<T>) => Promise<T>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
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

  const run = useCallback(
    async <T,>(call: (token: string) => Promise<T>): Promise<T> => {
      if (!token || token.expiresAt <= Date.now()) {
        setToken(null)
        throw new AuthError('Your Google session expired. Connect again.')
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

  const value = useMemo(
    () => ({ token: token?.value ?? null, email, connecting, error, signIn, signOut, run }),
    [token, email, connecting, error, signIn, signOut, run],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
