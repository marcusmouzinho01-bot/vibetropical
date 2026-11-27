import { useEffect, useState } from 'react'
import { Plus, Pencil, Power } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl } from '../brand'

type V = { id?: string; size_ml: string; price: string; stock_qty: string; min_qty: string; active: boolean }
type Draft = { id?: string; name: string; category: string; description: string; active: boolean; variants: V[] }
type Variant = { id: string; size_ml: number; price: number; stock_qty: number; min_qty: number; active: boolean }
type Product = { id: string; name: string; category: string | null; description: string | null; active: boolean; product_variants: Variant[] }

const num = (s: string) => Number(String(s).replace(',', '.'))
const blank: Draft = { name: '', category: '', description: '', active: true,
  variants: [{ size_ml: '', price: '', stock_qty: '0', min_qty: '0', active: true }] }
const field = 'w-full rounded-2xl border border-deep/20 bg-white px-4 py-3 text-base'

export default function Produtos() {
  const [items, setItems] = useState<Product[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false)

  const load = () => supabase.from('products').select('id,name,category,description,active,product_variants(id,size_ml,price,stock_qty,min_qty,active)').order('name')
    .then(({ data, error }) => {
      if (error) return setMsg('Não foi possível carregar os produtos.')
      setItems((data as unknown as Product[]).map(p => ({ ...p, product_variants: p.product_variants.map(v => ({ ...v, price: Number(v.price) })).sort((a, b) => a.size_ml - b.size_ml) })))
    })
  useEffect(() => { load() }, [])

  const edit = (p: Product) => { setMsg(''); setDraft({ id: p.id, name: p.name, category: p.category ?? '', description: p.description ?? '', active: p.active,
    variants: p.product_variants.map(v => ({ id: v.id, size_ml: String(v.size_ml), price: String(v.price), stock_qty: String(v.stock_qty), min_qty: String(v.min_qty), active: v.active })) }) }
  const setV = (i: number, patch: Partial<V>) => setDraft(d => d && ({ ...d, variants: d.variants.map((v, j) => j === i ? { ...v, ...patch } : v) }))

  async function save() {
    if (!draft) return
    const vs = draft.variants
    if (!draft.name.trim()) return setMsg('Informe o nome do produto.')
    const okInt = (s: string) => Number.isInteger(num(s)) && num(s) >= 0
    if (!vs.length || vs.some(v => !(num(v.size_ml) > 0) || v.price.trim() === '' || !(num(v.price) >= 0) || !okInt(v.stock_qty) || !okInt(v.min_qty)))
      return setMsg('Confira os tamanhos: informe ml, preço e quantidades válidos.')
    setBusy(true); setMsg('')
    const base = { name: draft.name.trim(), category: draft.category.trim() || null, description: draft.description.trim() || null, active: draft.active }
    const r = draft.id ? await supabase.from('products').update(base).eq('id', draft.id).select('id').single()
                       : await supabase.from('products').insert(base).select('id').single()
    if (r.error) { setBusy(false); return setMsg('Não foi possível salvar o produto. ' + r.error.message) }
    const pid = r.data.id as string
    const res = await Promise.all(vs.map(v => {
      const row = { product_id: pid, size_ml: num(v.size_ml), price: num(v.price), stock_qty: num(v.stock_qty), min_qty: num(v.min_qty), active: v.active }
      return v.id ? supabase.from('product_variants').update(row).eq('id', v.id) : supabase.from('product_variants').insert(row)
    }))
    setBusy(false)
    const bad = res.find(x => x.error)
    if (bad?.error) return setMsg('Não foi possível salvar os tamanhos. ' + bad.error.message)
    setDraft(null); load()
  }
  async function toggle(p: Product) {
    if (!confirm(p.active ? `Desativar "${p.name}"? Ele deixa de aparecer nas vendas.` : `Reativar "${p.name}"?`)) return
    const { error } = await supabase.from('products').update({ active: !p.active }).eq('id', p.id)
    if (error) setMsg('Não foi possível alterar o produto.'); else load()
  }

  if (draft) return (
    <div className="space-y-4">
      <h1 className="font-script text-5xl text-leaf">{draft.id ? 'Editar produto' : 'Novo produto'}</h1>
      <label className="block text-sm font-bold">Nome do produto<input className={field + ' mt-1'} placeholder="Ex.: Salada de frutas" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <label className="block text-sm font-bold">Categoria (opcional)<input className={field + ' mt-1'} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} /></label>
      <label className="block text-sm font-bold">Descrição (opcional)<textarea className={field + ' mt-1'} rows={2} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
      <h2 className="font-extrabold">Tamanho e preço</h2>
      {draft.variants.map((v, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 rounded-3xl bg-white p-4 ring-1 ring-deep/10 sm:grid-cols-4">
          {([['size_ml', 'Tamanho (ml)'], ['price', 'Preço (R$)'], ['stock_qty', 'Quantidade disponível'], ['min_qty', 'Quantidade mínima']] as const).map(([k, l]) => (
            <label key={k} className="text-xs font-bold">{l}<input inputMode="decimal" className={field + ' mt-1'} value={v[k]} onChange={e => setV(i, { [k]: e.target.value })} /></label>))}
          <label className="col-span-2 flex items-center gap-2 text-sm font-bold sm:col-span-4"><input type="checkbox" className="h-5 w-5" checked={v.active} onChange={e => setV(i, { active: e.target.checked })} />Tamanho ativo</label>
        </div>))}
      <button onClick={() => setDraft({ ...draft, variants: [...draft.variants, { size_ml: '', price: '', stock_qty: '0', min_qty: '0', active: true }] })} className="font-bold text-leaf">+ Adicionar outro tamanho deste produto</button>
      {msg && <p role="alert" className="rounded-2xl bg-red-50 p-3 font-semibold text-red-800">{msg}</p>}
      <div className="flex gap-3">
        <button onClick={save} disabled={busy} className="flex-1 rounded-2xl bg-leaf py-3.5 text-lg font-extrabold text-white disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar produto'}</button>
        <button onClick={() => { setDraft(null); setMsg('') }} className="rounded-2xl bg-cream px-6 font-bold">Cancelar</button>
      </div>
    </div>)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="font-script text-5xl text-leaf">Produtos</h1>
        <button onClick={() => { setMsg(''); setDraft(blank) }} className="flex items-center gap-2 rounded-2xl bg-sun px-4 py-3 font-extrabold"><Plus size={20} />Novo produto</button></div>
      {msg && <p role="alert" className="rounded-2xl bg-red-50 p-3 font-semibold text-red-800">{msg}</p>}
      {!items && !msg && <p>Carregando…</p>}
      {items?.length === 0 && <p className="rounded-3xl bg-white p-8 text-center text-deep/70">Nenhum produto ainda. Toque em "Novo produto" para cadastrar a salada de frutas e definir os preços de cada tamanho.</p>}
      {items?.map(p => (
        <div key={p.id} className={`rounded-3xl bg-white p-5 ring-1 ring-deep/10 ${p.active ? '' : 'opacity-60'}`}>
          <div className="flex items-start justify-between gap-2">
            <div><p className="text-lg font-extrabold">{p.name}{!p.active && <span className="ml-2 rounded-full bg-cream px-2 py-0.5 text-xs">Desativado</span>}</p>
              <p className="text-sm text-deep/70">{p.category}</p></div>
            <div className="flex gap-2">
              <button aria-label="Editar" onClick={() => edit(p)} className="rounded-xl bg-cream p-2.5"><Pencil size={18} /></button>
              <button aria-label={p.active ? 'Desativar' : 'Reativar'} onClick={() => toggle(p)} className="rounded-xl bg-cream p-2.5"><Power size={18} /></button></div></div>
          <div className="mt-3 flex flex-wrap gap-2">{p.product_variants.map(v => (
            <span key={v.id} className={`rounded-full px-3 py-1 text-sm font-bold ${!v.active ? 'bg-gray-100 line-through' : v.stock_qty <= v.min_qty ? 'bg-rose/40' : 'bg-leaf/10'}`}>
              {v.size_ml} ml · {brl(v.price)} · {v.stock_qty} un.</span>))}</div>
        </div>))}
    </div>)
}
