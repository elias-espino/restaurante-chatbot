import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import api from '../lib/api'
import toast from 'react-hot-toast'

const STATUS_FLOW = {
  CONFIRMED:  { label: 'Confirmada',  color: 'bg-blue-100 text-blue-800',   next: 'PREPARING', nextLabel: '👨‍🍳 Preparando' },
  PREPARING:  { label: 'Preparando',  color: 'bg-orange-100 text-orange-800', next: 'READY',    nextLabel: '✅ Lista' },
  READY:      { label: 'Lista',       color: 'bg-green-100 text-green-800',  next: 'DELIVERED', nextLabel: '🚀 Entregada' },
  DELIVERED:  { label: 'Entregada',   color: 'bg-gray-100 text-gray-600',    next: null },
  CANCELLED:  { label: 'Cancelada',   color: 'bg-red-100 text-red-600',      next: null },
  PENDING:    { label: 'Pendiente',   color: 'bg-yellow-100 text-yellow-800', next: 'CONFIRMED', nextLabel: '✅ Confirmar' },
}

const SERVICE_LABELS = { TAKEAWAY: '🥡 Pasar a recoger', DELIVERY: '🚴 A domicilio' }

export default function OrdersPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])

  const { data, isLoading } = useQuery({
    queryKey: ['orders', statusFilter, dateFilter],
    queryFn: () => api.get('/orders', { params: { status: statusFilter || undefined, date: dateFilter } }).then(r => r.data.data),
    refetchInterval: 15000,
  })

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Estado actualizado')
    },
    onError: () => toast.error('Error al actualizar'),
  })

  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['orders'] })
    window.addEventListener('order:new', refresh)
    window.addEventListener('order:updated', refresh)
    return () => { window.removeEventListener('order:new', refresh); window.removeEventListener('order:updated', refresh) }
  }, [queryClient])

  const orders = data?.orders || []

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Órdenes</h1>
        <div className="flex gap-2">
          <input type="date" className="input w-auto text-sm" value={dateFilter}
            onChange={e => setDateFilter(e.target.value)} />
          <select className="input w-auto text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_FLOW).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-center py-12">Cargando órdenes...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p>No hay órdenes para los filtros seleccionados</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {orders.map(order => {
            const st = STATUS_FLOW[order.status] || {}
            return (
              <div key={order.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">#{order.orderNumber}</span>
                      <span className={`badge ${st.color}`}>{st.label}</span>
                      <span className="text-xs text-gray-400">{SERVICE_LABELS[order.serviceType]}</span>
                      {order.table && <span className="text-xs text-gray-400">· Mesa {order.table.number}</span>}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      👤 {order.customerName || 'Sin nombre'} · 📱 {order.customerPhone}
                    </p>
                    {order.deliveryAddress && (
                      <p className="text-xs text-gray-400 mb-2">📍 {order.deliveryAddress}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {(order.items || []).map((item, i) => (
                        <span key={i} className="text-xs bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
                          {item.name} x{item.quantity}
                        </span>
                      ))}
                    </div>
                    {order.notes && <p className="text-xs text-gray-400 mt-1 italic">Nota: {order.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-gray-900">${Number(order.total).toFixed(2)}</p>
                    <p className="text-xs text-gray-400 mb-3">{format(new Date(order.createdAt), 'HH:mm')}</p>
                    {st.next && (
                      <button className="btn-primary text-xs py-1.5 px-3"
                        onClick={() => updateStatus({ id: order.id, status: st.next })}>
                        {st.nextLabel}
                      </button>
                    )}
                    {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
                      <button className="btn text-xs py-1 px-2 text-red-500 hover:bg-red-50 block mt-1 w-full"
                        onClick={() => updateStatus({ id: order.id, status: 'CANCELLED' })}>
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
