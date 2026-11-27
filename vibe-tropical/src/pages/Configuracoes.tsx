import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Cat = { id: string; name: string }
const field = 'w-full rounded-2xl border border-deep/20 bg-white px-4 py-3 text-base'
const card = 'rounded-3xl bg-white p-5 ring-1 ring-deep/10 space-y-3'

export default function Configuracoes() {
  const [f, setF] = useState({ business_name: '', whatsapp: '', address: '', opening_hours: '', fee: '' })
  const [cats, setCats] = useState<Cat[]>([]); const [newCat, setNewCat] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState(false); const [ready, setReady] = useState(false)
  const loadCats = () => supabase.from('expense_categories').select('id,name').order('name').then(({ data }) => setCats((data as Cat[]) ?? []))
  useEffect(() => {
    loadCats()
    supabase.from('settings').select('business_name,whatsapp,address,opening_hours,default_delivery_fee').eq('id', 1).maybeSingle().then(({ data, error }) => {
      if (error) setMsg({ ok: false, t: 'Não foi possível carregar as configurações.' })
      else if (data) setF({ business_name: data.business_name ?? '', whatsapp: data.whatsapp ?? '', address: data.address ?? '', opening_hours: data.opening_hours ?? '', fee: data.default_delivery_fee == null ? '' : String(data.default_delivery_fee) })
      setReady(true) })
  }, [])

  async function save() {
    if (busy) return
    const fee = f.fee.trim() === '' ? null : Number(f.fee.replace(',', '.'))
    if (!f.business_name.trim()) return setMsg({ ok: false, t: 'Informe o nome comercial.' })
    if (fee !== null && !(fee >= 0)) return setMsg({ ok: false, t: 'Taxa de entrega inválida.' })
    if (!confirm('Salvar as configurações?')) return
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('settings').update({ business_name: f.business_name.trim(), whatsapp: f.whatsapp.trim() || null, address: f.address.trim() || null, opening_hours: f.opening_hours.trim() || null, default_delivery_fee: fee }).eq('id', 1)
    setBusy(false)
    setMsg(error ? { ok: false, t: 'Não foi possível salvar. ' + error.message } : { ok: true, t: 'Configurações salvas!' })
  }
  async function addCat() {
    const name = newCat.trim(); if (!name) return
    const { error } = await supabase.from('expense_categories').insert({ name })
    if (error) setMsg({ ok: false, t: 'Não foi possível criar a categoria (talvez ela já exista).' }); else { setNewCat(''); loadCats() }
  }
  if (!ready) return <p>Carregando…</p>
  return (
    <div className="space-y-4">
      <h1 className="font-script text-5xl text-leaf">Configurações</h1>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-2xl p-3 font-semibold ${msg.ok ? 'bg-leaf/10' : 'bg-red-50 text-red-800'}`}>{msg.t}</p>}
      <section className={card}><h2 className="font-extrabold">Dados do negócio</h2>
        {([['business_name', 'Nome comercial'], ['whatsapp', 'Telefone do WhatsApp (com DDD)'], ['address', 'Endereço ou localização'], ['opening_hours', 'Horário de atendimento'], ['fee', 'Taxa de entrega padrão (R$)']] as const).map(([k, l]) =>
          <label key={k} className="block text-sm font-bold">{l}<input className={field + ' mt-1'} inputMode={k === 'fee' ? 'decimal' : undefined} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></label>)}
        <button onClick={save} disabled={busy} className="w-full rounded-2xl bg-leaf py-3.5 text-lg font-extrabold text-white disabled:opacity-40">{busy ? 'Salvando…' : 'Salvar configurações'}</button>
        <p className="text-sm text-deep/70">Tamanhos e preços dos produtos ficam em <Link to="/produtos" className="font-bold text-leaf underline">Produtos</Link>.</p></section>
      <section className={card}><h2 className="font-extrabold">Categorias de despesas</h2>
        <div className="flex flex-wrap gap-2">{cats.map(c => <span key={c.id} className="rounded-full bg-cream px-3 py-1.5 text-sm font-bold">{c.name}</span>)}</div>
        <div className="flex gap-2"><input className={field} placeholder="Nova categoria" value={newCat} onChange={e => setNewCat(e.target.value)} /><button onClick={addCat} className="rounded-2xl bg-sun px-5 font-extrabold">Adicionar</button></div></section>
      <section className={card}><h2 className="font-extrabold">Backup dos dados</h2>
        <p className="text-sm">Pelo menos uma vez por mês, abra <b>Relatórios</b>, escolha <b>Este mês</b> e toque em <b>Baixar Excel</b>. Guarde o arquivo no Google Drive ou no e-mail. No Supabase, o banco também pode ser exportado em <b>Database → Backups</b>.</p></section>
    </div>)
}
