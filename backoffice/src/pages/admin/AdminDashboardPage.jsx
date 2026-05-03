import { useQuery } from '@tanstack/react-query'
import { Store, CheckCircle, XCircle, ShoppingBag, DollarSign } from 'lucide-react'
import adminApi from '../../lib/adminApi'

const StatCard = ({ icon: Icon, label, value, color, iconColor }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={22} className={iconColor} />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
      </div>
    </div>
  </div>
)

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.get('/stats').then(r => r.data.data),
    refetchInterval: 60000,
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Visión global de todos los clientes</p>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm">Cargando estadísticas...</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Store}
            label="Total clientes"
            value={data?.totalRestaurants}
            color="bg-blue-50"
            iconColor="text-blue-600"
          />
          <StatCard
            icon={CheckCircle}
            label="Clientes activos"
            value={data?.activeRestaurants}
            color="bg-green-50"
            iconColor="text-green-600"
          />
          <StatCard
            icon={XCircle}
            label="Clientes inactivos"
            value={data?.inactiveRestaurants}
            color="bg-red-50"
            iconColor="text-red-500"
          />
          <StatCard
            icon={ShoppingBag}
            label="Órdenes hoy"
            value={data?.ordersToday}
            color="bg-purple-50"
            iconColor="text-purple-600"
          />
        </div>
      )}

      {data && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-1">
            <DollarSign size={18} className="text-green-600" />
            <p className="text-sm text-gray-500">Revenue total hoy (todos los clientes)</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            ${Number(data.revenueToday).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
        </div>
      )}
    </div>
  )
}
