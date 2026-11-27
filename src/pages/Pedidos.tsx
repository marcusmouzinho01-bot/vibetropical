import { useEffect, useState } from 'react'
import { Minus, Plus, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl } from '../brand'

type Item = { product_name: string; size_ml: number; unit_price: number; quantity: number }
type Order = { id: string; order_number: number; customer_name: string; phone: string | null; service_type: 'retirada' | 'entrega'; status: string; address: string | null; delivery_fee: number; payment_method: string; notes: string | null; created_at: string; order_items: Item[] }
type Opt = { id: string; size_ml: number; price: number; name: string }
const ST: Record<string, string> = { aguardando: 'Aguardando confirmação', confirmado: 'Confirmado', preparacao: 'Em preparação', saiu: 'Saiu para entrega', entregue: 'Entregue', cancelado: 'Cancelado' }
const PAY: [string, string][] = [['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['credito', 'Crédito'], ['debito', 'Débito']]
const PAYL = Object.fromEntries(PAY) as Record<string, string>
const field = 'w-full rounded-2xl border border-deep/20 bg-white px-4 py-3 text-base'
const num = (s: string) => Number(String(s).replace(',', '.'))
const sub = (o: Order) => o.order_items.reduce((a, i) => a + i.unit_price * i.quantity, 0)

function waLink(o: Order, biz: string) {
  const d = (o.phone ?? '').replace(/\D/g, ''); const to = d.length <= 11 ? '55' + d : d
  const lines = [`*${biz}* 🍓`, `Pedido #${o.order_number}`, `Olá, ${o.customer_name}! Segue o resumo do seu pedido:`, '',
    ...o.order_items.map(i => `• ${i.quantity}× ${i.product_name} ${i.size_ml} ml — ${brl(i.unit_price * i.quantity)}`), '',
    `Subtotal: ${brl(sub(o))}`, ...(o.service_type === 'entrega' ? [`Taxa de entrega: ${brl(o.delivery_fee)}`] : []),
    `*Total: ${brl(sub(o) + o.delivery_fee)}*`, `Pagamento: ${PAYL[o.payment_method] ?? ''}`,
    o.service_type === 'entrega' ? `Endereço: ${o.address}` : 'Retirada no local']
  return `https://wa.me/${to}?text=${encodeURIComponent(lines.join('\n'))}`
}

export default function Pedidos() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [opts, setOpts] = useState<Opt[]>([])
  const [biz, setBiz] = useState('Vibe Tropical')
  const [tab, setTab] = useState<'abertos' | 'todos'>('abertos')
  const [form, setForm] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ name: '', phone: '', service: 'retirada', address: '', fee: '', pay: '', notes: '' })
  const [cart, setCart] = useState<Record<string, number>>({})

  const load = () => supabase.from('orders').select('id,order_number,customer_name,phone,service_type,status,address,delivery_fee,payment_method,notes,created_at,order_items(product_name,size_ml,unit_price,quantity)').order('created_at', { ascending: false }).limit(100)
    .then(({ data, error }) => { if (error) setMsg({ ok: false, t: 'Não foi possível carregar os pedidos.' }); else setOrders((data as any[]).map(o => ({ ...o, delivery_fee: Number(o.delivery_fee), order_items: o.order_items.map((i: any) => ({ ...i, unit_price: Number(i.unit_price) })) }))) })
  useEffect(() => {
    load()
    supabase.from('product_variants').select('id,size_ml,price,products!inner(name)').eq('active', true).eq('products.active', true).order('size_ml')
      .then(({ data }) => setOpts((data as any[] ?? []).map(r => ({ id: r.id, size_ml: r.size_ml, price: Number(r.price), name: r.products.name }))))
    supabase.from('settings').select('business_name,default_delivery_fee').maybeSingle().then(({ data }) => { if (data?.business_name) setBiz(data.business_name); if (data?.default_delivery_fee != null) setF(x => ({ ...x, fee: String(data.default_delivery_fee) })) })
  }, [])

  const lines = opts.filter(o => cart[o.id] > 0).map(o => ({ o, n: cart[o.id] }))
  const total = lines.reduce((a, l) => a + l.o.price * l.n, 0) + (f.service === 'entrega' ? num(f.fee || '0') || 0 : 0)
  const step = (id: string, d: number) => setCart(c => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }))

  async function create() {
    if (busy) return
    setBusy(true); setMsg(null)
    const { error } = await supabase.rpc('register_order', { p_name: f.name, p_phone: f.phone, p_service: f.service, p_address: f.address, p_fee: f.service === 'entrega' ? num(f.fee || '0') || 0 : 0, p_payment: f.pay, p_notes: f.notes, p_items: lines.map(l => ({ variant_id: l.o.id, quantity: l.n })) })
    setBusy(false)
    if (error) return setMsg({ ok: false, t: error.message })
    setForm(false); setCart({}); setF(x => ({ ...x, name: '', phone: '', address: '', notes: '', pay: '' })); setMsg({ ok: true, t: 'Pedido registrado!' }); load()
  }
  async function move(o: Order, status: string) {
    const ask = status === 'cancelado' ? `Cancelar o pedido #${o.order_number}?` : status === 'entregue' ? `Marcar #${o.order_number} como entregue? A venda será registrada e o estoque descontado.` : ''
    if (ask && !confirm(ask)) return
    const { error } = await supabase.rpc('set_order_status', { p_order: o.id, p_status: status })
    if (error) setMsg({ ok: false, t: error.message }); else { setMsg(null); load() }
  }
  const nextOf = (o: Order) => { const flow = o.service_type === 'entrega' ? ['aguardando', 'confirmado', 'preparacao', 'saiu', 'entregue'] : ['aguardando', 'confirmado', 'preparacao', 'entregue']; return flow[flow.indexOf(o.status) + 1] }
  const shown = (orders ?? []).filter(o => tab === 'todos' || !['entregue', 'cancelado'].includes(o.status))

  if (form) return (
    <div className="space-y-4">
      <h1 className="font-script text-5xl text-leaf">Novo pedido</h1>
      <label className="block text-sm font-bold">Nome do cliente<input className={field + ' mt-1'} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
      <label className="block text-sm font-bold">Telefone (com DDD)<input inputMode="tel" className={field + ' mt-1'} placeholder="91 9XXXX-XXXX" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></label>
      <div className="grid grid-cols-2 gap-2">{['retirada', 'entrega'].map(s => <button key={s} onClick={() => setF({ ...f, service: s })} className={`rounded-2xl py-3 font-bold ${f.service === s ? 'bg-deep text-white' : 'bg-cream'}`}>{s === 'retirada' ? 'Retirada' : 'Entrega'}</button>)}</div>
      {f.service === 'entrega' && <>
        <label className="block text-sm font-bold">Endereço<input className={field + ' mt-1'} value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /></label>
        <label className="block text-sm font-bold">Taxa de entrega (R$)<input inputMode="decimal" className={field + ' mt-1'} value={f.fee} onChange={e => setF({ ...f, fee: e.target.value })} /></label></>}
      <h2 className="font-extrabold">Itens</h2>
      {opts.length === 0 && <p className="text-deep/70">Cadastre produtos com tamanho e preço antes de criar pedidos.</p>}
      {opts.map(o => <div key={o.id} className="flex items-center justify-between rounded-2xl bg-white p-3 ring-1 ring-deep/10">
        <div><p className="font-bold">{o.name} {o.size_ml} ml</p><p className="text-sm">{brl(o.price)}</p></div>
        <div className="flex items-center gap-3"><button aria-label="Diminuir" onClick={() => step(o.id, -1)} className="rounded-full bg-cream p-3"><Minus size={20} /></button><span className="w-6 text-center text-lg font-extrabold">{cart[o.id] ?? 0}</span><button aria-label="Aumentar" onClick={() => step(o.id, 1)} className="rounded-full bg-sun p-3"><Plus size={20} /></button></div></div>)}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{PAY.map(([k, l]) => <button key={k} onClick={() => setF({ ...f, pay: k })} className={`rounded-2xl py-3 font-bold ${f.pay === k ? 'bg-deep text-white' : 'bg-cream'}`}>{l}</button>)}</div>
      <label className="block text-sm font-bold">Observações (opcional)<textarea rows={2} className={field + ' mt-1'} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></label>
      <div className="flex justify-between"><span className="font-bold">Total</span><span className="text-3xl font-extrabold">{brl(total)}</span></div>
      {msg && !msg.ok && <p role="alert" className="rounded-2xl bg-red-50 p-3 font-semibold text-red-800">{msg.t}</p>}
      <div className="flex gap-3"><button onClick={create} disabled={busy || !lines.length} className="flex-1 rounded-2xl bg-leaf py-4 text-lg font-extrabold text-white disabled:opacity-40">{busy ? 'Salvando…' : 'Registrar pedido'}</button>
        <button onClick={() => { setForm(false); setMsg(null) }} className="rounded-2xl bg-cream px-6 font-bold">Cancelar</button></div>
    </div>)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="font-script text-5xl text-leaf">Pedidos</h1>
        <button onClick={() => { setMsg(null); setForm(true) }} className="flex items-center gap-2 rounded-2xl bg-sun px-4 py-3 font-extrabold"><Plus size={20} />Novo pedido</button></div>
      <div className="flex gap-2">{(['abertos', 'todos'] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-2 font-bold ${tab === t ? 'bg-deep text-white' : 'bg-cream'}`}>{t === 'abertos' ? 'Em andamento' : 'Todos'}</button>)}</div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-2xl p-3 font-semibold ${msg.ok ? 'bg-leaf/10' : 'bg-red-50 text-red-800'}`}>{msg.t}</p>}
      {orders && shown.length === 0 && <p className="rounded-3xl bg-white p-8 text-center text-deep/70">Nenhum pedido {tab === 'abertos' ? 'em andamento' : 'registrado'}.</p>}
      {shown.map(o => { const nx = nextOf(o); const done = ['entregue', 'cancelado'].includes(o.status); return (
        <div key={o.id} className={`rounded-3xl bg-white p-5 ring-1 ring-deep/10 ${o.status === 'cancelado' ? 'opacity-60' : ''}`}>
          <div className="flex items-start justify-between gap-2"><div><p className="text-lg font-extrabold">#{o.order_number} · {o.customer_name}</p>
            <p className="text-sm text-deep/70">{o.service_type === 'entrega' ? `Entrega · ${o.address}` : 'Retirada'} · {PAYL[o.payment_method]}</p></div>
            <span className="rounded-full bg-sun/40 px-3 py-1 text-xs font-extrabold">{ST[o.status]}</span></div>
          <p className="mt-2 text-sm">{o.order_items.map(i => `${i.quantity}× ${i.product_name} ${i.size_ml} ml`).join(', ')}</p>
          {o.notes && <p className="text-sm italic">Obs.: {o.notes}</p>}
          <p className="mt-1 font-extrabold">{brl(sub(o) + o.delivery_fee)}{o.delivery_fee > 0 && <span className="text-sm font-semibold"> (entrega {brl(o.delivery_fee)})</span>}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {o.phone && <a href={waLink(o, biz)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-2xl bg-leaf px-4 py-2.5 font-bold text-white"><MessageCircle size={18} />WhatsApp</a>}
            {!done && nx && <button onClick={() => move(o, nx)} className="rounded-2xl bg-deep px-4 py-2.5 font-bold text-white">{ST[nx]}</button>}
            {!done && <button onClick={() => move(o, 'cancelado')} className="rounded-2xl bg-cream px-4 py-2.5 font-bold text-red-700">Cancelar</button>}</div>
        </div>) })}
    </div>)
}
