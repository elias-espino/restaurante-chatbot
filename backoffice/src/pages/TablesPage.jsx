import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

export default function TablesPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ number: '', capacity: 4 })

  const { data: tables = [] } = useQuery({
    queryKey: ['tables'],
    queryFn: () => api.get('/restaurant/tables').then(r => r.data.data),
  })

  const save = useMutation({
    mutationFn: (data) => api.post('/restaurant/tables', data),
    onSuccess: () => { toast.success('Mesa guardada'); queryClient.invalidateQueries({ queryKey: ['tables'] }); setForm({ number: '', capacity: 4 }) },
    onError: () => toast.error('Error al guardar mesa'),
  })

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Mesas</h1>

      {/* Agregar mesa */}
      <div className="card p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Agregar mesa</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="label">Número / Nombre</label>
            <input className="input" placeholder="1, 2, Terraza-1..." value={form.number}
              onChange={e => setForm(f => ({ ...f, number: e.target.value }))} />
          </div>
          <div className="w-32">
            <label className="label">Capacidad</label>
            <input className="input" type="number" min={1} value={form.capacity}
              onChange={e => setForm(f => ({ ...f, capacity: +e.target.value }))} />
          </div>
          <button className="btn-primary" onClick={() => save.mutate(form)} disabled={!form.number}>
            <Plus size={16} /> Agregar
          </button>
        </div>
      </div>

      {/* Grid de mesas */}
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
        {tables.filter(t => t.isActive).map(table => (
          <div key={table.id} className="card p-3 text-center">
            <p className="text-2xl font-bold text-primary-600">{table.number}</p>
            <p className="text-xs text-gray-400 mt-0.5">{table.capacity} personas</p>
          </div>
        ))}
        {tables.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-400 text-sm">No hay mesas configuradas</div>
        )}
      </div>
    </div>
  )
}
