import { api } from './client'

export interface AuthUser { accountId: number; loginId: string; displayName: string }

export async function login(loginId: string, password: string): Promise<AuthUser> {
  const { data } = await api.post<AuthUser>('/auth/login', { loginId, password })
  return data
}

export async function register(loginId: string, displayName: string, password: string): Promise<AuthUser> {
  const { data } = await api.post<AuthUser>('/auth/register', { loginId, displayName, password })
  return data
}

export async function me(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>('/auth/me')
  return data
}

export async function logout(): Promise<void> {
  await api.delete('/auth/logout')
}
