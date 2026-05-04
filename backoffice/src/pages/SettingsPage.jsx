import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Bot } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('general')
  const [generalForm, setGeneralForm] = useState({})
  const [waForm, setWaForm] = useState({})
  const [schedules, setSchedules] = useState([])
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'STAFF' })

  const { data: restaurant } = useQuery({
    queryKey: ['restaurant'],
    queryFn: () => api.get('/restaurant').then(r => r.data.data),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/restaurant/users').then(r => r.data.data),
  })

  useEffect(() => {
    if (restaurant) {
      setGeneralForm({ name: restaurant.name, address: restaurant.address || '', phone: restaurant.phone || '', currency: restaurant.currency, timezone: restaurant.timezone })
      setWaForm({
        phoneNumberId: restaurant.whatsappConfig?.phoneNumberId || '',
        phoneNumber: restaurant.whatsappConfig?.phoneNumber || '',
        accessToken: restaurant.whatsappConfig?.accessToken || '',
        webhookVerifyToken: restaurant.whatsappConfig?.webhookVerifyToken || '',
        businessAccountId: restaurant.whatsappConfig?.businessAccountId || '',
        welcomeMessage: restaurant.whatsappConfig?.welcomeMessage || '',
      })
      const base = DAYS.map((_, i) => ({ dayOfWeek: i, openTime: '08:00', closeTime: '22:00', isOpen: i !== 0 }))
      const merged = base.map(d => restaurant.schedules?.find(s => s.dayOfWeek === d.dayOfWeek) || d)
      setSchedules(merged)
    }
  }, [restaurant])

  const saveGeneral = useMutation({
    mutationFn: () => api.put('/restaurant', generalForm),
    onSuccess: () => { toast.success('Datos guardados'); queryClient.invalidateQueries({ queryKey: ['restaurant'] }) },
    onError: () => toast.error('Error al guardar'),
  })

  const saveWA = useMutation({
    mutationFn: () => api.put('/restaurant/whatsapp', waForm),
    onSuccess: () => { toast.success('Configuración WhatsApp guardada'); queryClient.invalidateQueries({ queryKey: ['restaurant'] }) },
    onError: () => toast.error('Error al guardar'),
  })

  const saveSchedules = useMutation({
    mutationFn: () => api.put('/restaurant/schedules', { schedules }),
    onSuccess: () => toast.success('Horarios guardados'),
    onError: () => toast.error('Error al guardar horarios'),
  })

  const createUser = useMutation({
    mutationFn: () => api.post('/restaurant/users', newUser),
    onSuccess: () => { toast.success('Usuario creado'); queryClient.invalidateQueries({ queryKey: ['users'] }); setNewUser({ name: '', email: '', password: '', role: 'STAFF' }) },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al crear usuario'),
  })

  const { data: aiConfig } = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => api.get('/restaurant/ai').then(r => r.data.data),
  })
  const [aiForm, setAiForm] = useState({ aiEnabled: false, aiPersonality: '' })
  useEffect(() => { if (aiConfig) setAiForm({ aiEnabled: aiConfig.aiEnabled, aiPersonality: aiConfig.aiPersonality || '' }) }, [aiConfig])

  const saveAi = useMutation({
    mutationFn: () => api.put('/restaurant/ai', aiForm),
    onSuccess: () => { toast.success('Configuración IA guardada'); queryClient.invalidateQueries({ queryKey: ['ai-config'] }) },
    onError: () => toast.error('Error al guardar'),
  })

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'horarios', label: 'Horarios' },
    { id: 'usuarios', label: 'Usuarios' },
    { id: 'ia', label: '✨ IA' },
  ]

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-primary text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* General */}
      {tab === 'general' && (
        <div className="card p-5 max-w-lg space-y-4">
          {[
            { key: 'name', label: 'Nombre del restaurante' },
            { key: 'address', label: 'Dirección' },
            { key: 'phone', label: 'Teléfono' },
          ].map(f => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <input className="input" value={generalForm[f.key] || ''} onChange={e => setGeneralForm(p => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Moneda</label>
              <select className="input" value={generalForm.currency || 'GTQ'} onChange={e => setGeneralForm(p => ({ ...p, currency: e.target.value }))}>
                <optgroup label="Centroamérica">
                  <option value="GTQ">GTQ — Quetzal (Guatemala)</option>
                  <option value="HNL">HNL — Lempira (Honduras)</option>
                  <option value="NIO">NIO — Córdoba (Nicaragua)</option>
                  <option value="CRC">CRC — Colón (Costa Rica)</option>
                  <option value="PAB">PAB — Balboa (Panamá)</option>
                  <option value="BZD">BZD — Dólar (Belice)</option>
                  <option value="USD">USD — Dólar (El Salvador / Panamá)</option>
                </optgroup>
                <optgroup label="Otras regiones">
                  <option value="MXN">MXN — Peso (México)</option>
                  <option value="COP">COP — Peso (Colombia)</option>
                  <option value="PEN">PEN — Sol (Perú)</option>
                  <option value="ARS">ARS — Peso (Argentina)</option>
                  <option value="CLP">CLP — Peso (Chile)</option>
                </optgroup>
              </select>
            </div>
            <div className="flex-1">
              <label className="label">Zona horaria</label>
              <select className="input" value={generalForm.timezone || ''} onChange={e => setGeneralForm(p => ({ ...p, timezone: e.target.value }))}>
                <optgroup label="Centroamérica">
                  <option value="America/Guatemala">Guatemala (Ciudad de Guatemala)</option>
                  <option value="America/El_Salvador">El Salvador (San Salvador)</option>
                  <option value="America/Tegucigalpa">Honduras (Tegucigalpa)</option>
                  <option value="America/Managua">Nicaragua (Managua)</option>
                  <option value="America/Costa_Rica">Costa Rica (San José)</option>
                  <option value="America/Panama">Panamá (Ciudad de Panamá)</option>
                  <option value="America/Belize">Belice (Ciudad de Belice)</option>
                </optgroup>
                <optgroup label="Otras regiones">
                  <option value="America/Mexico_City">México (Ciudad de México)</option>
                  <option value="America/Bogota">Colombia (Bogotá)</option>
                  <option value="America/Lima">Perú (Lima)</option>
                  <option value="America/Santiago">Chile (Santiago)</option>
                  <option value="America/Argentina/Buenos_Aires">Argentina (Buenos Aires)</option>
                </optgroup>
              </select>
            </div>
          </div>
          <button className="btn-primary" onClick={() => saveGeneral.mutate()}>Guardar cambios</button>
        </div>
      )}

      {/* WhatsApp */}
      {tab === 'whatsapp' && (
        <div className="card p-5 max-w-lg space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
            📱 Configura tu cuenta de <strong>WhatsApp Business Cloud API</strong> de Meta. Estos datos los obtienes desde el panel de <a href="https://developers.facebook.com" target="_blank" className="underline">Meta for Developers</a>.
          </div>
          {[
            { key: 'phoneNumberId', label: 'Phone Number ID' },
            { key: 'phoneNumber', label: 'Número WhatsApp (+52...)' },
            { key: 'businessAccountId', label: 'Business Account ID' },
            { key: 'webhookVerifyToken', label: 'Webhook Verify Token (inventa uno)' },
          ].map(f => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <input className="input" value={waForm[f.key] || ''} onChange={e => setWaForm(p => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label className="label">Access Token (permanente)</label>
            <textarea className="input font-mono text-xs" rows={3} value={waForm.accessToken || ''} onChange={e => setWaForm(p => ({ ...p, accessToken: e.target.value }))} />
          </div>
          <div>
            <label className="label">Mensaje de bienvenida</label>
            <textarea className="input" rows={2} value={waForm.welcomeMessage || ''} onChange={e => setWaForm(p => ({ ...p, welcomeMessage: e.target.value }))} />
          </div>
          <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-500">
            <strong>URL del Webhook:</strong> <code className="bg-white px-1 rounded">{window.location.origin.replace('5173', '3000')}/webhook</code>
          </div>
          <button className="btn-primary" onClick={() => saveWA.mutate()}>Guardar configuración</button>
        </div>
      )}

      {/* Horarios */}
      {tab === 'horarios' && (
        <div className="card p-5 max-w-lg space-y-3">
          {schedules.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <label className="flex items-center gap-2 w-28">
                <input type="checkbox" checked={s.isOpen} onChange={e => setSchedules(prev => prev.map((d, j) => j === i ? { ...d, isOpen: e.target.checked } : d))} />
                <span className="text-sm font-medium text-gray-700">{DAYS[s.dayOfWeek]}</span>
              </label>
              <input type="time" className="input w-28 text-sm" disabled={!s.isOpen} value={s.openTime}
                onChange={e => setSchedules(prev => prev.map((d, j) => j === i ? { ...d, openTime: e.target.value } : d))} />
              <span className="text-gray-400 text-sm">—</span>
              <input type="time" className="input w-28 text-sm" disabled={!s.isOpen} value={s.closeTime}
                onChange={e => setSchedules(prev => prev.map((d, j) => j === i ? { ...d, closeTime: e.target.value } : d))} />
            </div>
          ))}
          <button className="btn-primary mt-2" onClick={() => saveSchedules.mutate()}>Guardar horarios</button>
        </div>
      )}

      {/* IA */}
      {tab === 'ia' && (
        <div className="card p-5 max-w-lg space-y-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-50 rounded-lg"><Bot size={20} className="text-purple-600" /></div>
            <div>
              <h2 className="font-semibold text-gray-900">Asistente con IA</h2>
              <p className="text-sm text-gray-500 mt-0.5">Cuando está activo, Gemini responde a tus clientes en lenguaje natural en lugar del bot con botones.</p>
            </div>
          </div>

          {/* Toggle */}
          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-900">Activar IA</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {aiForm.aiEnabled ? '✅ Los clientes hablan con Gemini' : '⚙️ Usando bot con botones (clásico)'}
              </p>
            </div>
            <div
              onClick={() => setAiForm(f => ({ ...f, aiEnabled: !f.aiEnabled }))}
              className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${aiForm.aiEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${aiForm.aiEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </div>
          </label>

          {/* Personalidad */}
          <div>
            <label className="label">Personalidad del asistente</label>
            <textarea
              className="input"
              rows={4}
              placeholder="Ej: Sé muy amigable, usa emojis y llama al cliente por su nombre. Sugiere el plato del día cuando sea posible."
              value={aiForm.aiPersonality}
              onChange={e => setAiForm(f => ({ ...f, aiPersonality: e.target.value }))}
            />
            <p className="text-xs text-gray-400 mt-1">Describe cómo quieres que el asistente hable con tus clientes. Si lo dejas vacío, usará un tono amigable por defecto.</p>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 space-y-1">
            <p>💡 <strong>El asistente ya conoce tu menú completo</strong> — no necesitas configurar nada más.</p>
            <p>💡 <strong>Modificación de órdenes:</strong> si el cliente escribe antes de que su orden pase a "Preparando", la IA puede modificarla automáticamente.</p>
          </div>

          <button className="btn-primary" onClick={() => saveAi.mutate()} disabled={saveAi.isPending}>
            {saveAi.isPending ? 'Guardando...' : 'Guardar configuración IA'}
          </button>
        </div>
      )}

      {/* Usuarios */}
      {tab === 'usuarios' && (
        <div className="space-y-4 max-w-lg">
          <div className="card p-5">
            <h2 className="font-semibold mb-3">Nuevo usuario</h2>
            <div className="space-y-3">
              {[{ key: 'name', label: 'Nombre', type: 'text' }, { key: 'email', label: 'Email', type: 'email' }, { key: 'password', label: 'Contraseña', type: 'password' }].map(f => (
                <div key={f.key}>
                  <label className="label">{f.label}</label>
                  <input className="input" type={f.type} value={newUser[f.key]} onChange={e => setNewUser(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="label">Rol</label>
                <select className="input" value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                  <option value="ADMIN">Admin — Acceso total</option>
                  <option value="STAFF">Staff — Solo órdenes</option>
                  <option value="VIEWER">Viewer — Solo reportes</option>
                </select>
              </div>
              <button className="btn-primary" onClick={() => createUser.mutate()}>Crear usuario</button>
            </div>
          </div>

          <div className="card divide-y divide-gray-50">
            {users.map(u => (
              <div key={u.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.name}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
                <span className={`badge text-xs ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : u.role === 'STAFF' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
