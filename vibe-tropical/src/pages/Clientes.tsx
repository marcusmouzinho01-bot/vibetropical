import { useEffect, useState } from 'react'
import { Plus, Pencil, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl } from '../brand'

type C = { id: string; name: string; phone: string | null; address: string | null; notes: string | null }
type Draft = { id?: string; name: string; phone: string; address: string; notes: string }
type Stat = { orders: number; sales: number; spent: number; last: string | null }
const blank: Draft = { name: '', phone: '', address: '', notes: '' }
const field = 'w-full rounded-2xl border border-deep/20 bg-white px-4 py-3 text-base'
const digits = (s: string | null) => (s ?? '').replace(/\D/g, '')

export default function Clientes() {
  const [list, setList] = useState<C[] | null>(null)
  const [stats, setStats] = useState<Record<string, Stat>>({})
  const [draft, setDraft] = useState<Draft | null>(null)
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)

  const load = async () => {
    const [c, s, o] = await Promise.all([
      supabase.from('customers').select('id,name,phone,address,notes').order('name'),
      supabase.from('sales').select('customer_id,total,created_at').eq('status', 'confirmada').not('customer_id', 'is', null),
      supabase.from('orders').select('customer_id,status').neq('status', 'cancelado').not('customer_id', 'is', null)])
    if (c.error || s.error || o.error) return setMsg({ ok: false, t: 'Não foi possível carregar os clientes.' })
    const st: Record<string, Stat> = {}
    const get = (id: string) => (st[id] ??= { orders: 0, sales: 0, spent: 0, last: null })
    ;(o.data as any[]).forEach(x => { get(x.customer_id).orders++ })
    ;(s.data as any[]).forEach(x => { const r = get(x.customer_id); r.sales++; r.spent += Number(x.total); if (!r.last || x.created_at > r.last) r.last = x.created_at })
    setStats(st); setList(c.data as C[])
  }
  useEffect(() => { load() }, [])

  async function save() {
    if (!draft || busy) return
    if (!draft.name.trim()) return setMsg({ ok: false, t: 'Informe o nome do cliente.' })
    const ph = digits(draft.phone)
    if (ph && (list ?? []).some(c => c.id !== draft.id && digits(c.phone) === ph)) return setMsg({ ok: false, t: 'Já existe um cliente com este telefone.' })
    if (draft.id && !confirm('Salvar as alterações deste cliente?')) return
    setBusy(true); setMsg(null)
    const row = { name: draft.name.trim(), phone: draft.phone.trim() || null, address: draft.address.trim() || null, notes: draft.notes.trim() || null }
    const { error } = draft.id ? await supabase.from('customers').update(row).eq('id', draft.id) : await supabase.from('customers').insert(row)
    setBusy(false)
    if (error) return setMsg({ ok: false, t: 'Não foi possível salvar. ' + error.message })
    setDraft(null); setMsg({ ok: true, t: 'Cliente salvo!' }); load()
  }

  if (draft) return (
    <div className="space-y-4">
      <h1 className="font-script text-5xl text-leaf">{draft.id ? 'Editar cliente' : 'Novo cliente'}</h1>
      {([['name', 'Nome'], ['phone', 'Telefone (com DDD)'], ['address', 'Endereço']] as const).map(([k, l]) => <label key={k} className="block text-sm font-bold">{l}<input className={field + ' mt-1'} inputMode={k === 'phone' ? 'tel' : undefined} value={draft[k]} onChange={e => setDraft({ ...draft, [k]: e.target.value })} /></label>)}
      <label className="block text-sm font-bold">Observações<textarea rows={2} className={field + ' mt-1'} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label>
      {msg && !msg.ok && <p role="alert" className="rounded-2xl bg-red-50 p-3 font-semibold text-red-800">{msg.t}</p>}
      <div className="flex gap-3"><button onClick={save} disabled={busy} className="flex-1 rounded-2xl bg-leaf py-3.5 text-lg font-extrabold text-white disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar cliente'}</button>
        <button onClick={() => { setDraft(null); setMsg(null) }} className="rounded-2xl bg-cream px-6 font-bold">Cancelar</button></div>
    </div>)

  const t = q.trim().toLowerCase()
  const shown = (list ?? []).filter(c => !t || c.name.toLowerCase().includes(t) || digits(c.phone).includes(digits(t) || '§'))
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="font-script text-5xl text-leaf">Clientes</h1>
        <button onClick={() => { setMsg(null); setDraft(blank) }} className="flex items-center gap-2 rounded-2xl bg-sun px-4 py-3 font-extrabold"><Plus size={20} />Novo cliente</button></div>
      <input className={field} placeholder="Buscar por nome ou telefone" value={q} onChange={e => setQ(e.target.value)} />
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-2xl p-3 font-semibold ${msg.ok ? 'bg-leaf/10' : 'bg-red-50 text-red-800'}`}>{msg.t}</p>}
      {list && shown.length === 0 && <p className="rounded-3xl bg-white p-8 text-center text-deep/70">Nenhum cliente encontrado. Quem faz um pedido com telefone é cadastrado automaticamente.</p>}
      {shown.map(c => { const s = stats[c.id]; const d = digits(c.phone); return (
        <div key={c.id} className="rounded-3xl bg-white p-5 ring-1 ring-deep/10">
          <div className="flex items-start justify-between gap-2"><div><p className="text-lg font-extrabold">{c.name}</p><p className="text-sm text-deep/70">{c.phone}{c.address && ` · ${c.address}`}</p></div>
            <button aria-label="Editar" onClick={() => { setMsg(null); setDraft({ id: c.id, name: c.name, phone: c.phone ?? '', address: c.address ?? '', notes: c.notes ?? '' }) }} className="rounded-xl bg-cream p-2.5"><Pencil size={18} /></button></div>
          <p className="mt-2 text-sm font-semibold">{s?.orders ?? 0} pedidos · {s?.sales ?? 0} compras concluídas · {brl(s?.spent ?? 0)} gastos{s?.last && ` · última: ${new Date(s.last).toLocaleDateString('pt-BR')}`}</p>
          {c.notes && <p className="text-sm italic">Obs.: {c.notes}</p>}
          {d && <a href={`https://wa.me/${d.length <= 11 ? '55' + d : d}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 rounded-2xl bg-leaf px-4 py-2.5 font-bold text-white"><MessageCircle size={18} />WhatsApp</a>}
        </div>) })}
    </div>)
}
