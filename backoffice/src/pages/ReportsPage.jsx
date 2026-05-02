import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { format, subDays } from 'date-fns'
import api from '../lib/api'
import { useAuthStore } from '../store/auth.store'

export default function ReportsPage() {
  const { restaurant } = useAuthStore()
  const [range, setRange] = useState('7')
  const to = new Date().toISOString().split('T')[0]
  const from = subDays(new Date(), parseInt(range)).toISOString().split('T')[0]

  const { data, isLoading } = useQuery({
    queryKey: ['reports', from, to],
    queryFn: () => api.get('/orders/report', { params: { from, to } }).then(r => r.data.data),
  })

  const chartData = (data?.byDay || []).map(d => ({
    date: format(new Date(d.date + 'T00:00:00'), 'dd/MM'),
    Órdenes: d.orders,
    Ingresos: d.revenue,
  }))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <select className="input w-auto text-sm" value={range} onChange={e => setRange(e.target.value)}>
          <option value="7">Últimos 7 días</option>
          <option value="14">Últimos 14 días</option>
          <option value="30">Últimos 30 días</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Ingresos', value: `$${Number(data?.totalRevenue || 0).toFixed(2)}`, sub: restaurant?.currency },
          { label: 'Órdenes', value: data?.totalOrders || 0, sub: 'en el período' },
          { label: 'Ticket promedio', value: `$${Number(data?.averageTicket || 0).toFixed(2)}`, sub: 'por orden' },
        ].map(k => (
          <div key={k.label} className="card p-5">
            <p className="text-sm text-gray-400">{k.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{isLoading ? '—' : k.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Ingresos diarios</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="Ingresos" stroke="#7c3aed" fill="url(#colorIngresos)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Órdenes por día</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="Órdenes" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
