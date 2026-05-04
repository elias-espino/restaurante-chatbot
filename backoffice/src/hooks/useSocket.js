import { create } from 'zustand'
import { io } from 'socket.io-client'
import toast from 'react-hot-toast'

let socket = null

export const useSocketStore = create((set, get) => ({
  connected: false,
  socket: null,

  connect: (restaurantId) => {
    if (socket?.connected || !restaurantId) return

    socket = io('/', { transports: ['websocket'], reconnection: true })

    socket.on('connect', () => {
      set({ connected: true, socket })
      socket.emit('join:restaurant', restaurantId)
    })

    socket.on('disconnect', () => set({ connected: false }))

    socket.on('order:new', (order) => {
      toast.success(`🛒 Nueva orden #${order.orderNumber}!`, { duration: 5000 })
      // Invalidar query de órdenes (se hace desde los componentes)
      window.dispatchEvent(new CustomEvent('order:new', { detail: order }))
    })

    socket.on('order:updated', (order) => {
      window.dispatchEvent(new CustomEvent('order:updated', { detail: order }))
    })

    socket.on('incidencia:new', (inc) => {
      window.dispatchEvent(new CustomEvent('incidencia:new', { detail: inc }))
    })

    socket.on('incidencia:updated', (inc) => {
      window.dispatchEvent(new CustomEvent('incidencia:updated', { detail: inc }))
    })
  },

  disconnect: () => {
    socket?.disconnect()
    set({ connected: false, socket: null })
  },
}))
