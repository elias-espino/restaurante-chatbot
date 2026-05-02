import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Pencil, Eye, EyeOff, Trash2, X } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

const ItemModal = ({ item, categories, onClose, onSave }) => {
  const [form, setForm] = useState(item || { categoryId: categories[0]?.id || '', name: '', description: '', price: '', isAvailable: true })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">{item?.id ? 'Editar Item' : 'Nuevo Item'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Categoría</label>
            <select className="input" value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} required>
              {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nombre</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input" rows={2} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="label">Precio</label>
            <input className="input" type="number" step="0.01" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isAvailable} onChange={e => setForm(f => ({ ...f, isAvailable: e.target.checked }))} className="rounded" />
            <span className="text-sm text-gray-700">Disponible en menú</span>
          </label>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : 'Guardar'}</button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const CategoryModal = ({ cat, onClose, onSave }) => {
  const [form, setForm] = useState(cat || { name: '', emoji: '🍽️', sortOrder: 0 })
  const [saving, setSaving] = useState(false)
  const handleSubmit = async (e) => { e.preventDefault(); setSaving(true); try { await onSave(form) } finally { setSaving(false) } }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">{cat?.id ? 'Editar Categoría' : 'Nueva Categoría'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="label">Emoji</label><input className="input" value={form.emoji || ''} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} placeholder="🍽️" /></div>
          <div><label className="label">Nombre</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
          <div><label className="label">Orden</label><input className="input" type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: +e.target.value }))} /></div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : 'Guardar'}</button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function MenuPage() {
  const queryClient = useQueryClient()
  const [itemModal, setItemModal] = useState(null)
  const [catModal, setCatModal] = useState(null)
  const [activeCategory, setActiveCategory] = useState(null)

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/menu/categories').then(r => r.data.data),
  })

  const { data: items = [] } = useQuery({
    queryKey: ['menu-items', activeCategory],
    queryFn: () => api.get('/menu/items', { params: activeCategory ? { categoryId: activeCategory } : {} }).then(r => r.data.data),
  })

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); queryClient.invalidateQueries({ queryKey: ['menu-items'] }) }

  const saveItem = useMutation({
    mutationFn: (form) => form.id ? api.put(`/menu/items/${form.id}`, form) : api.post('/menu/items', form),
    onSuccess: () => { toast.success('Item guardado'); setItemModal(null); invalidate() },
    onError: () => toast.error('Error al guardar'),
  })

  const toggleItem = useMutation({
    mutationFn: (id) => api.patch(`/menu/items/${id}/toggle`),
    onSuccess: () => { toast.success('Disponibilidad actualizada'); invalidate() },
  })

  const saveCat = useMutation({
    mutationFn: (form) => form.id ? api.put(`/menu/categories/${form.id}`, form) : api.post('/menu/categories', form),
    onSuccess: () => { toast.success('Categoría guardada'); setCatModal(null); invalidate() },
    onError: () => toast.error('Error al guardar'),
  })

  const filteredItems = activeCategory ? items.filter(i => i.categoryId === activeCategory) : items

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Menú</h1>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" onClick={() => setCatModal({})}>+ Categoría</button>
          <button className="btn-primary text-sm" onClick={() => setItemModal({})}>+ Item</button>
        </div>
      </div>

      {/* Categorías */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${!activeCategory ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >Todos</button>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
            onDoubleClick={() => setCatModal(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === cat.id ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >{cat.emoji} {cat.name} <span className="opacity-60 text-xs">({cat.items?.length || 0})</span></button>
        ))}
      </div>

      {/* Items */}
      <div className="grid gap-2">
        {filteredItems.map(item => (
          <div key={item.id} className={`card p-4 flex items-center gap-4 ${!item.isAvailable ? 'opacity-60' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm text-gray-900">{item.name}</p>
                {!item.isAvailable && <span className="badge bg-red-100 text-red-600 text-xs">No disponible</span>}
              </div>
              <p className="text-xs text-gray-400 truncate">{item.description}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.category?.emoji} {item.category?.name}</p>
            </div>
            <p className="font-bold text-gray-900">${Number(item.price).toFixed(2)}</p>
            <div className="flex gap-1">
              <button title={item.isAvailable ? 'Deshabilitar' : 'Habilitar'}
                onClick={() => toggleItem.mutate(item.id)}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 transition-colors">
                {item.isAvailable ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button onClick={() => setItemModal(item)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 transition-colors">
                <Pencil size={15} />
              </button>
            </div>
          </div>
        ))}
        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-3xl mb-2">🍽️</p>
            <p className="text-sm">No hay items en esta categoría</p>
            <button className="btn-primary mt-3 text-sm" onClick={() => setItemModal({})}>Agregar item</button>
          </div>
        )}
      </div>

      {itemModal !== null && <ItemModal item={itemModal?.id ? itemModal : null} categories={categories} onClose={() => setItemModal(null)} onSave={(f) => saveItem.mutateAsync(f)} />}
      {catModal !== null && <CategoryModal cat={catModal?.id ? catModal : null} onClose={() => setCatModal(null)} onSave={(f) => saveCat.mutateAsync(f)} />}
    </div>
  )
}
