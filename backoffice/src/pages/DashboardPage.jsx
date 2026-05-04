import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { ShoppingBag, DollarSign, Clock, ChefHat } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/auth.store'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const STATUS_LABELS = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  PREPARING: { label: 'Preparando', color: 'bg-orange-100 text-orange-800' },
  READY: { label: 'Lista', color: 'bg-green-100 text-green-800' },
  DELIVERED: { label: 'Entregada', color: 'bg-gray-100 text-gray-600' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-600' },
}

const SERVICE_LABELS = { TAKEAWAY: '🥡 Pasar a recoger', DELIVERY: '🚴 A domicilio' }

const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <div className="card p-5">
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${color}`}><Icon size={20} className="text-white" /></div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  </div>
)

export default function DashboardPage() {
  const { restaurant } = useAuthStore()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/orders/dashboard').then(r => r.data.data),
    refetchInterval: 30000,
  })

  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    window.addEventListener('order:new', refresh)
    window.addEventListener('order:updated', refresh)
    return () => { window.removeEventListener('order:new', refresh); window.removeEventListener('order:updated', refresh) }
  }, [queryClient])

  if (isLoading) return <div className="p-8 text-gray-400">Cargando...</div>

  const stats = data || {}

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">{format(new Date(), "EEEE d 'de' MMMM", { locale: es })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShoppingBag} label="Órdenes hoy" value={stats.totalToday || 0} color="bg-primary" />
        <StatCard icon={DollarSign} label="Ingresos hoy" value={`$${Number(stats.revenueToday || 0).toFixed(2)}`} color="bg-green-500" sub={restaurant?.currency} />
        <StatCard icon={Clock} label="En espera" value={stats.pendingOrders || 0} color="bg-orange-500" sub="Confirmadas" />
        <StatCard icon={ChefHat} label="Preparando" value={stats.preparingOrders || 0} color="bg-blue-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Órdenes recientes */}
        <div className="lg:col-span-2 card">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Órdenes Recientes</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {(stats.recentOrders || []).slice(0, 8).map(order => {
              const st = STATUS_LABELS[order.status] || {}
              return (
                <div key={order.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">#{order.orderNumber}</p>
                    <p className="text-xs text-gray-400">
                      {order.customerName} · {SERVICE_LABELS[order.serviceType]}
                      {order.table ? ` · Mesa ${order.table.number}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${st.color}`}>{st.label}</span>
                    <p className="text-sm font-semibold text-gray-900 mt-1">${Number(order.total).toFixed(2)}</p>
                  </div>
                </div>
              )
            })}
            {!stats.recentOrders?.length && (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">No hay órdenes hoy</div>
            )}
          </div>
        </div>

        {/* Top items */}
        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Top Platillos Hoy</h2>
          </div>
          <div className="p-4 space-y-3">
            {(stats.topItems || []).map((item, i) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="text-lg font-bold text-gray-200 w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                </div>
                <span className="badge bg-primary-50 text-primary-700">x{item._sum.quantity}</span>
              </div>
            ))}
            {!stats.topItems?.length && (
              <p className="text-sm text-gray-400 text-center py-4">Sin datos</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
