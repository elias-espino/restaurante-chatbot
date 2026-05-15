import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { PencilLine, Bike, X, MapPin, Printer } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

const STATUS_FLOW = {
  CONFIRMED:        { label: 'Confirmada',   color: 'bg-blue-100 text-blue-800',    next: 'PREPARING',  nextLabel: '👨‍🍳 Preparando' },
  PREPARING:        { label: 'Preparando',   color: 'bg-orange-100 text-orange-800', next: 'READY',      nextLabel: '✅ Lista' },
  READY:            { label: 'Lista',        color: 'bg-green-100 text-green-800',   next: 'DELIVERED',  nextLabel: '🚀 Entregada' },
  OUT_FOR_DELIVERY: { label: 'En camino 🛵', color: 'bg-indigo-100 text-indigo-700', next: null },
  DELIVERED:        { label: 'Entregada',    color: 'bg-gray-100 text-gray-600',     next: null },
  CANCELLED:        { label: 'Cancelada',    color: 'bg-red-100 text-red-600',       next: null },
  PENDING:          { label: 'Pendiente',    color: 'bg-yellow-100 text-yellow-800', next: 'CONFIRMED',  nextLabel: '✅ Confirmar' },
}

const SERVICE_LABELS = { TAKEAWAY: '🥡 Pasar a recoger', DELIVERY: '🚴 A domicilio' }

// ── Modal de asignación de rider (se abre al marcar DELIVERY como Lista) ──
function AssignRiderModal({ order, onClose, onAssigned }) {
  const [riders, setRiders] = useState([])
  const [selectedRider, setSelectedRider] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/delivery/riders')
      .then(r => setRiders(r.data.data.filter(r => r.isActive && r.isAvailable)))
      .catch(() => toast.error('Error al cargar riders'))
      .finally(() => setLoading(false))
  }, [])

  const assign = async () => {
    if (!selectedRider) { toast.error('Selecciona un rider'); return }
    setSaving(true)
    try {
      const { data } = await api.post(`/delivery/orders/${order.id}/assign`, { riderId: selectedRider })
      toast.success(`Rider asignado · Código cliente: ${data.data.deliveryCode}`)
      onAssigned(data.data)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al asignar rider')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Bike size={18} className="text-indigo-600" /> Asignar Rider
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-1">
          Orden <span className="font-semibold text-gray-800">#{order.orderNumber}</span> · {order.customerName || order.customerPhone}
        </p>
        <p className="text-xs text-indigo-600 mb-3">✅ Ya marcada como Lista</p>

        {order.deliveryAddress && (
          <div className="flex items-start gap-1.5 bg-gray-50 rounded-xl px-3 py-2 mb-4">
            <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-600">{order.deliveryAddress}</p>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-4">Cargando riders…</p>
        ) : riders.length === 0 ? (
          <div className="text-center py-3 mb-4">
            <p className="text-sm text-orange-500">No hay riders disponibles ahora.</p>
            <p className="text-xs text-gray-400 mt-1">Puedes asignar uno después desde la sección Delivery.</p>
          </div>
        ) : (
          <select
            value={selectedRider}
            onChange={e => setSelectedRider(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Seleccionar rider…</option>
            {riders.map(r => (
              <option key={r.id} value={r.id}>{r.name}{r.phone ? ` · ${r.phone}` : ''}</option>
            ))}
          </select>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Ahora no
          </button>
          {riders.length > 0 && (
            <button
              onClick={assign}
              disabled={saving || !selectedRider}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Asignando…' : 'Asignar 🛵'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────
export default function OrdersPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
  const [modifyingOrders, setModifyingOrders] = useState(new Set())
  const [assigningOrder, setAssigningOrder] = useState(null) // orden que espera asignación de rider

  const { data, isLoading } = useQuery({
    queryKey: ['orders', statusFilter, dateFilter],
    queryFn: () => api.get('/orders', { params: { status: statusFilter || undefined, date: dateFilter } }).then(r => r.data.data),
    refetchInterval: 15000,
  })

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/orders/${id}/status`, { status }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Estado actualizado')
    },
    onError: () => toast.error('Error al actualizar'),
  })

  const { mutate: reprintKitchen, isPending: reprintingKitchen } = useMutation({
    mutationFn: (id) => api.post(`/print/orders/${id}/reprint/kitchen`),
    onSuccess: () => toast.success('Comanda enviada a impresora'),
    onError: () => toast.error('Error al reimprimir comanda'),
  })

  const { mutate: reprintCustomer, isPending: reprintingCustomer } = useMutation({
    mutationFn: (id) => api.post(`/print/orders/${id}/reprint/customer`),
    onSuccess: () => toast.success('Ticket enviado a impresora'),
    onError: () => toast.error('Error al reimprimir ticket'),
  })

  // Maneja click en el botón de avance de estado
  // Si la orden es DELIVERY y pasa a READY → abre modal de asignación de rider
  const handleNextStatus = (order, nextStatus) => {
    updateStatus({ id: order.id, status: nextStatus }, {
      onSuccess: () => {
        if (nextStatus === 'READY' && order.serviceType === 'DELIVERY') {
          // Pequeño delay para que el queryClient refresque la orden antes de abrir el modal
          setTimeout(() => setAssigningOrder({ ...order, status: 'READY' }), 300)
        }
      }
    })
  }

  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['orders'] })

    const onModifying = (e) => {
      const { orderId } = e.detail || {}
      if (!orderId) return
      setModifyingOrders(prev => new Set([...prev, orderId]))
    }
    const onUpdated = (e) => {
      const { orderId, id } = e.detail || {}
      const resolvedId = orderId || id
      if (resolvedId) setModifyingOrders(prev => { const n = new Set(prev); n.delete(resolvedId); return n })
      refresh()
    }

    window.addEventListener('order:new', refresh)
    window.addEventListener('order:updated', onUpdated)
    window.addEventListener('order:modifying', onModifying)
    return () => {
      window.removeEventListener('order:new', refresh)
      window.removeEventListener('order:updated', onUpdated)
      window.removeEventListener('order:modifying', onModifying)
    }
  }, [queryClient])

  const orders = data?.orders || []

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Órdenes</h1>
        <div className="flex gap-2">
          <input type="date" className="input flex-1 sm:flex-none sm:w-auto text-sm" value={dateFilter}
            onChange={e => setDateFilter(e.target.value)} />
          <select className="input flex-1 sm:flex-none sm:w-auto text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
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
            const isModifying = modifyingOrders.has(order.id)
            const isDelivery = order.serviceType === 'DELIVERY'
            return (
              <div key={order.id} className={`card p-4 transition-all ${isModifying ? 'ring-2 ring-amber-400' : ''}`}>
                {isModifying && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium mb-2 animate-pulse">
                    <PencilLine size={13} />
                    El cliente está modificando esta orden...
                  </div>
                )}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-gray-900">#{order.orderNumber}</span>
                      <span className={`badge ${st.color}`}>{st.label}</span>
                      <span className="text-xs text-gray-400">{SERVICE_LABELS[order.serviceType]}</span>
                      {order.table && <span className="text-xs text-gray-400">· Mesa {order.table.number}</span>}
                      {/* Indicador de rider asignado */}
                      {isDelivery && order.rider && (
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Bike size={10} /> {order.rider.name}
                          {order.deliveryCode && <span className="font-bold ml-1">· {order.deliveryCode}</span>}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      👤 {order.customerName || 'Sin nombre'} · 📱 {order.customerPhone}
                    </p>
                    {order.deliveryAddress && (
                      <p className="text-xs text-gray-400 mb-2">📍 {order.deliveryAddress}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {(order.items || []).map((item, i) => (
                        <span key={i} className="text-xs bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg flex flex-col leading-tight">
                          <span>{item.name} x{item.quantity}</span>
                          {item.notes && <span className="text-orange-500 font-medium">⚠ {item.notes}</span>}
                        </span>
                      ))}
                    </div>
                    {order.notes && <p className="text-xs text-gray-400 mt-1 italic">Nota: {order.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-gray-900">${Number(order.total).toFixed(2)}</p>
                    <p className="text-xs text-gray-400 mb-3">{format(new Date(order.createdAt), 'HH:mm')}</p>

                    {/* Botón de avance de estado */}
                    {st.next && (
                      <button
                        className="btn-primary text-xs py-1.5 px-3"
                        onClick={() => handleNextStatus(order, st.next)}
                      >
                        {/* Si es DELIVERY y el siguiente paso es READY, mostramos ícono de rider */}
                        {st.next === 'READY' && isDelivery ? '✅ Lista + Rider' : st.nextLabel}
                      </button>
                    )}

                    {/* Botón extra: asignar rider manualmente si ya está en READY y no tiene rider */}
                    {isDelivery && order.status === 'READY' && !order.riderId && (
                      <button
                        className="btn text-xs py-1 px-2 text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 mt-1 w-full justify-center"
                        onClick={() => setAssigningOrder(order)}
                      >
                        <Bike size={12} /> Asignar Rider
                      </button>
                    )}

                    {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && order.status !== 'OUT_FOR_DELIVERY' && (
                      <button className="btn text-xs py-1 px-2 text-red-500 hover:bg-red-50 block mt-1 w-full"
                        onClick={() => updateStatus({ id: order.id, status: 'CANCELLED' })}>
                        Cancelar
                      </button>
                    )}

                    {/* Botones de reimpresión */}
                    <div className="flex gap-1 mt-2">
                      <button
                        title="Reimprimir comanda (cocina)"
                        className="btn text-xs py-1 px-2 text-gray-500 hover:bg-gray-100 flex items-center gap-1 flex-1 justify-center"
                        onClick={() => reprintKitchen(order.id)}
                        disabled={reprintingKitchen}
                      >
                        <Printer size={11} /> Comanda
                      </button>
                      <button
                        title="Reimprimir ticket del cliente"
                        className="btn text-xs py-1 px-2 text-gray-500 hover:bg-gray-100 flex items-center gap-1 flex-1 justify-center"
                        onClick={() => reprintCustomer(order.id)}
                        disabled={reprintingCustomer}
                      >
                        <Printer size={11} /> Ticket
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de asignación de rider */}
      {assigningOrder && (
        <AssignRiderModal
          order={assigningOrder}
          onClose={() => setAssigningOrder(null)}
          onAssigned={() => {
            setAssigningOrder(null)
            queryClient.invalidateQueries({ queryKey: ['orders'] })
          }}
        />
      )}
    </div>
  )
}
