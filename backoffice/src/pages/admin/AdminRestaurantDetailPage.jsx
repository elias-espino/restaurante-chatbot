import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, KeyRound, ToggleLeft, ToggleRight, Bot } from 'lucide-react'
import adminApi from '../../lib/adminApi'
import toast from 'react-hot-toast'

export default function AdminRestaurantDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [resettingPwd, setResettingPwd] = useState(false)

  const { data: r, isLoading } = useQuery({
    queryKey: ['admin-restaurant', id],
    queryFn: () => adminApi.get(`/restaurants/${id}`).then(res => res.data.data),
  })

  const [form, setForm] = useState(null)
  const [aiForm, setAiForm] = useState(null)
  const [savingAi, setSavingAi] = useState(false)

  if (r && !form) {
    setForm({ name: r.name, slug: r.slug, address: r.address || '', phone: r.phone || '', currency: r.currency, timezone: r.timezone })
    setAiForm({ aiEnabled: r.aiEnabled || false, aiPersonality: r.aiPersonality || '' })
  }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await adminApi.put(`/restaurants/${id}`, form)
      toast.success('Datos actualizados')
      queryClient.invalidateQueries({ queryKey: ['admin-restaurant', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] })
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async () => {
    try {
      await adminApi.put(`/restaurants/${id}`, { isActive: !r.isActive })
      toast.success(r.isActive ? 'Cliente desactivado' : 'Cliente activado')
      queryClient.invalidateQueries({ queryKey: ['admin-restaurant', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    } catch {
      toast.error('Error al cambiar estado')
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setResettingPwd(true)
    try {
      await adminApi.post(`/restaurants/${id}/reset-password`, { newPassword })
      toast.success('Contraseña reseteada')
      setNewPassword('')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al resetear')
    } finally {
      setResettingPwd(false)
    }
  }

  if (isLoading || !form) return <div className="p-8 text-gray-400 text-sm">Cargando...</div>

  const admin = r.users?.find(u => u.role === 'ADMIN')

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/restaurants')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{r.name}</h1>
          <p className="text-sm text-gray-500 font-mono">{r.slug}</p>
        </div>
        <button
          onClick={handleToggleActive}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            r.isActive
              ? 'bg-red-50 text-red-600 hover:bg-red-100'
              : 'bg-green-50 text-green-600 hover:bg-green-100'
          }`}
        >
          {r.isActive ? <><ToggleRight size={16} /> Desactivar</> : <><ToggleLeft size={16} /> Activar</>}
        </button>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Órdenes', value: r._count?.orders },
          { label: 'Usuarios', value: r._count?.users },
          { label: 'Items menú', value: r._count?.menuItems },
          { label: 'Mesas', value: r._count?.tables },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{value ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Formulario de datos */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Datos del restaurante</h2>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre</label>
              <input className="input" value={form.name} onChange={set('name')} required />
            </div>
            <div>
              <label className="label">Slug <span className="text-gray-400 font-normal">(login)</span></label>
              <input className="input font-mono" value={form.slug} onChange={set('slug')} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Moneda</label>
              <select className="input" value={form.currency} onChange={set('currency')}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
                <option value="COP">COP</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={form.phone} onChange={set('phone')} />
            </div>
          </div>
          <div>
            <label className="label">Dirección</label>
            <input className="input" value={form.address} onChange={set('address')} />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-50">
              <Save size={15} /> {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>

      {/* WhatsApp info */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">WhatsApp</h2>
        </div>
        <div className="p-5 text-sm space-y-2">
          {r.whatsappConfig ? (
            <>
              <p><span className="text-gray-500">Número:</span> <span className="font-mono ml-2">{r.whatsappConfig.phoneNumber}</span></p>
              <p><span className="text-gray-500">Phone Number ID:</span> <span className="font-mono ml-2 text-xs">{r.whatsappConfig.phoneNumberId}</span></p>
              <p>
                <span className="text-gray-500">Estado:</span>
                <span className={`ml-2 font-medium ${r.whatsappConfig.isActive ? 'text-green-600' : 'text-red-400'}`}>
                  {r.whatsappConfig.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </p>
            </>
          ) : (
            <p className="text-gray-400">WhatsApp no configurado. El cliente lo hace desde su backoffice.</p>
          )}
        </div>
      </div>

      {/* Configuración IA */}
      {aiForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Bot size={16} className="text-purple-600" />
            <h2 className="font-semibold text-gray-900">Asistente IA</h2>
            <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${aiForm.aiEnabled ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
              {aiForm.aiEnabled ? 'Activada' : 'Desactivada'}
            </span>
          </div>
          <div className="p-5 space-y-4">
            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
              <span className="text-sm font-medium text-gray-900">Activar IA para este cliente</span>
              <div
                onClick={() => setAiForm(f => ({ ...f, aiEnabled: !f.aiEnabled }))}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${aiForm.aiEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${aiForm.aiEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </label>
            <div>
              <label className="label">Personalidad del asistente</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Ej: Sé amigable y usa emojis. Sugiere el plato del día cuando sea posible."
                value={aiForm.aiPersonality}
                onChange={e => setAiForm(f => ({ ...f, aiPersonality: e.target.value }))}
              />
            </div>
            <div className="flex justify-end">
              <button
                disabled={savingAi}
                onClick={async () => {
                  setSavingAi(true)
                  try {
                    await adminApi.put(`/restaurants/${id}`, aiForm)
                    toast.success('Configuración IA guardada')
                    queryClient.invalidateQueries({ queryKey: ['admin-restaurant', id] })
                    queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] })
                  } catch { toast.error('Error al guardar') }
                  finally { setSavingAi(false) }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                <Bot size={15} /> {savingAi ? 'Guardando...' : 'Guardar config IA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password admin */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Resetear contraseña del admin</h2>
          {admin && <p className="text-xs text-gray-400 mt-0.5">{admin.email}</p>}
        </div>
        <form onSubmit={handleResetPassword} className="p-5 flex gap-3">
          <input
            className="input flex-1"
            type="password"
            placeholder="Nueva contraseña (mín. 8 caracteres)"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
          <button type="submit" disabled={resettingPwd} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50 whitespace-nowrap">
            <KeyRound size={15} /> {resettingPwd ? 'Reseteando...' : 'Resetear'}
          </button>
        </form>
      </div>
    </div>
  )
}
