import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth.store'
import { useAdminAuthStore } from './store/adminAuth.store'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import OrdersPage from './pages/OrdersPage'
import MenuPage from './pages/MenuPage'
import TablesPage from './pages/TablesPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import IncidenciasPage from './pages/IncidenciasPage'
import DeliveryPage from './pages/DeliveryPage'
import RiderPage from './pages/RiderPage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminRestaurantsPage from './pages/admin/AdminRestaurantsPage'
import AdminRestaurantDetailPage from './pages/admin/AdminRestaurantDetailPage'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

const AdminRoute = ({ children }) => {
  const { isAuthenticated } = useAdminAuthStore()
  return isAuthenticated ? children : <Navigate to="/admin/login" replace />
}

export default function App() {
  return (
    <Routes>
      {/* Backoffice por restaurante */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="tables" element={<TablesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="incidencias" element={<IncidenciasPage />} />
        <Route path="delivery" element={<DeliveryPage />} />
      </Route>

      {/* Pantalla pública del rider — fuera del Layout protegido */}
      <Route path="/rider" element={<RiderPage />} />
      <Route path="/rider/:riderCode" element={<RiderPage />} />

      {/* Panel superadmin */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="restaurants" element={<AdminRestaurantsPage />} />
        <Route path="restaurants/:id" element={<AdminRestaurantDetailPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
