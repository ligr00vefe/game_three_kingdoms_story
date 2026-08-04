import { create } from 'zustand'

interface AuthState {
  user: { accountId: number; loginId: string; displayName: string } | null
  setUser: (user: AuthState['user']) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))
