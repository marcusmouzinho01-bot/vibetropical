import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl, dayKey } from '../brand'

type Opt = { id: string; size_ml: number; price: number; stock_qty: number; name: string }
type Sale = { id: string; sale_number: number; created_at: string; status: string; payment_method: string; total: number; origin: string; sale_items: { product_name: string; size_ml: number; quantity: number }[] }
const PAY: [string, string][] = [['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['credito', 'Crédito'], ['debito', 'Débito']]
const PAYL = Object.fromEntries(PAY) as Record<string, string>
const field = 'rounded-2xl border border-deep/20 bg-white px-3 py-2.5'

export default function Vendas() {
  const [opts, setOpts] = useState<Opt[] | null>(null)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [pay, setPay] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [from, setFrom] = useState(dayKey(new Date())); const [to, setTo] = useState(dayKey(new Date()))
  const [q, setQ] = useState('')
  const [sales, setSales] = useState<Sale[] | null>(null)

  const loadOpts = () => supabase.from('product_variants').select('id,size_ml,price,stock_qty,products!inner(name)').eq('active', true).eq('products.active', true).order('size_ml')
    .then(({ data, error }) => { if (error) return setMsg({ ok: false, t: 'Não foi possível carregar os produtos.' })
      setOpts((data as any[]).map(r => ({ id: r.id, size_ml: r.size_ml, price: Number(r.price), stock_qty: r.stock_qty, name: r.products.name }))) })
  const loadSales = () => {
    const a = new Date(from + 'T00:00:00'), b = new Date(to + 'T00:00:00'); b.setDate(b.getDate() + 1)
    return supabase.from('sales').select('id,sale_number,created_at,status,payment_method,total,origin,sale_items(product_name,size_ml,quantity)')
      .gte('created_at', a.toISOString()).lt('created_at', b.toISOString()).order('created_at', { ascending: false })
      .then(({ data, error }) => { if (error) setMsg({ ok: false, t: 'Não foi possível carregar o histórico.' }); else setSales((data as any[]).map(s => ({ ...s, total: Number(s.total) }))) })
  }
  useEffect(() => { loadOpts() }, [])
  useEffect(() => { loadSales() }, [from, to])

  const lines = useMemo(() => (opts ?? []).filter(o => cart[o.id] > 0).map(o => ({ o, n: cart[o.id] })), [opts, cart])
  const total = lines.reduce((s, l) => s + l.o.price * l.n, 0)
  const add = (o: Opt, d: number) => setCart(c => { const n = Math.max(0, Math.min(o.stock_qty, (c[o.id] ?? 0) + d)); return { ...c, [o.id]: n } })

  async function confirmSale() {
    if (busy || !lines.length || !pay) return
    setBusy(true); setMsg(null)
    const { error } = await supabase.rpc('register_sale', { p_origin: 'presencial', p_payment: pay, p_items: lines.map(l => ({ variant_id: l.o.id, quantity: l.n })) })
    setBusy(false)
    if (error) return setMsg({ ok: false, t: error.message })
    setCart({}); setPay(''); setMsg({ ok: true, t: 'Venda registrada!' }); loadOpts(); loadSales()
  }
  async function cancel(s: Sale) {
    if (!confirm(`Cancelar a venda #${s.sale_number}? Os itens voltam para o estoque.`)) return
    const { error } = await supabase.rpc('cancel_sale', { p_sale: s.id })
    if (error) setMsg({ ok: false, t: error.message }); else { setMsg({ ok: true, t: 'Venda cancelada.' }); loadOpts(); loadSales() }
  }

  const shown = (sales ?? []).filter(s => { const t = q.trim().toLowerCase(); return !t || String(s.sale_number) === t.replace('#', '') || s.sale_items.some(i => i.product_name.toLowerCase().includes(t)) })
  const periodTotal = shown.filter(s => s.status === 'confirmada').reduce((a, s) => a + s.total, 0)
  const card = 'rounded-3xl bg-white p-5 ring-1 ring-deep/10'

  return (
    <div className="space-y-5">
      <h1 className="font-script text-5xl text-leaf">Vendas</h1>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-2xl p-3 font-semibold ${msg.ok ? 'bg-leaf/10 text-deep' : 'bg-red-50 text-red-800'}`}>{msg.t}</p>}
      <section className={card}>
        <h2 className="mb-3 font-extrabold">Nova venda presencial</h2>
        {opts?.length === 0 && <p className="text-deep/70">Cadastre um produto com tamanhos e preços em Produtos para começar a vender.</p>}
        <div className="space-y-2">{opts?.map(o => (
          <div key={o.id} className={`flex items-center justify-between rounded-2xl bg-cream/60 p-3 ${o.stock_qty === 0 ? 'opacity-50' : ''}`}>
            <div><p className="font-bold">{o.name} {o.size_ml} ml</p><p className="text-sm">{brl(o.price)} · {o.stock_qty === 0 ? 'Esgotado' : `${o.stock_qty} disponíveis`}</p></div>
            <div className="flex items-center gap-3">
              <button aria-label="Diminuir" onClick={() => add(o, -1)} className="rounded-full bg-white p-3"><Minus size={20} /></button>
              <span className="w-6 text-center text-lg font-extrabold">{cart[o.id] ?? 0}</span>
              <button aria-label="Aumentar" disabled={o.stock_qty === 0} onClick={() => add(o, 1)} className="rounded-full bg-sun p-3"><Plus size={20} /></button></div></div>))}</div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{PAY.map(([k, l]) => (
          <button key={k} onClick={() => setPay(k)} className={`rounded-2xl py-3 font-bold ${pay === k ? 'bg-deep text-white' : 'bg-cream'}`}>{l}</button>))}</div>
        <div className="mt-4 flex items-center justify-between"><span className="font-bold">Total</span><span className="text-3xl font-extrabold">{brl(total)}</span></div>
        <button onClick={confirmSale} disabled={busy || !lines.length || !pay} className="mt-3 w-full rounded-2xl bg-leaf py-4 text-lg font-extrabold text-white disabled:opacity-40">{busy ? 'Registrando…' : 'Confirmar venda'}</button>
        {lines.length > 0 && !pay && <p className="mt-2 text-sm text-deep/70">Escolha a forma de pagamento para confirmar.</p>}
      </section>
      <section className={card}>
        <h2 className="mb-3 font-extrabold">Histórico</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          <input type="date" aria-label="De" className={field} value={from} max={to} onChange={e => setFrom(e.target.value)} />
          <input type="date" aria-label="Até" className={field} value={to} min={from} onChange={e => setTo(e.target.value)} />
          <input className={field + ' flex-1'} placeholder="Buscar por número ou produto" value={q} onChange={e => setQ(e.target.value)} /></div>
        <p className="mb-3 text-sm font-bold">Vendas confirmadas no período: {brl(periodTotal)}</p>
        {sales && shown.length === 0 && <p className="py-6 text-center text-deep/60">Nenhuma venda neste período.</p>}
        <div className="space-y-2">{shown.map(s => { const d = new Date(s.created_at); return (
          <div key={s.id} className={`rounded-2xl bg-cream/60 p-3 ${s.status === 'cancelada' ? 'opacity-60' : ''}`}>
            <div className="flex justify-between font-bold"><span>#{s.sale_number} · {d.toLocaleDateString('pt-BR')} {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span><span>{brl(s.total)}</span></div>
            <p className="text-sm">{s.sale_items.map(i => `${i.quantity}× ${i.product_name} ${i.size_ml} ml`).join(', ')}</p>
            <div className="mt-1 flex items-center justify-between text-sm"><span>{PAYL[s.payment_method]}{s.status === 'cancelada' && ' · Cancelada'}</span>
              {s.status === 'confirmada' && <button onClick={() => cancel(s)} className="font-bold text-red-700">Cancelar venda</button>}</div></div>) })}</div>
      </section>
    </div>)
}
