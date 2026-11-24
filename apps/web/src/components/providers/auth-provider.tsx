'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { User, Session } from '@vashundhara-foundation/shared'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  updateUser: (data: Partial<User>) => Promise<void>
}

interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
  tenantSlug?: string
}

type AuthContextType = AuthState & AuthActions

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false
  })

  const fetchSession = async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setState({
          user: data.user,
          session: data.session,
          isLoading: false,
          isAuthenticated: !!data.user
        })
      } else {
        setState({
          user: null,
          session: null,
          isLoading: false,
          isAuthenticated: false
        })
      }
    } catch {
      setState({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false
      })
    }
  }

  useEffect(() => {
    fetchSession()
  }, [])

  const login = async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }))
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    })

    if (!response.ok) {
      const error = await response.json()
      setState(prev => ({ ...prev, isLoading: false }))
      throw new Error(error.message || 'Login failed')
    }

    await fetchSession()
  }

  const register = async (data: RegisterData) => {
    setState(prev => ({ ...prev, isLoading: true }))
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.json()
      setState(prev => ({ ...prev, isLoading: false }))
      throw new Error(error.message || 'Registration failed')
    }

    await fetchSession()
  }

  const logout = async () => {
    setState(prev => ({ ...prev, isLoading: true }))
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    })
    setState({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false
    })
  }

  const refreshSession = async () => {
    await fetchSession()
  }

  const updateUser = async (data: Partial<User>) => {
    const response = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    })

    if (response.ok) {
      const updatedUser = await response.json()
      setState(prev => ({ ...prev, user: updatedUser }))
    }
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        refreshSession,
        updateUser
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function useUser() {
  const { user } = useAuth()
  return user
}

export function useSession() {
  const { session } = useAuth()
  return session
}

export function useIsAuthenticated() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated
}

export function useLogin() {
  const { login } = useAuth()
  return login
}

export function useLogout() {
  const { logout } = useAuth()
  return logout
}