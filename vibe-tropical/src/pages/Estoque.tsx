import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type V = { id: string; size_ml: number; stock_qty: number; min_qty: number; name: string }
type Mov = { id: string; kind: string; quantity: number; note: string | null; created_at: string; product_variants: { size_ml: number; products: { name: string } } | null }
const KIND: Record<string, string> = { producao: 'Produção', perda: 'Perda', descarte: 'Descarte', venda: 'Venda', estorno: 'Estorno' }
const PLUS = ['producao', 'estorno']
const field = 'w-full rounded-2xl border border-deep/20 bg-white px-4 py-3 text-base'
const card = 'rounded-3xl bg-white p-5 ring-1 ring-deep/10'

export default function Estoque() {
  const [vs, setVs] = useState<V[] | null>(null)
  const [movs, setMovs] = useState<Mov[]>([])
  const [vid, setVid] = useState(''); const [kind, setKind] = useState('producao')
  const [qty, setQty] = useState(''); const [note, setNote] = useState('')
  const [filter, setFilter] = useState('todas')
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState(false)

  const load = () => {
    supabase.from('product_variants').select('id,size_ml,stock_qty,min_qty,products!inner(name)').eq('active', true).eq('products.active', true)
      .then(({ data, error }) => { if (error) return setMsg({ ok: false, t: 'Não foi possível carregar o estoque.' })
        setVs((data as any[]).map(r => ({ id: r.id, size_ml: r.size_ml, stock_qty: r.stock_qty, min_qty: r.min_qty, name: r.products.name })).sort((a, b) => a.name.localeCompare(b.name) || a.size_ml - b.size_ml)) })
    supabase.from('stock_movements').select('id,kind,quantity,note,created_at,product_variants(size_ml,products(name))').order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setMovs((data as any[]) ?? []))
  }
  useEffect(load, [])

  async function save() {
    if (busy) return
    const n = Number(qty)
    if (!vid) return setMsg({ ok: false, t: 'Escolha o produto.' })
    if (!Number.isInteger(n) || n <= 0) return setMsg({ ok: false, t: 'Informe uma quantidade inteira maior que zero.' })
    setBusy(true); setMsg(null)
    const { error } = await supabase.rpc('register_stock_movement', { p_variant: vid, p_kind: kind, p_qty: n, p_note: note })
    setBusy(false)
    if (error) return setMsg({ ok: false, t: error.message })
    setQty(''); setNote(''); setMsg({ ok: true, t: `${KIND[kind]} registrada!` }); load()
  }

  const low = (vs ?? []).filter(v => v.stock_qty <= v.min_qty)
  const shown = movs.filter(m => filter === 'todas' || m.kind === filter)
  return (
    <div className="space-y-4">
      <h1 className="font-script text-5xl text-leaf">Estoque</h1>
      {low.length > 0 && <div role="alert" className="rounded-2xl bg-rose/30 p-4 font-semibold">Estoque baixo: {low.map(v => `${v.name} ${v.size_ml} ml (${v.stock_qty})`).join(', ')}</div>}
      <section className={card + ' space-y-3'}>
        <h2 className="font-extrabold">Registrar movimentação</h2>
        <label className="block text-sm font-bold">Produto<select className={field + ' mt-1'} value={vid} onChange={e => setVid(e.target.value)}><option value="">Escolha…</option>{vs?.map(v => <option key={v.id} value={v.id}>{v.name} {v.size_ml} ml</option>)}</select></label>
        <div className="grid grid-cols-3 gap-2">{(['producao', 'perda', 'descarte'] as const).map(k => <button key={k} onClick={() => setKind(k)} className={`rounded-2xl py-3 font-bold ${kind === k ? 'bg-deep text-white' : 'bg-cream'}`}>{KIND[k]}</button>)}</div>
        <label className="block text-sm font-bold">{kind === 'producao' ? 'Quantidade produzida' : 'Quantidade'}<input inputMode="numeric" className={field + ' mt-1'} value={qty} onChange={e => setQty(e.target.value)} /></label>
        <input className={field} placeholder="Observação (opcional)" value={note} onChange={e => setNote(e.target.value)} />
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-2xl p-3 font-semibold ${msg.ok ? 'bg-leaf/10' : 'bg-red-50 text-red-800'}`}>{msg.t}</p>}
        <button onClick={save} disabled={busy} className="w-full rounded-2xl bg-leaf py-3.5 text-lg font-extrabold text-white disabled:opacity-40">{busy ? 'Registrando…' : 'Registrar'}</button>
      </section>
      <section className={card}><h2 className="mb-2 font-extrabold">Saladas prontas agora</h2>
        {vs?.length === 0 && <p className="text-deep/70">Cadastre produtos em Produtos para controlar o estoque.</p>}
        {vs?.map(v => <div key={v.id} className="flex justify-between py-1.5"><span>{v.name} {v.size_ml} ml</span><span className={`font-extrabold ${v.stock_qty <= v.min_qty ? 'text-red-700' : ''}`}>{v.stock_qty} un.</span></div>)}</section>
      <section className={card}><h2 className="mb-2 font-extrabold">Movimentações</h2>
        <div className="mb-3 flex flex-wrap gap-2">{['todas', ...Object.keys(KIND)].map(k => <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${filter === k ? 'bg-deep text-white' : 'bg-cream'}`}>{k === 'todas' ? 'Todas' : KIND[k]}</button>)}</div>
        {shown.length === 0 && <p className="py-4 text-center text-deep/60">Nenhuma movimentação.</p>}
        {shown.map(m => { const d = new Date(m.created_at); return <div key={m.id} className="flex items-center justify-between border-t border-deep/10 py-2 text-sm">
          <div><p className="font-bold">{KIND[m.kind]} · {m.product_variants?.products.name} {m.product_variants?.size_ml} ml</p><p className="text-deep/70">{d.toLocaleDateString('pt-BR')} {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{m.note && ` · ${m.note}`}</p></div>
          <span className={`text-lg font-extrabold ${PLUS.includes(m.kind) ? 'text-leaf' : 'text-red-700'}`}>{PLUS.includes(m.kind) ? '+' : '−'}{m.quantity}</span></div> })}</section>
    </div>)
}
