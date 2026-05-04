import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, CheckCircle2, Clock, MessageSquare, Send, X, Bot, User } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

// ─── Colores por estado ───────────────────────────────────
const STATUS_CONFIG = {
  OPEN:     { label: 'Abierta',    color: 'bg-red-100 text-red-700 border-red-200',     dot: 'bg-red-500',    icon: AlertTriangle },
  ANSWERED: { label: 'Respondida', color: 'bg-blue-100 text-blue-700 border-blue-200',  dot: 'bg-blue-500',   icon: MessageSquare },
  CLOSED:   { label: 'Cerrada',    color: 'bg-gray-100 text-gray-500 border-gray-200',  dot: 'bg-gray-400',   icon: CheckCircle2 },
}

// ─── Burbuja de mensaje ───────────────────────────────────
function MessageBubble({ msg }) {
  const isAI         = msg.role === 'ai'
  const isRestaurant = msg.role === 'restaurant'

  return (
    <div className={`flex gap-2 ${isRestaurant ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold
        ${isAI ? 'bg-violet-500' : 'bg-primary-600'}`}>
        {isAI ? <Bot size={14} /> : <User size={14} />}
      </div>

      {/* Burbuja */}
      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm
        ${isAI
          ? 'bg-violet-50 text-violet-900 rounded-tl-sm border border-violet-100'
          : 'bg-primary-600 text-white rounded-tr-sm'
        }`}>
        <p className="whitespace-pre-wrap">{msg.text}</p>
        <p className={`text-[10px] mt-1 ${isAI ? 'text-violet-400' : 'text-primary-200'}`}>
          {format(new Date(msg.timestamp), 'HH:mm')}
        </p>
      </div>
    </div>
  )
}

// ─── Panel de chat de una incidencia ─────────────────────
function IncidenciaChat({ inc, onClose, onUpdate }) {
  const [reply, setReply] = useState('')
  const endRef = useRef(null)
  const queryClient = useQueryClient()

  const messages = Array.isArray(inc.messages) ? inc.messages : []

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const { mutate: respond, isPending: sending } = useMutation({
    mutationFn: (text) => api.post(`/incidencias/${inc.id}/respond`, { text }).then(r => r.data.data),
    onSuccess: (updated) => {
      onUpdate(updated)
      setReply('')
      queryClient.invalidateQueries({ queryKey: ['incidencias'] })
      toast.success('Respuesta enviada')
    },
    onError: () => toast.error('Error al enviar respuesta'),
  })

  const { mutate: close, isPending: closing } = useMutation({
    mutationFn: () => api.patch(`/incidencias/${inc.id}/close`).then(r => r.data.data),
    onSuccess: (updated) => {
      onUpdate(updated)
      queryClient.invalidateQueries({ queryKey: ['incidencias'] })
      toast.success('Incidencia cerrada')
    },
    onError: () => toast.error('Error al cerrar'),
  })

  const handleSend = () => {
    if (!reply.trim()) return
    respond(reply.trim())
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const cfg = STATUS_CONFIG[inc.status] || STATUS_CONFIG.OPEN

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(inc.createdAt), { locale: es, addSuffix: true })}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">
            📱 {inc.phoneNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {inc.status !== 'CLOSED' && (
            <button
              onClick={() => close()}
              disabled={closing}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
            >
              <CheckCircle2 size={13} />
              {closing ? 'Cerrando…' : 'Cerrar'}
            </button>
          )}
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Sin mensajes aún
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={endRef} />
      </div>

      {/* Input de respuesta */}
      {inc.status !== 'CLOSED' ? (
        <div className="px-3 py-3 border-t border-gray-100 bg-gray-50">
          <div className="flex gap-2 items-end">
            <textarea
              rows={2}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu respuesta al cliente… (Enter para enviar)"
              className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
            <button
              onClick={handleSend}
              disabled={!reply.trim() || sending}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={15} />
              )}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 px-1">
            Tu respuesta será registrada. La IA puede usarla de contexto en próximas conversaciones.
          </p>
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-center">
          <span className="text-xs text-gray-400 flex items-center justify-center gap-1.5">
            <CheckCircle2 size={12} /> Incidencia cerrada el {format(new Date(inc.resolvedAt || inc.updatedAt), 'dd/MM/yyyy HH:mm')}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Tarjeta de incidencia en la lista ───────────────────
function IncidenciaCard({ inc, isSelected, onClick }) {
  const cfg = STATUS_CONFIG[inc.status] || STATUS_CONFIG.OPEN
  const messages = Array.isArray(inc.messages) ? inc.messages : []
  const lastMsg = messages[messages.length - 1]
  const CfgIcon = cfg.icon

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all ${
        isSelected
          ? 'border-primary-400 bg-primary-50 shadow-sm'
          : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`flex-shrink-0 mt-0.5 p-1.5 rounded-lg ${inc.status === 'OPEN' ? 'bg-red-100' : inc.status === 'ANSWERED' ? 'bg-blue-100' : 'bg-gray-100'}`}>
          <CfgIcon size={14} className={inc.status === 'OPEN' ? 'text-red-500' : inc.status === 'ANSWERED' ? 'text-blue-500' : 'text-gray-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-800 truncate">📱 {inc.phoneNumber}</p>
            <span className="text-[10px] text-gray-400 flex-shrink-0">
              {formatDistanceToNow(new Date(inc.createdAt), { locale: es, addSuffix: true })}
            </span>
          </div>
          {lastMsg && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {lastMsg.role === 'ai' ? '🤖 ' : '👤 '}{lastMsg.text}
            </p>
          )}
          <span className={`inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${cfg.color}`}>
            <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── Página principal ─────────────────────────────────────
export default function IncidenciasPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [localIncidencias, setLocalIncidencias] = useState([])

  const { data, isLoading } = useQuery({
    queryKey: ['incidencias', statusFilter],
    queryFn: () => api.get('/incidencias', { params: { status: statusFilter || undefined } }).then(r => r.data.data),
    refetchInterval: 30000,
  })

  // Sincronizar data con localIncidencias (para actualizaciones en tiempo real)
  useEffect(() => {
    if (data) setLocalIncidencias(data)
  }, [data])

  // Escuchar eventos socket de tiempo real
  useEffect(() => {
    const onNew = (e) => {
      const inc = e.detail
      setLocalIncidencias(prev => {
        const exists = prev.find(i => i.id === inc.id)
        if (exists) return prev
        return [inc, ...prev]
      })
      toast('🚨 Nueva incidencia de la IA', { duration: 6000, icon: '⚠️' })
      queryClient.invalidateQueries({ queryKey: ['incidencias'] })
    }

    const onUpdated = (e) => {
      const inc = e.detail
      setLocalIncidencias(prev => prev.map(i => i.id === inc.id ? inc : i))
    }

    window.addEventListener('incidencia:new', onNew)
    window.addEventListener('incidencia:updated', onUpdated)
    return () => {
      window.removeEventListener('incidencia:new', onNew)
      window.removeEventListener('incidencia:updated', onUpdated)
    }
  }, [queryClient])

  const selectedInc = localIncidencias.find(i => i.id === selectedId)

  const handleUpdate = (updated) => {
    setLocalIncidencias(prev => prev.map(i => i.id === updated.id ? updated : i))
  }

  const openCount = localIncidencias.filter(i => i.status === 'OPEN').length

  return (
    <div className="flex h-full">
      {/* ── Columna izquierda: lista ── */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 flex flex-col bg-gray-50">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-500" />
            <h1 className="text-base font-bold text-gray-900">Incidencias</h1>
            {openCount > 0 && (
              <span className="ml-auto flex-shrink-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {openCount}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Preguntas de la IA que requieren atención humana</p>
        </div>

        {/* Filtros */}
        <div className="px-3 py-2.5 border-b border-gray-200 bg-white">
          <div className="flex gap-1.5">
            {[
              { value: '',         label: 'Todas' },
              { value: 'OPEN',     label: 'Abiertas' },
              { value: 'ANSWERED', label: 'Respondidas' },
              { value: 'CLOSED',   label: 'Cerradas' },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`flex-1 py-1 px-1.5 text-xs rounded-lg font-medium transition-colors ${
                  statusFilter === f.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {isLoading && (
            <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
              Cargando…
            </div>
          )}
          {!isLoading && localIncidencias.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 size={24} className="text-green-500" />
              </div>
              <p className="text-sm font-medium text-gray-700">¡Sin incidencias!</p>
              <p className="text-xs text-gray-400 mt-1">La IA está resolviendo todo sin problemas.</p>
            </div>
          )}
          {localIncidencias.map(inc => (
            <IncidenciaCard
              key={inc.id}
              inc={inc}
              isSelected={selectedId === inc.id}
              onClick={() => setSelectedId(inc.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Columna derecha: chat ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {selectedInc ? (
          <div className="flex-1 p-4 overflow-hidden">
            <IncidenciaChat
              key={selectedInc.id}
              inc={selectedInc}
              onClose={() => setSelectedId(null)}
              onUpdate={handleUpdate}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 text-gray-400">
            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-4">
              <MessageSquare size={28} className="text-orange-400" />
            </div>
            <p className="text-base font-semibold text-gray-600">Selecciona una incidencia</p>
            <p className="text-sm mt-1 max-w-xs">
              Cuando la IA no sepa responder algo, aparecerá aquí para que el equipo del restaurante pueda ayudar.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
