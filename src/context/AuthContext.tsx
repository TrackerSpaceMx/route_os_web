import type { ReactNode } from 'react'
import { createContext, useContext, useState, useEffect, useRef } from 'react'

const API = 'http://localhost:8084'
const VERIFY_INTERVAL_MS = 5 * 60 * 1000

interface AuthUser {
  username: string
  role: string
}

interface AuthContextType {
  token: string | null
  user: AuthUser | null
  ready: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('token')
  )
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [ready, setReady] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const verify = async (t: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API}/auth/verify/account`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      return res.ok
    } catch {
      return false
    }
  }

  const startInterval = (t: string) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(async () => {
      const valid = await verify(t)
      if (!valid) clearSession()
    }, VERIFY_INTERVAL_MS)
  }

  const clearSession = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  useEffect(() => {
    const stored = localStorage.getItem('token')
    if (!stored) {
      setReady(true)
      return
    }
    verify(stored).then((valid) => {
      if (valid) {
        setToken(stored)
        startInterval(stored)
      } else {
        clearSession()
      }
      setReady(true)
    })
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
    startInterval(newToken)
  }

  const logout = () => clearSession()

  if (!ready) return null

  return (
    <AuthContext.Provider value={{ token, user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}