import { create } from 'zustand'

export const useAdminAuthStore = create((set) => ({
  isAuthenticated: !!localStorage.getItem('adminToken'),

  login: (token) => {
    localStorage.setItem('adminToken', token)
    set({ isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('adminToken')
    set({ isAuthenticated: false })
  },
}))
