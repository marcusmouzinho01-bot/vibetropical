import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl, dayKey } from '../brand'

type Sale = { total: number; origin: string; payment_method: string }
type Exp = { id: string; description: string; amount: number; expense_date: string; payment_method: string | null; note: string | null; expense_categories: { name: string } | null }
type Cat = { id: string; name: string }
const PAY: [string, string][] = [['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['credito', 'Crédito'], ['debito', 'Débito']]
const PAYL = Object.fromEntries(PAY) as Record<string, string>
const PRESETS: [string, string][] = [['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7dias', 'Últimos 7 dias'], ['mes', 'Este mês'], ['anterior', 'Mês anterior'], ['custom', 'Período']]
const field = 'w-full rounded-2xl border border-deep/20 bg-white px-4 py-3 text-base'
const card = 'rounded-3xl bg-white p-5 ring-1 ring-deep/10'
const num = (s: string) => Number(String(s).replace(',', '.'))
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

function range(p: string, cf: string, ct: string): [string, string] {
  const t = new Date()
  if (p === 'hoje') return [dayKey(t), dayKey(t)]
  if (p === 'ontem') { const y = dayKey(addDays(t, -1)); return [y, y] }
  if (p === '7dias') return [dayKey(addDays(t, -6)), dayKey(t)]
  if (p === 'mes') return [dayKey(new Date(t.getFullYear(), t.getMonth(), 1)), dayKey(t)]
  if (p === 'anterior') return [dayKey(new Date(t.getFullYear(), t.getMonth() - 1, 1)), dayKey(new Date(t.getFullYear(), t.getMonth(), 0))]
  return [cf, ct]
}
async function fetchData(from: string, to: string) {
  const a = new Date(from + 'T00:00:00'), b = new Date(to + 'T00:00:00'); b.setDate(b.getDate() + 1)
  const [s, e] = await Promise.all([
    supabase.from('sales').select('total,origin,payment_method').eq('status', 'confirmada').gte('created_at', a.toISOString()).lt('created_at', b.toISOString()),
    supabase.from('expenses').select('id,description,amount,expense_date,payment_method,note,expense_categories(name)').gte('expense_date', from).lte('expense_date', to).order('expense_date', { ascending: false }).order('created_at', { ascending: false })])
  if (s.error || e.error) throw new Error('load')
  return { sales: (s.data as any[]).map(x => ({ ...x, total: Number(x.total) })) as Sale[], exps: (e.data as any[]).map(x => ({ ...x, amount: Number(x.amount) })) as Exp[] }
}

function Caixa() {
  const [day, setDay] = useState(dayKey(new Date()))
  const [d, setD] = useState<{ sales: Sale[]; exps: Exp[] } | null>(null)
  const [closed, setClosed] = useState<any>(null)
  const [counted, setCounted] = useState(''); const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState(false)
  const load = () => {
    setD(null); setClosed(null)
    Promise.all([fetchData(day, day), supabase.from('cash_closings').select('*').eq('closing_date', day).maybeSingle()])
      .then(([x, c]) => { setD(x); setClosed(c.data) }).catch(() => setMsg({ ok: false, t: 'Não foi possível carregar o dia.' }))
  }
  useEffect(load, [day])
  const by = (m: string[]) => sum((d?.sales ?? []).filter(s => m.includes(s.payment_method)).map(s => s.total))
  const cash = by(['dinheiro']), pix = by(['pix']), cardSales = by(['credito', 'debito'])
  const expCash = sum((d?.exps ?? []).filter(e => e.payment_method === 'dinheiro').map(e => e.amount))
  const expOther = sum((d?.exps ?? []).filter(e => e.payment_method !== 'dinheiro').map(e => e.amount))
  const expected = cash - expCash
  const diff = (num(counted || '0') || 0) - expected
  async function close() {
    if (busy) return
    if (counted.trim() === '' || !(num(counted) >= 0)) return setMsg({ ok: false, t: 'Informe o valor contado em dinheiro.' })
    if (!confirm(`Fechar o caixa de ${new Date(day + 'T00:00:00').toLocaleDateString('pt-BR')}?`)) return
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('cash_closings').insert({ closing_date: day, cash_sales: cash, pix_sales: pix, card_sales: cardSales, cash_expenses: expCash, other_expenses: expOther, expected_cash: expected, counted_cash: num(counted), difference: num(counted) - expected, note: note.trim() || null })
    setBusy(false)
    if (error) return setMsg({ ok: false, t: error.code === '23505' ? 'Este dia já foi fechado.' : 'Não foi possível fechar o caixa. ' + error.message })
    setMsg({ ok: true, t: 'Caixa fechado!' }); load()
  }
  const row = (l: string, v: number, strong = false) => <div className={`flex justify-between py-1.5 ${strong ? 'text-lg font-extrabold' : ''}`}><span>{l}</span><span>{brl(v)}</span></div>
  return (
    <div className="space-y-4">
      <input type="date" aria-label="Dia do fechamento" className={field + ' max-w-xs'} value={day} max={dayKey(new Date())} onChange={e => { setMsg(null); setDay(e.target.value) }} />
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-2xl p-3 font-semibold ${msg.ok ? 'bg-leaf/10' : 'bg-red-50 text-red-800'}`}>{msg.t}</p>}
      {!d && <p>Carregando…</p>}
      {d && <div className={card}>
        {row('Vendas em dinheiro', cash)}{row('Vendas em Pix', pix)}{row('Vendas em cartão', cardSales)}
        <hr className="my-2 border-deep/10" />
        {row('Despesas pagas em dinheiro', expCash)}{row('Despesas pagas por outras formas', expOther)}
        <hr className="my-2 border-deep/10" />
        {row('Dinheiro esperado no caixa', expected, true)}
        {closed ? <>{row('Valor contado', Number(closed.counted_cash))}{row('Diferença', Number(closed.difference), true)}
          {closed.note && <p className="mt-2 text-sm italic">Obs.: {closed.note}</p>}<p className="mt-3 rounded-2xl bg-leaf/10 p-3 font-bold">Este dia já está fechado.</p></> : <>
          <label className="mt-3 block text-sm font-bold">Valor contado em dinheiro (R$)<input inputMode="decimal" className={field + ' mt-1'} value={counted} onChange={e => setCounted(e.target.value)} /></label>
          {row('Diferença', diff, true)}
          <label className="mt-2 block text-sm font-bold">Observações (opcional)<textarea rows={2} className={field + ' mt-1'} value={note} onChange={e => setNote(e.target.value)} /></label>
          <button onClick={close} disabled={busy} className="mt-3 w-full rounded-2xl bg-leaf py-4 text-lg font-extrabold text-white disabled:opacity-40">{busy ? 'Fechando…' : 'Fechar caixa'}</button></>}
      </div>}
    </div>)
}

export default function Financeiro() {
  const [tab, setTab] = useState<'resumo' | 'despesas' | 'caixa'>('resumo')
  const [preset, setPreset] = useState('hoje')
  const [cf, setCf] = useState(dayKey(new Date())); const [ct, setCt] = useState(dayKey(new Date()))
  const [d, setD] = useState<{ sales: Sale[]; exps: Exp[] } | null>(null)
  const [cats, setCats] = useState<Cat[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState(false)
  const [ex, setEx] = useState({ description: '', cat: '', newCat: '', amount: '', date: dayKey(new Date()), pay: 'dinheiro', note: '' })
  const [from, to] = range(preset, cf, ct)

  const load = () => fetchData(from, to).then(setD).catch(() => setMsg({ ok: false, t: 'Não foi possível carregar os dados.' }))
  const loadCats = () => supabase.from('expense_categories').select('id,name').order('name').then(({ data }) => setCats((data as Cat[]) ?? []))
  useEffect(() => { loadCats() }, [])
  useEffect(() => { if (from <= to) load() }, [from, to])

  async function save() {
    if (busy) return
    if (!ex.description.trim()) return setMsg({ ok: false, t: 'Informe a descrição da despesa.' })
    if (!(num(ex.amount) > 0)) return setMsg({ ok: false, t: 'Informe um valor maior que zero.' })
    if (!ex.date) return setMsg({ ok: false, t: 'Informe a data.' })
    setBusy(true); setMsg(null)
    let cid: string | null = ex.cat || null
    if (ex.cat === '__new') {
      const name = ex.newCat.trim()
      if (!name) { setBusy(false); return setMsg({ ok: false, t: 'Escreva o nome da nova categoria.' }) }
      const c = await supabase.from('expense_categories').insert({ name }).select('id').single()
      if (c.error) { setBusy(false); return setMsg({ ok: false, t: 'Não foi possível criar a categoria (talvez ela já exista).' }) }
      cid = c.data.id as string
    }
    const { error } = await supabase.from('expenses').insert({ description: ex.description.trim(), category_id: cid, amount: num(ex.amount), expense_date: ex.date, payment_method: ex.pay, note: ex.note.trim() || null })
    setBusy(false)
    if (error) return setMsg({ ok: false, t: 'Não foi possível salvar. ' + error.message })
    setEx({ ...ex, description: '', amount: '', note: '', newCat: '', cat: cid ?? '' }); setMsg({ ok: true, t: 'Despesa registrada!' }); loadCats(); load()
  }
  async function del(e: Exp) {
    if (!confirm(`Excluir a despesa "${e.description}" (${brl(e.amount)})?`)) return
    const { error } = await supabase.from('expenses').delete().eq('id', e.id)
    if (error) setMsg({ ok: false, t: 'Não foi possível excluir.' }); else { setMsg(null); load() }
  }

  const rev = sum((d?.sales ?? []).map(s => s.total)), exp = sum((d?.exps ?? []).map(e => e.amount))
  const byPay = (k: string) => sum((d?.sales ?? []).filter(s => s.payment_method === k).map(s => s.total))
  const byOrigin = (k: string) => sum((d?.sales ?? []).filter(s => s.origin === k).map(s => s.total))
  const Filter = <div className="space-y-2">
    <div className="flex flex-wrap gap-2">{PRESETS.map(([k, l]) => <button key={k} onClick={() => setPreset(k)} className={`rounded-full px-4 py-2 font-bold ${preset === k ? 'bg-deep text-white' : 'bg-cream'}`}>{l}</button>)}</div>
    {preset === 'custom' && <div className="flex gap-2"><input type="date" aria-label="De" className={field} value={cf} max={ct} onChange={e => setCf(e.target.value)} /><input type="date" aria-label="Até" className={field} value={ct} min={cf} onChange={e => setCt(e.target.value)} /></div>}</div>

  return (
    <div className="space-y-4">
      <h1 className="font-script text-5xl text-leaf">Financeiro</h1>
      <div className="flex gap-2">{([['resumo', 'Resumo'], ['despesas', 'Despesas'], ['caixa', 'Fechar caixa']] as const).map(([k, l]) => <button key={k} onClick={() => { setTab(k); setMsg(null) }} className={`flex-1 rounded-2xl py-3 font-extrabold ${tab === k ? 'bg-sun' : 'bg-white ring-1 ring-deep/10'}`}>{l}</button>)}</div>
      {msg && tab !== 'caixa' && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-2xl p-3 font-semibold ${msg.ok ? 'bg-leaf/10' : 'bg-red-50 text-red-800'}`}>{msg.t}</p>}
      {tab === 'caixa' ? <Caixa /> : <>
        {Filter}
        {tab === 'resumo' && (!d ? <p>Carregando…</p> : <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">{[['Receitas', rev], ['Despesas', exp], ['Saldo após despesas', rev - exp]].map(([l, v], i) => <div key={l as string} className={`${card} ${i === 2 ? 'bg-leaf text-white ring-0' : ''}`}><p className="text-xs font-semibold">{l}</p><p className="mt-1 text-lg font-extrabold">{brl(v as number)}</p></div>)}</div>
          <p className="text-xs text-deep/60">Saldo = vendas confirmadas menos as despesas que você registrou. Não é lucro contábil: custos que não foram lançados não entram.</p>
          <div className={card}><h2 className="mb-2 font-extrabold">Receitas por forma de pagamento</h2>{PAY.map(([k, l]) => <div key={k} className="flex justify-between py-1"><span>{l}</span><span className="font-bold">{brl(byPay(k))}</span></div>)}</div>
          <div className={card}><h2 className="mb-2 font-extrabold">Receitas por origem</h2>
            <div className="flex justify-between py-1"><span>Presencial</span><span className="font-bold">{brl(byOrigin('presencial'))}</span></div>
            <div className="flex justify-between py-1"><span>WhatsApp</span><span className="font-bold">{brl(byOrigin('whatsapp'))}</span></div></div></div>)}
        {tab === 'despesas' && <>
          <div className={card + ' space-y-3'}><h2 className="font-extrabold">Nova despesa</h2>
            <label className="block text-sm font-bold">Descrição<input className={field + ' mt-1'} placeholder="Ex.: Compra de morangos" value={ex.description} onChange={e => setEx({ ...ex, description: e.target.value })} /></label>
            <label className="block text-sm font-bold">Categoria<select className={field + ' mt-1'} value={ex.cat} onChange={e => setEx({ ...ex, cat: e.target.value })}><option value="">Sem categoria</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="__new">+ Nova categoria…</option></select></label>
            {ex.cat === '__new' && <input className={field} placeholder="Nome da nova categoria" value={ex.newCat} onChange={e => setEx({ ...ex, newCat: e.target.value })} />}
            <div className="grid grid-cols-2 gap-2"><label className="text-sm font-bold">Valor (R$)<input inputMode="decimal" className={field + ' mt-1'} value={ex.amount} onChange={e => setEx({ ...ex, amount: e.target.value })} /></label>
              <label className="text-sm font-bold">Data<input type="date" className={field + ' mt-1'} value={ex.date} onChange={e => setEx({ ...ex, date: e.target.value })} /></label></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{PAY.map(([k, l]) => <button key={k} onClick={() => setEx({ ...ex, pay: k })} className={`rounded-2xl py-3 font-bold ${ex.pay === k ? 'bg-deep text-white' : 'bg-cream'}`}>{l}</button>)}</div>
            <input className={field} placeholder="Observação (opcional)" value={ex.note} onChange={e => setEx({ ...ex, note: e.target.value })} />
            <button onClick={save} disabled={busy} className="w-full rounded-2xl bg-leaf py-3.5 text-lg font-extrabold text-white disabled:opacity-40">{busy ? 'Salvando…' : 'Registrar despesa'}</button></div>
          <p className="font-bold">Despesas no período: {brl(exp)}</p>
          {d && d.exps.length === 0 && <p className="py-4 text-center text-deep/60">Nenhuma despesa neste período.</p>}
          {d?.exps.map(e => <div key={e.id} className="flex items-center justify-between gap-2 rounded-2xl bg-white p-3 ring-1 ring-deep/10">
            <div><p className="font-bold">{e.description}</p><p className="text-sm text-deep/70">{new Date(e.expense_date + 'T00:00:00').toLocaleDateString('pt-BR')} · {e.expense_categories?.name ?? 'Sem categoria'} · {e.payment_method ? PAYL[e.payment_method] : ''}</p></div>
            <div className="flex items-center gap-2"><span className="font-extrabold">{brl(e.amount)}</span><button aria-label="Excluir despesa" onClick={() => del(e)} className="rounded-xl bg-cream p-2.5 text-red-700"><Trash2 size={18} /></button></div></div>)}</>}
      </>}
    </div>)
}
