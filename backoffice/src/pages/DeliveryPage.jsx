import { useState, useEffect, useCallback } from 'react'
import {
  Bike, Plus, Trash2, RefreshCw, Phone, CheckCircle2,
  Clock, XCircle, UserCheck, UserX, Copy, AlertCircle,
  ChevronDown, ChevronUp, MapPin, User
} from 'lucide-react'
import api from '../lib/api'

// ── Helpers ──────────────────────────────────────────────────
const STATUS_LABEL = {
  PENDING:          { label: 'Pendiente',    color: 'bg-yellow-100 text-yellow-700' },
  CONFIRMED:        { label: 'Confirmada',   color: 'bg-blue-100 text-blue-700' },
  PREPARING:        { label: 'Preparando',   color: 'bg-orange-100 text-orange-700' },
  READY:            { label: 'Lista',        color: 'bg-purple-100 text-purple-700' },
  OUT_FOR_DELIVERY: { label: 'En camino 🛵', color: 'bg-indigo-100 text-indigo-700' },
  DELIVERED:        { label: 'Entregada ✅', color: 'bg-green-100 text-green-700' },
  CANCELLED:        { label: 'Cancelada',    color: 'bg-red-100 text-red-700' },
}

const ASSIGNABLE_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY']

function StatusBadge({ status }) {
  const s = STATUS_LABEL[status] || { label: status, color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  )
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
      title={`Copiar ${label}`}
    >
      {copied ? <CheckCircle2 size={12} className="text-green-500" /> : <Copy size={12} />}
      {copied ? '¡Copiado!' : text}
    </button>
  )
}

// ── Modal: Crear Rider ────────────────────────────────────────
function CreateRiderModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setErr('El nombre es requerido'); return }
    setLoading(true); setErr('')
    try {
      const { data } = await api.post('/delivery/riders', { name: name.trim(), phone: phone.trim() || undefined })
      onCreated(data.data)
    } catch (e) {
      setErr(e.response?.data?.message || 'Error al crear rider')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Nuevo Rider</h3>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del rider" autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={phone} onChange={e => setPhone(e.target.value)} placeholder="Opcional" type="tel"
            />
          </div>
          {err && <p className="text-sm text-red-500">{err}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
              {loading ? 'Creando…' : 'Crear Rider'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal: Asignar Rider ──────────────────────────────────────
function AssignRiderModal({ order, riders, onClose, onAssigned }) {
  const [selectedRider, setSelectedRider] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const availableRiders = riders.filter(r => r.isActive && (r.isAvailable || r.id === order.riderId))

  const submit = async (e) => {
    e.preventDefault()
    if (!selectedRider) { setErr('Selecciona un rider'); return }
    setLoading(true); setErr('')
    try {
      const { data } = await api.post(`/delivery/orders/${order.id}/assign`, { riderId: selectedRider })
      onAssigned(data.data, data.message)
    } catch (e) {
      setErr(e.response?.data?.message || 'Error al asignar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Asignar Rider</h3>
        <p className="text-sm text-gray-500 mb-4">Orden #{order.orderNumber} · {order.customerName || order.customerPhone}</p>
        {order.deliveryAddress && (
          <div className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-4">
            <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-600">{order.deliveryAddress}</p>
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rider *</label>
            {availableRiders.length === 0 ? (
              <p className="text-sm text-orange-500">No hay riders disponibles en este momento</p>
            ) : (
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={selectedRider} onChange={e => setSelectedRider(e.target.value)}
              >
                <option value="">Seleccionar rider…</option>
                {availableRiders.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.phone ? `(${r.phone})` : ''} {!r.isAvailable && r.id !== order.riderId ? '— ocupado' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          {err && <p className="text-sm text-red-500">{err}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading || availableRiders.length === 0} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
              {loading ? 'Asignando…' : 'Asignar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tarjeta de Rider ──────────────────────────────────────────
function RiderCard({ rider, onDelete, onToggle }) {
  const riderUrl = `${window.location.origin}/rider/${rider.riderCode}`
  return (
    <div className={`bg-white rounded-xl border p-4 ${rider.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
            rider.isAvailable && rider.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {rider.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{rider.name}</p>
            {rider.phone && (
              <a href={`tel:${rider.phone}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600">
                <Phone size={10} /> {rider.phone}
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onToggle(rider)} title={rider.isActive ? 'Desactivar' : 'Activar'}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            {rider.isActive ? <UserCheck size={15} className="text-green-500" /> : <UserX size={15} />}
          </button>
          <button onClick={() => onDelete(rider)} title="Eliminar"
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Estado</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            !rider.isActive ? 'bg-gray-100 text-gray-500' :
            rider.isAvailable ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
          }`}>
            {!rider.isActive ? 'Inactivo' : rider.isAvailable ? '🟢 Disponible' : '🟡 En entrega'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Código de acceso</span>
          <code className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold tracking-widest">
            {rider.riderCode.toUpperCase()}
          </code>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Entregas hoy</span>
          <span className="text-xs font-medium text-gray-700">{rider._count?.orders ?? 0}</span>
        </div>
        <div className="pt-1 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-1">Enlace del rider</p>
          <CopyButton text={riderUrl} label="enlace" />
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de Orden Delivery ─────────────────────────────────
function OrderCard({ order, riders, onAssign, onUnassign }) {
  const [expanded, setExpanded] = useState(false)
  const assignedRider = order.rider

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-gray-900 text-sm">#{order.orderNumber}</span>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-xs text-gray-600">{order.customerName || order.customerPhone}</p>
            {order.deliveryAddress && (
              <div className="flex items-start gap-1 mt-1">
                <MapPin size={11} className="text-gray-400 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-500 line-clamp-2">{order.deliveryAddress}</p>
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-gray-900 text-sm">${Number(order.total).toFixed(2)}</p>
            <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        {/* Rider asignado */}
        {assignedRider ? (
          <div className="mt-3 bg-indigo-50 rounded-lg p-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bike size={14} className="text-indigo-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-indigo-900">{assignedRider.name}</p>
                <p className="text-xs text-indigo-600">
                  Código cliente:&nbsp;
                  <span className="font-bold tracking-widest">{order.deliveryCode}</span>
                </p>
              </div>
            </div>
            {!['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].includes(order.status) && (
              <div className="flex gap-1">
                <button
                  onClick={() => onAssign(order)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                >
                  Cambiar
                </button>
                <span className="text-indigo-300">·</span>
                <button
                  onClick={() => onUnassign(order)}
                  className="text-xs text-red-500 hover:text-red-700 underline"
                >
                  Quitar
                </button>
              </div>
            )}
          </div>
        ) : (
          ASSIGNABLE_STATUSES.includes(order.status) && (
            <button
              onClick={() => onAssign(order)}
              className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg py-2 hover:bg-indigo-50 transition-colors"
            >
              <Bike size={14} /> Asignar Rider
            </button>
          )
        )}

        {/* Expandir items */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {order.items?.length} producto{order.items?.length !== 1 ? 's' : ''}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 space-y-1">
          {order.items?.map((item, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-600">
              <span>{item.quantity}x {item.name}</span>
              <span>${(Number(item.price) * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          {order.notes && (
            <p className="text-xs text-orange-600 pt-1">📝 {order.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function DeliveryPage() {
  const [tab, setTab] = useState('orders') // 'orders' | 'riders'
  const [riders, setRiders] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateRider, setShowCreateRider] = useState(false)
  const [assigningOrder, setAssigningOrder] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ridersRes, ordersRes] = await Promise.all([
        api.get('/delivery/riders'),
        api.get('/delivery/orders'),
      ])
      setRiders(ridersRes.data.data)
      setOrders(ordersRes.data.data)
    } catch (e) {
      showToast('Error al cargar datos', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Escuchar eventos WebSocket para actualizar en tiempo real
  useEffect(() => {
    const handler = (e) => {
      const updated = e.detail
      if (!updated) return
      setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o))
    }
    window.addEventListener('order:updated', handler)
    return () => window.removeEventListener('order:updated', handler)
  }, [])

  const handleDeleteRider = async (rider) => {
    if (!window.confirm(`¿Eliminar a ${rider.name}?`)) return
    try {
      await api.delete(`/delivery/riders/${rider.id}`)
      setRiders(prev => prev.filter(r => r.id !== rider.id))
      showToast('Rider eliminado')
    } catch (e) {
      showToast(e.response?.data?.message || 'Error al eliminar', 'error')
    }
  }

  const handleToggleRider = async (rider) => {
    try {
      const { data } = await api.patch(`/delivery/riders/${rider.id}`, { isActive: !rider.isActive })
      setRiders(prev => prev.map(r => r.id === rider.id ? data.data : r))
      showToast(`Rider ${data.data.isActive ? 'activado' : 'desactivado'}`)
    } catch (e) {
      showToast('Error al actualizar rider', 'error')
    }
  }

  const handleAssigned = (updatedOrder, message) => {
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o))
    setAssigningOrder(null)
    load() // recargar riders para actualizar isAvailable
    showToast(message || 'Rider asignado')
  }

  const handleUnassign = async (order) => {
    if (!window.confirm('¿Quitar el rider de esta orden?')) return
    try {
      const { data } = await api.post(`/delivery/orders/${order.id}/unassign`)
      setOrders(prev => prev.map(o => o.id === order.id ? data.data : o))
      load()
      showToast('Rider desasignado')
    } catch (e) {
      showToast(e.response?.data?.message || 'Error al desasignar', 'error')
    }
  }

  // ── Grupos de órdenes
  const pendingOrders = orders.filter(o => ASSIGNABLE_STATUSES.includes(o.status) && !o.riderId)
  const assignedOrders = orders.filter(o => o.riderId && o.status !== 'DELIVERED' && o.status !== 'CANCELLED')
  const completedOrders = orders.filter(o => o.status === 'DELIVERED')
  const availableRidersCount = riders.filter(r => r.isActive && r.isAvailable).length

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bike size={24} className="text-indigo-600" /> Delivery
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {availableRidersCount} rider{availableRidersCount !== 1 ? 's' : ''} disponible{availableRidersCount !== 1 ? 's' : ''} · {pendingOrders.length} sin asignar
          </p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Actualizar">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {[
          { key: 'orders', label: `Órdenes (${orders.length})` },
          { key: 'riders', label: `Riders (${riders.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Órdenes ── */}
      {tab === 'orders' && (
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Cargando órdenes…</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <Bike size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No hay órdenes de delivery hoy</p>
            </div>
          ) : (
            <>
              {/* Sin asignar */}
              {pendingOrders.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <AlertCircle size={14} className="text-orange-500" />
                    Sin rider ({pendingOrders.length})
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {pendingOrders.map(o => (
                      <OrderCard key={o.id} order={o} riders={riders}
                        onAssign={setAssigningOrder} onUnassign={handleUnassign} />
                    ))}
                  </div>
                </div>
              )}

              {/* En proceso */}
              {assignedOrders.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Bike size={14} className="text-indigo-500" />
                    En proceso ({assignedOrders.length})
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {assignedOrders.map(o => (
                      <OrderCard key={o.id} order={o} riders={riders}
                        onAssign={setAssigningOrder} onUnassign={handleUnassign} />
                    ))}
                  </div>
                </div>
              )}

              {/* Completadas */}
              {completedOrders.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-500" />
                    Entregadas hoy ({completedOrders.length})
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {completedOrders.map(o => (
                      <OrderCard key={o.id} order={o} riders={riders}
                        onAssign={setAssigningOrder} onUnassign={handleUnassign} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Tab: Riders ── */}
      {tab === 'riders' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Gestión de Riders</h2>
            <button
              onClick={() => setShowCreateRider(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} /> Nuevo Rider
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Cargando riders…</div>
          ) : riders.length === 0 ? (
            <div className="text-center py-12">
              <User size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No hay riders registrados</p>
              <button onClick={() => setShowCreateRider(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
                Crear primer rider
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {riders.map(rider => (
                <RiderCard key={rider.id} rider={rider}
                  onDelete={handleDeleteRider} onToggle={handleToggleRider} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {showCreateRider && (
        <CreateRiderModal
          onClose={() => setShowCreateRider(false)}
          onCreated={(r) => { setRiders(prev => [...prev, r]); setShowCreateRider(false); showToast(`Rider "${r.name}" creado. Código: ${r.riderCode.toUpperCase()}`) }}
        />
      )}
      {assigningOrder && (
        <AssignRiderModal
          order={assigningOrder} riders={riders}
          onClose={() => setAssigningOrder(null)} onAssigned={handleAssigned}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg text-white transition-all ${toast.type === 'error' ? 'bg-red-500' : 'bg-gray-900'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
