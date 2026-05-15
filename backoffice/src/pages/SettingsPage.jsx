import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Bot, Printer, Wifi, WifiOff, Copy, RefreshCw, Trash2, Plus, Bike, MapPin } from 'lucide-react'
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

  // ── Delivery config ─────────────────────────────────────────
  const { data: deliveryConfig } = useQuery({
    queryKey: ['delivery-config'],
    queryFn: () => api.get('/restaurant/delivery').then(r => r.data.data),
    enabled: tab === 'delivery',
  })
  const [deliveryForm, setDeliveryForm] = useState({ deliveryLocationEnabled: false })
  useEffect(() => { if (deliveryConfig) setDeliveryForm({ deliveryLocationEnabled: deliveryConfig.deliveryLocationEnabled }) }, [deliveryConfig])

  const saveAi = useMutation({
    mutationFn: () => api.put('/restaurant/ai', aiForm),
    onSuccess: () => { toast.success('Configuración IA guardada'); queryClient.invalidateQueries({ queryKey: ['ai-config'] }) },
    onError: () => toast.error('Error al guardar'),
  })

  const saveDelivery = useMutation({
    mutationFn: () => api.put('/restaurant/delivery', deliveryForm),
    onSuccess: () => { toast.success('Configuración Delivery guardada'); queryClient.invalidateQueries({ queryKey: ['delivery-config'] }) },
    onError: () => toast.error('Error al guardar'),
  })

  // ── Impresoras ──────────────────────────────────────────
  const [newPrinter, setNewPrinter] = useState({ name: '', type: 'NETWORK', host: '', port: '9100', paperWidth: '32' })
  const [showNewPrinter, setShowNewPrinter] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  const { data: printers = [], refetch: refetchPrinters } = useQuery({
    queryKey: ['printers'],
    queryFn: () => api.get('/print/printers').then(r => r.data.data),
    enabled: tab === 'impresoras',
  })

  const createPrinter = useMutation({
    mutationFn: () => api.post('/print/printers', {
      name: newPrinter.name,
      type: newPrinter.type,
      host: newPrinter.type === 'NETWORK' ? newPrinter.host : undefined,
      port: newPrinter.type === 'NETWORK' ? parseInt(newPrinter.port) : undefined,
    }),
    onSuccess: () => {
      toast.success('Impresora creada')
      queryClient.invalidateQueries({ queryKey: ['printers'] })
      setNewPrinter({ name: '', type: 'NETWORK', host: '', port: '9100', paperWidth: '32' })
      setShowNewPrinter(false)
    },
    onError: () => toast.error('Error al crear impresora'),
  })

  const flushPrinter = useMutation({
    mutationFn: (id) => api.post(`/print/printers/${id}/flush`),
    onSuccess: () => toast.success('Jobs reencolados'),
    onError: () => toast.error('Error al reencolar'),
  })

  const deletePrinter = useMutation({
    mutationFn: (id) => api.delete(`/print/printers/${id}`),
    onSuccess: () => {
      toast.success('Impresora eliminada')
      queryClient.invalidateQueries({ queryKey: ['printers'] })
    },
    onError: () => toast.error('Error al eliminar impresora'),
  })

  const { data: ticketConfig = {}, refetch: refetchTicketConfig } = useQuery({
    queryKey: ['ticketConfig'],
    queryFn: () => api.get('/restaurants/ticket').then(r => r.data.data),
    enabled: tab === 'impresoras',
  })
  const [customerTicketPrinterId, setCustomerTicketPrinterId] = useState('')
  // sincronizar cuando llegue el dato
  const ticketPrinterIdFromServer = ticketConfig?.customerTicketPrinterId ?? ''
  if (customerTicketPrinterId === '' && ticketPrinterIdFromServer !== '') {
    setCustomerTicketPrinterId(ticketPrinterIdFromServer)
  }

  const saveTicketConfig = useMutation({
    mutationFn: () => api.put('/restaurants/ticket', { customerTicketPrinterId: customerTicketPrinterId || null }),
    onSuccess: () => { toast.success('Configuración de ticket guardada'); refetchTicketConfig() },
    onError: () => toast.error('Error al guardar configuración de ticket'),
  })

  const copyToken = (token, id) => {
    navigator.clipboard.writeText(token).then(() => {
      setCopiedId(id)
      toast.success('Token copiado')
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'horarios', label: 'Horarios' },
    { id: 'usuarios', label: 'Usuarios' },
    { id: 'ia', label: '✨ IA' },
    { id: 'delivery', label: '🛵 Delivery' },
    { id: 'impresoras', label: '🖨️ Impresoras' },
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

      {/* Delivery */}
      {tab === 'delivery' && (
        <div className="card p-5 max-w-lg space-y-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg"><Bike size={20} className="text-indigo-600" /></div>
            <div>
              <h2 className="font-semibold text-gray-900">Configuración de Delivery</h2>
              <p className="text-sm text-gray-500 mt-0.5">Ajustes para el flujo de órdenes a domicilio.</p>
            </div>
          </div>

          {/* Toggle de ubicación */}
          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-indigo-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">Pedir ubicación al confirmar</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {deliveryForm.deliveryLocationEnabled
                    ? '✅ La IA solicitará la ubicación GPS del cliente vía WhatsApp'
                    : '⚙️ Solo se pide la dirección en texto'}
                </p>
              </div>
            </div>
            <div
              onClick={() => setDeliveryForm(f => ({ ...f, deliveryLocationEnabled: !f.deliveryLocationEnabled }))}
              className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${deliveryForm.deliveryLocationEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${deliveryForm.deliveryLocationEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </div>
          </label>

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 space-y-1">
            <p>💡 <strong>¿Cómo funciona?</strong> Después de que el cliente ingresa su dirección en texto, el bot le pedirá que comparta su ubicación usando el selector nativo de WhatsApp.</p>
            <p>💡 Las coordenadas GPS se muestran en la pantalla del rider como un enlace a Google Maps, facilitando la navegación.</p>
            <p>💡 Si el cliente no comparte su ubicación, el bot continúa con la dirección en texto sin bloquear el pedido.</p>
          </div>

          <button className="btn-primary" onClick={() => saveDelivery.mutate()} disabled={saveDelivery.isPending}>
            {saveDelivery.isPending ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      )}

      {/* Impresoras */}
      {tab === 'impresoras' && (
        <div className="space-y-5 max-w-2xl">

          {/* Info print-agent */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Printer size={15} /> ¿Cómo funciona?</p>
            <p>Cada impresora necesita un <strong>Print Agent</strong> corriendo en la computadora del restaurante. El agente se conecta al backend usando el <strong>Agent Token</strong> y recibe los tickets automáticamente cuando se confirma una orden.</p>
            <p className="text-xs text-amber-600 mt-1">Descarga: <code className="bg-white px-1 rounded">restaurant-chatbot/print-agent/</code> → copia el token → corre <code className="bg-white px-1 rounded">npm start</code></p>
          </div>

          {/* Lista de impresoras */}
          <div className="card divide-y divide-gray-100">
            <div className="px-5 py-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Impresoras registradas</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => refetchPrinters()} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                  <RefreshCw size={15} />
                </button>
                <button onClick={() => setShowNewPrinter(v => !v)} className="btn-primary flex items-center gap-1.5 text-sm py-1.5">
                  <Plus size={14} /> Nueva impresora
                </button>
              </div>
            </div>

            {/* Form nueva impresora */}
            {showNewPrinter && (
              <div className="px-5 py-4 bg-gray-50 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Agregar impresora</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Nombre</label>
                    <input className="input" placeholder="Cocina principal" value={newPrinter.name} onChange={e => setNewPrinter(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Tipo de conexión</label>
                    <select className="input" value={newPrinter.type} onChange={e => setNewPrinter(p => ({ ...p, type: e.target.value }))}>
                      <option value="SERIAL">Bluetooth (PT-210) — Windows</option>
                      <option value="NETWORK">Red (IP/WiFi)</option>
                      <option value="USB">USB</option>
                      <option value="SPOOLER">Cola de Windows (SPOOLER)</option>
                    </select>
                  </div>
                  {newPrinter.type === 'NETWORK' && (
                    <>
                      <div>
                        <label className="label">IP de la impresora</label>
                        <input className="input font-mono" placeholder="192.168.1.100" value={newPrinter.host} onChange={e => setNewPrinter(p => ({ ...p, host: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Puerto</label>
                        <input className="input font-mono" placeholder="9100" value={newPrinter.port} onChange={e => setNewPrinter(p => ({ ...p, port: e.target.value }))} />
                      </div>
                    </>
                  )}
                  {newPrinter.type === 'SERIAL' && (
                    <div className="col-span-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                      💡 El puerto COM (ej. COM5) se configura en el <strong>.env</strong> del Print Agent.<br />
                      Ejecuta <code className="bg-white px-1 rounded">npm run list-ports</code> en el agente para encontrar el puerto correcto.
                    </div>
                  )}
                  {newPrinter.type === 'SPOOLER' && (
                    <div className="col-span-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                      💡 El nombre de la impresora se configura en el <strong>.env</strong> del Print Agent como <code className="bg-white px-1 rounded">SPOOLER_PRINTER_NAME</code>.<br />
                      Ejecuta <code className="bg-white px-1 rounded">npm run list-ports</code> para ver las impresoras instaladas en Windows.
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <button className="btn-primary text-sm" onClick={() => createPrinter.mutate()} disabled={!newPrinter.name || createPrinter.isPending}>
                    {createPrinter.isPending ? 'Guardando...' : 'Guardar impresora'}
                  </button>
                  <button className="btn-secondary text-sm" onClick={() => setShowNewPrinter(false)}>Cancelar</button>
                </div>
              </div>
            )}

            {/* Listado */}
            {printers.length === 0 && !showNewPrinter && (
              <div className="px-5 py-10 text-center text-sm text-gray-400">
                <Printer size={32} className="mx-auto mb-2 opacity-30" />
                No hay impresoras configuradas. Agrega la primera.
              </div>
            )}

            {printers.map(p => (
              <div key={p.id} className="px-5 py-4 flex items-start gap-4">
                <div className="mt-0.5">
                  {p.isOnline
                    ? <Wifi size={18} className="text-green-500" />
                    : <WifiOff size={18} className="text-gray-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.isOnline ? 'Online' : 'Offline'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{p.type}</span>
                  </div>
                  {p.host && (
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">{p.host}:{p.port}</p>
                  )}

                  {/* Agent Token */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500 font-mono truncate">{p.agentToken || '—'}</span>
                      {p.agentToken && (
                        <button onClick={() => copyToken(p.agentToken, p.id)} className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors">
                          {copiedId === p.id ? <span className="text-xs text-green-600 font-medium">✓</span> : <Copy size={13} />}
                        </button>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">Agent Token</span>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => flushPrinter.mutate(p.id)}
                    title="Reencolar jobs pendientes"
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                    <RefreshCw size={15} />
                  </button>
                  <button
                    onClick={() => { if (window.confirm(`¿Eliminar la impresora "${p.name}"? Se borrarán también sus jobs pendientes.`)) deletePrinter.mutate(p.id) }}
                    title="Eliminar impresora"
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Ticket del cliente */}
          <div className="card p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Printer size={16} /> Ticket del cliente</h3>
              <p className="text-sm text-gray-500 mt-0.5">Se imprime automáticamente al confirmar una orden. Incluye todos los items con precios y datos del cliente.</p>
            </div>
            <div>
              <label className="label">Impresora para ticket del cliente</label>
              <select
                className="input"
                value={customerTicketPrinterId}
                onChange={e => setCustomerTicketPrinterId(e.target.value)}
              >
                <option value="">— Sin ticket de cliente —</option>
                {printers.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type}){p.isOnline ? '' : ' — Offline'}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Si no se selecciona una impresora, el ticket del cliente no se imprime.</p>
            </div>
            <button className="btn-primary text-sm" onClick={() => saveTicketConfig.mutate()} disabled={saveTicketConfig.isPending}>
              {saveTicketConfig.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          {/* Guía de configuración del agente */}
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Printer size={16} /> Configurar el Print Agent (Windows)</h3>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>Abre la carpeta <code className="bg-gray-100 px-1 rounded text-xs">restaurant-chatbot/print-agent/</code></li>
              <li>Copia <code className="bg-gray-100 px-1 rounded text-xs">.env.example</code> → <code className="bg-gray-100 px-1 rounded text-xs">.env</code></li>
              <li>Pega el <strong>Agent Token</strong> en <code className="bg-gray-100 px-1 rounded text-xs">AGENT_TOKEN</code></li>
              <li>Configura <code className="bg-gray-100 px-1 rounded text-xs">PRINTER_TYPE</code> y el puerto/IP según el tipo</li>
              <li>Corre <code className="bg-gray-100 px-1 rounded text-xs font-mono">npm install && npm start</code></li>
              <li>La impresora aparecerá como <strong>Online</strong> aquí en segundos</li>
            </ol>
            <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 space-y-1">
              <p>🖨️ <strong>PT-210 Bluetooth:</strong> empareja la impresora en Windows, busca el COMx en Administrador de dispositivos y pon <code className="bg-white px-1 rounded">PRINTER_TYPE=SERIAL</code> + <code className="bg-white px-1 rounded">SERIAL_PORT=COMx</code> en el .env.</p>
              <p>🔍 Ejecuta <code className="bg-white px-1 rounded">npm run list-ports</code> en el agente para ver los puertos COM disponibles.</p>
            </div>
          </div>
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
