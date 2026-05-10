import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ShoppingBag, UtensilsCrossed, BarChart3, Settings, LogOut, Wifi, WifiOff, AlertTriangle, Bike } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useSocketStore } from '../../hooks/useSocket'
import { useEffect, useState } from 'react'

const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/orders',       icon: ShoppingBag,     label: 'Órdenes' },
  { to: '/delivery',     icon: Bike,            label: 'Delivery' },
  { to: '/menu',         icon: UtensilsCrossed, label: 'Menú' },
  { to: '/reports',      icon: BarChart3,       label: 'Reportes' },
  { to: '/incidencias',  icon: AlertTriangle,   label: 'Incidencias', badge: true },
  { to: '/settings',     icon: Settings,        label: 'Config' },
]

export default function Layout() {
  const { user, restaurant, logout } = useAuthStore()
  const navigate = useNavigate()
  const { connected, connect } = useSocketStore()
  const [openIncidencias, setOpenIncidencias] = useState(0)

  useEffect(() => { connect(restaurant?.id) }, [restaurant?.id])

  useEffect(() => {
    const onNew = () => setOpenIncidencias(n => n + 1)
    const onUpdated = (e) => {
      const inc = e.detail
      if (inc.status === 'CLOSED' || inc.status === 'ANSWERED') {
        setOpenIncidencias(n => Math.max(0, n - 1))
      }
    }
    window.addEventListener('incidencia:new', onNew)
    window.addEventListener('incidencia:updated', onUpdated)
    return () => {
      window.removeEventListener('incidencia:new', onNew)
      window.removeEventListener('incidencia:updated', onUpdated)
    }
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex h-screen bg-gray-50">

      {/* ── Sidebar — visible en md+ ── */}
      <aside className="hidden md:flex w-16 lg:w-60 bg-white border-r border-gray-200 flex-col shrink-0">
        {/* Logo */}
        <div className="p-3 lg:p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍽️</span>
            <div className="hidden lg:block">
              <p className="font-bold text-gray-900 text-sm leading-tight">{restaurant?.name}</p>
              <p className="text-xs text-gray-400">Backoffice</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 lg:p-3 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2.5 lg:px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <div className="relative shrink-0">
                <Icon size={18} />
                {badge && openIncidencias > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full lg:hidden">
                    {openIncidencias}
                  </span>
                )}
              </div>
              <span className="hidden lg:inline">{label}</span>
              {badge && openIncidencias > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none hidden lg:inline">
                  {openIncidencias}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-2 lg:p-3 border-t border-gray-100 space-y-1">
          <div className="flex items-center gap-2 px-2.5 lg:px-3 py-2">
            {connected
              ? <Wifi size={14} className="text-green-500 shrink-0" />
              : <WifiOff size={14} className="text-gray-300 shrink-0" />}
            <span className="text-xs text-gray-400 hidden lg:inline">{connected ? 'Tiempo real activo' : 'Sin conexión RT'}</span>
          </div>
          <div className="px-2.5 lg:px-3 py-2 hidden lg:block">
            <p className="text-xs font-medium text-gray-700">{user?.name}</p>
            <p className="text-xs text-gray-400">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-2.5 lg:px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={16} className="shrink-0" />
            <span className="hidden lg:inline">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* ── Bottom bar — solo en móvil (< md) ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex md:hidden z-50">
        {navItems.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-primary-600' : 'text-gray-400'
              }`
            }
          >
            <div className="relative">
              <Icon size={20} />
              {badge && openIncidencias > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                  {openIncidencias}
                </span>
              )}
            </div>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
