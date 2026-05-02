import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ShoppingBag, UtensilsCrossed, Table2, BarChart3, Settings, LogOut, Wifi, WifiOff } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useSocketStore } from '../../hooks/useSocket'
import { useEffect } from 'react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/orders', icon: ShoppingBag, label: 'Órdenes' },
  { to: '/menu', icon: UtensilsCrossed, label: 'Menú' },
  { to: '/tables', icon: Table2, label: 'Mesas' },
  { to: '/reports', icon: BarChart3, label: 'Reportes' },
  { to: '/settings', icon: Settings, label: 'Configuración' },
]

export default function Layout() {
  const { user, restaurant, logout } = useAuthStore()
  const navigate = useNavigate()
  const { connected, connect } = useSocketStore()

  useEffect(() => { connect(restaurant?.id) }, [restaurant?.id])

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍽️</span>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">{restaurant?.name}</p>
              <p className="text-xs text-gray-400">Backoffice</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100 space-y-1">
          <div className="flex items-center gap-2 px-3 py-2">
            {connected ? <Wifi size={14} className="text-green-500" /> : <WifiOff size={14} className="text-gray-300" />}
            <span className="text-xs text-gray-400">{connected ? 'Tiempo real activo' : 'Sin conexión RT'}</span>
          </div>
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-gray-700">{user?.name}</p>
            <p className="text-xs text-gray-400">{user?.role}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
