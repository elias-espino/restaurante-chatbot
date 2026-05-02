import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  restaurant: JSON.parse(localStorage.getItem('restaurant') || 'null'),
  isAuthenticated: !!localStorage.getItem('accessToken'),

  login: (data) => {
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    localStorage.setItem('user', JSON.stringify(data.user))
    localStorage.setItem('restaurant', JSON.stringify(data.restaurant))
    set({ user: data.user, restaurant: data.restaurant, isAuthenticated: true })
  },

  logout: () => {
    localStorage.clear()
    set({ user: null, restaurant: null, isAuthenticated: false })
  },
}))
