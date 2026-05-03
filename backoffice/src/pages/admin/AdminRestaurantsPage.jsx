import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ChevronRight, CheckCircle, XCircle } from 'lucide-react'
import adminApi from '../../lib/adminApi'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  name: '', slug: '', address: '', phone: '', currency: 'MXN', timezone: 'America/Mexico_City',
  adminName: '', adminEmail: '', adminPassword: '',
}

export default function AdminRestaurantsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ['admin-restaurants', search],
    queryFn: () => adminApi.get('/restaurants', { params: search ? { search } : {} }).then(r => r.data.data),
  })

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await adminApi.post('/restaurants', form)
      toast.success(`Cliente "${form.name}" creado`)
      queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      setShowModal(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al crear cliente')
    } finally {
      setSaving(false)
    }
  }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500">{restaurants.length} restaurante{restaurants.length !== 1 ? 's' : ''} registrado{restaurants.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-gray-900 text-white hover:bg-gray-700 transition-colors">
          <Plus size={16} /> Nuevo cliente
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Buscar por nombre, slug o teléfono..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : restaurants.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No hay clientes registrados</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Restaurante</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">WhatsApp</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Órdenes</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {restaurants.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/restaurants/${r.id}`)}>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{r.slug}</td>
                  <td className="px-4 py-3 text-gray-500">{r.whatsappConfig?.phoneNumber || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-500">{r._count?.orders ?? 0}</td>
                  <td className="px-4 py-3">
                    {r.isActive
                      ? <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle size={14} /> Activo</span>
                      : <span className="inline-flex items-center gap-1 text-red-400"><XCircle size={14} /> Inactivo</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-400"><ChevronRight size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal crear cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Nuevo cliente</h2>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Datos del restaurante</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Nombre del restaurante</label>
                  <input className="input" value={form.name} onChange={set('name')} required placeholder="La Taquería de Juan" />
                </div>
                <div>
                  <label className="label">Slug <span className="text-gray-400 font-normal">(para el login)</span></label>
                  <input className="input font-mono" value={form.slug} onChange={set('slug')} required placeholder="taqueria-juan" />
                </div>
                <div>
                  <label className="label">Moneda</label>
                  <select className="input" value={form.currency} onChange={set('currency')}>
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                    <option value="COP">COP</option>
                    <option value="ARS">ARS</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Dirección</label>
                  <input className="input" value={form.address} onChange={set('address')} placeholder="Calle Principal 123" />
                </div>
                <div className="col-span-2">
                  <label className="label">Teléfono</label>
                  <input className="input" value={form.phone} onChange={set('phone')} placeholder="+52 55 1234 5678" />
                </div>
              </div>

              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Usuario administrador</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Nombre</label>
                  <input className="input" value={form.adminName} onChange={set('adminName')} placeholder="Administrador" />
                </div>
                <div className="col-span-2">
                  <label className="label">Email</label>
                  <input className="input" type="email" value={form.adminEmail} onChange={set('adminEmail')} required placeholder="admin@restaurante.com" />
                </div>
                <div className="col-span-2">
                  <label className="label">Contraseña inicial</label>
                  <input className="input" type="password" value={form.adminPassword} onChange={set('adminPassword')} required minLength={8} placeholder="Mínimo 8 caracteres" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }} className="btn-secondary flex-1 justify-center">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-50">
                  {saving ? 'Creando...' : 'Crear cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
