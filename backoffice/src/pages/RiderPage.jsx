// ============================================================
// PANTALLA DEL RIDER — Acceso por código hex
// Mobile-first: diseñada para uso en celular mientras se conduce
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react'
import { MapPin, Package, CheckCircle2, Bike, RefreshCw, LogOut, Clock, ChevronDown, ChevronUp, Navigation } from 'lucide-react'

const API_BASE = '/api'

// ── Utilidades ───────────────────────────────────────────────
const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.message || 'Error de servidor')
  return json.data
}

// ── Pantalla: Ingreso de código ───────────────────────────────
function CodeEntry({ onEnter }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const normalized = code.trim().toLowerCase()
    if (!normalized) { setErr('Ingresa tu código'); return }
    if (!/^[0-9a-f]{1,4}$/.test(normalized)) { setErr('Código inválido (letras a-f y números, máx 4 caracteres)'); return }
    setLoading(true); setErr('')
    try {
      const data = await apiFetch(`/rider/${normalized}`)
      localStorage.setItem('riderCode', normalized)
      onEnter(data, normalized)
    } catch (e) {
      setErr(e.message || 'Código no encontrado')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bike size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Portal Rider</h1>
          <p className="text-gray-400 text-sm mt-1">Ingresa tu código de acceso</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 4))}
              placeholder="ej: A3F2"
              maxLength={4}
              autoFocus
              autoCapitalize="characters"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-2xl px-5 py-5 text-3xl font-mono font-bold text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-600 placeholder:text-xl placeholder:tracking-normal uppercase"
            />
          </div>
          {err && (
            <p className="text-red-400 text-sm text-center">{err}</p>
          )}
          <button
            type="submit"
            disabled={loading || code.length === 0}
            className="w-full bg-indigo-600 text-white rounded-2xl py-4 text-lg font-bold hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Verificando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Pantalla: Sin orden activa ────────────────────────────────
function NoActiveOrder({ rider, onRefresh, loading, onLogout, history }) {
  const [showHistory, setShowHistory] = useState(false)
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 px-5 py-4 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-white text-lg">
            {rider.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-white text-sm">{rider.name}</p>
            <p className="text-xs text-gray-400">{rider.restaurant?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} disabled={loading}
            className="p-2 text-gray-400 hover:text-white rounded-xl transition-colors">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={onLogout} className="p-2 text-gray-500 hover:text-red-400 rounded-xl transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Sin orden */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-gray-800 rounded-3xl flex items-center justify-center mb-6">
          <Package size={44} className="text-gray-600" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Sin pedidos activos</h2>
        <p className="text-gray-500 text-sm mb-8">Cuando el administrador te asigne una orden, aparecerá aquí.</p>
        <button onClick={onRefresh} disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-gray-300 rounded-2xl font-medium hover:bg-gray-700 transition-colors">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Historial del día */}
      {history.length > 0 && (
        <div className="p-4 border-t border-gray-800">
          <button onClick={() => setShowHistory(!showHistory)} className="flex items-center justify-between w-full text-gray-400 text-sm font-medium">
            <span>Entregas de hoy ({history.length})</span>
            {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showHistory && (
            <div className="mt-3 space-y-2">
              {history.map((h, i) => (
                <div key={i} className="bg-gray-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">#{h.orderNumber}</p>
                    <p className="text-gray-400 text-xs">{h.customerName || ''} · {h.deliveryAddress?.slice(0, 30)}…</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 text-sm font-bold">${Number(h.total).toFixed(2)}</p>
                    <p className="text-gray-500 text-xs">{new Date(h.deliveryConfirmedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Pantalla: Orden activa ────────────────────────────────────
function ActiveOrder({ order, riderCode, onStatusUpdated, onLogout }) {
  const [step, setStep] = useState(order.status === 'OUT_FOR_DELIVERY' ? 'confirm' : 'ready') // 'ready' | 'confirm'
  const [confirmCode, setConfirmCode] = useState(['', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState(false)
  const inputsRef = useRef([])

  const handleStartDelivery = async () => {
    setLoading(true); setErr('')
    try {
      await apiFetch(`/rider/${riderCode}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: 'OUT_FOR_DELIVERY' }),
      })
      setStep('confirm')
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCodeInput = (index, value) => {
    if (!/^\d*$/.test(value)) return
    const newCode = [...confirmCode]
    newCode[index] = value.slice(-1)
    setConfirmCode(newCode)
    if (value && index < 3) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !confirmCode[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  const handleConfirm = async () => {
    const code = confirmCode.join('')
    if (code.length < 4) { setErr('Ingresa los 4 dígitos del código'); return }
    setLoading(true); setErr('')
    try {
      await apiFetch(`/rider/${riderCode}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
      setSuccess(true)
      setTimeout(() => onStatusUpdated(), 2500)
    } catch (e) {
      setErr(e.message)
      setConfirmCode(['', '', '', ''])
      inputsRef.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-28 h-28 bg-green-500 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <CheckCircle2 size={56} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">¡Entrega confirmada!</h2>
        <p className="text-gray-400">La orden #{order.orderNumber} fue entregada exitosamente.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 px-5 py-4 flex items-center justify-between border-b border-gray-800">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Pedido activo</p>
          <p className="font-bold text-white text-lg">#{order.orderNumber}</p>
        </div>
        <button onClick={onLogout} className="p-2 text-gray-500 hover:text-red-400 rounded-xl transition-colors">
          <LogOut size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-4">

        {/* Cliente */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Cliente</p>
          <p className="text-white font-semibold text-lg">{order.customerName || 'Cliente'}</p>
          {order.deliveryAddress && (
            <div className="flex items-start gap-2 mt-2">
              <MapPin size={16} className="text-indigo-400 mt-0.5 shrink-0" />
              <p className="text-gray-300 text-sm leading-relaxed">{order.deliveryAddress}</p>
            </div>
          )}
          {order.deliveryLatitude && order.deliveryLongitude && (
            <a
              href={`https://maps.google.com/?q=${order.deliveryLatitude},${order.deliveryLongitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 mt-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl px-4 py-3 text-sm font-bold transition-colors"
            >
              <Navigation size={16} />
              Abrir en Google Maps 🗺️
            </a>
          )}
        </div>

        {/* Productos */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Productos</p>
          <div className="space-y-2">
            {order.items?.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-white text-sm">{item.quantity}× {item.name}</span>
                {item.notes && <span className="text-xs text-orange-400 ml-2">📝 {item.notes}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Estado actual */}
        <div className={`rounded-2xl p-4 ${step === 'confirm' ? 'bg-indigo-900/60 border border-indigo-700' : 'bg-gray-800'}`}>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2.5 h-2.5 rounded-full ${step === 'confirm' ? 'bg-indigo-400 animate-pulse' : 'bg-purple-400'}`} />
            <p className="text-xs text-gray-400 uppercase tracking-wide">Estado</p>
          </div>
          <p className="text-white font-semibold">
            {step === 'confirm' ? '🛵 En camino al cliente' : '✅ Orden lista para llevar'}
          </p>
        </div>

        {/* Notas */}
        {order.notes && (
          <div className="bg-orange-900/30 border border-orange-800/50 rounded-2xl p-4">
            <p className="text-xs text-orange-400 uppercase tracking-wide mb-1">Notas</p>
            <p className="text-orange-200 text-sm">{order.notes}</p>
          </div>
        )}
      </div>

      {/* ── CTA principal ── */}
      <div className="p-5 border-t border-gray-800 bg-gray-950 space-y-3">
        {err && (
          <p className="text-red-400 text-sm text-center bg-red-900/20 rounded-xl py-2 px-3">{err}</p>
        )}

        {step === 'ready' && (
          <button
            onClick={handleStartDelivery}
            disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-2xl py-5 text-xl font-bold hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-3"
          >
            <Bike size={24} />
            {loading ? 'Actualizando…' : 'Salir a entregar 🛵'}
          </button>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div>
              <p className="text-center text-gray-400 text-sm mb-1">Pide el código de 4 dígitos al cliente</p>
              <p className="text-center text-gray-600 text-xs mb-3">El cliente lo recibió al hacer su pedido</p>
              {/* Inputs de código */}
              <div className="flex gap-3 justify-center">
                {confirmCode.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => inputsRef.current[i] = el}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleCodeInput(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    className="w-16 h-16 bg-gray-800 border-2 border-gray-700 focus:border-indigo-500 rounded-2xl text-white text-3xl font-bold text-center focus:outline-none transition-colors"
                  />
                ))}
              </div>
            </div>
            <button
              onClick={handleConfirm}
              disabled={loading || confirmCode.join('').length < 4}
              className="w-full bg-green-600 text-white rounded-2xl py-5 text-xl font-bold hover:bg-green-500 active:bg-green-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-3"
            >
              <CheckCircle2 size={24} />
              {loading ? 'Confirmando…' : 'Confirmar entrega ✅'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// COMPONENTE RAÍZ — Router interno del rider
// ════════════════════════════════════════════════════════════
export default function RiderPage() {
  const [riderCode, setRiderCode] = useState(null)
  const [riderData, setRiderData] = useState(null)
  const [loading, setLoading] = useState(false)
  const socketRef = useRef(null)

  // Al montar, verificar si hay código guardado
  useEffect(() => {
    const saved = localStorage.getItem('riderCode')
    if (saved) {
      setLoading(true)
      apiFetch(`/rider/${saved}`)
        .then(data => { setRiderCode(saved); setRiderData(data) })
        .catch(() => localStorage.removeItem('riderCode'))
        .finally(() => setLoading(false))
    }
  }, [])

  // Conectar WebSocket cuando hay riderCode — recibe órdenes en tiempo real
  useEffect(() => {
    if (!riderCode) return

    // Importar socket.io-client dinámicamente (ya está en el bundle del backoffice)
    const wsUrl = window.location.origin
    const script = document.createElement('script')
    script.src = '/socket.io/socket.io.js'
    script.onload = () => {
      const socket = window.io(wsUrl, { transports: ['websocket', 'polling'] })
      socketRef.current = socket

      socket.on('connect', () => {
        socket.emit('rider:join', { riderCode })
      })

      // El admin asignó una orden → actualizar pantalla inmediatamente
      socket.on('rider:order', (order) => {
        setRiderData(prev => prev ? { ...prev, activeOrder: order } : prev)
      })

      socket.on('disconnect', () => {
        // Intentar reconectar automáticamente (socket.io lo hace por defecto)
      })
    }
    document.head.appendChild(script)

    return () => {
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [riderCode])

  // Auto-refresh cada 30 segundos como fallback al WebSocket
  useEffect(() => {
    if (!riderCode) return
    const interval = setInterval(() => refresh(), 30000)
    return () => clearInterval(interval)
  }, [riderCode])

  const refresh = useCallback(async () => {
    if (!riderCode) return
    setLoading(true)
    try {
      const data = await apiFetch(`/rider/${riderCode}`)
      setRiderData(data)
    } catch {
      // Silencioso
    } finally {
      setLoading(false)
    }
  }, [riderCode])

  const handleEnter = (data, code) => {
    setRiderCode(code)
    setRiderData(data)
  }

  const handleLogout = () => {
    socketRef.current?.disconnect()
    socketRef.current = null
    localStorage.removeItem('riderCode')
    setRiderCode(null)
    setRiderData(null)
  }

  const handleStatusUpdated = () => {
    refresh()
  }

  if (loading && !riderData) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <RefreshCw size={32} className="text-indigo-400 animate-spin" />
      </div>
    )
  }

  if (!riderCode || !riderData) {
    return <CodeEntry onEnter={handleEnter} />
  }

  const { rider, activeOrder, history } = riderData

  if (!activeOrder) {
    return (
      <NoActiveOrder
        rider={rider}
        onRefresh={refresh}
        loading={loading}
        onLogout={handleLogout}
        history={history || []}
      />
    )
  }

  return (
    <ActiveOrder
      order={activeOrder}
      riderCode={riderCode}
      onStatusUpdated={handleStatusUpdated}
      onLogout={handleLogout}
    />
  )
}
