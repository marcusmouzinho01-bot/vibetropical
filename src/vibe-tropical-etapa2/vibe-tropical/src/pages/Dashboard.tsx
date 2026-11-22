import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Plus, MessageCircle, Receipt, Boxes } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl, dayKey } from '../brand'
import type { Ctx } from '../components/Layout'

type Sale = { total: number; origin: 'presencial' | 'whatsapp'; created_at: string }
type Exp = { amount: number; expense_date: string }
const OPEN = ['aguardando', 'confirmado', 'preparacao', 'saiu']

function Bars({ data }: { data: { label: string; a: number; b: number }[] }) {
  const max = Math.max(1, ...data.flatMap(d => [d.a, d.b]))
  return <div className="flex h-40 items-end gap-2">{data.map(d => (
    <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
      <div className="flex h-32 w-full items-end justify-center gap-1">
        <div title={brl(d.a)} className="w-1/2 rounded-t-lg bg-leaf" style={{ height: `${(d.a / max) * 100}%` }} />
        <div title={brl(d.b)} className="w-1/2 rounded-t-lg bg-sun" style={{ height: `${(d.b / max) * 100}%` }} />
      </div><span className="text-xs font-semibold">{d.label}</span></div>))}</div>
}

export default function Dashboard() {
  const { name } = useOutletContext<Ctx>()
  const [d, setD] = useState<{ sales: Sale[]; exps: Exp[]; pending: number; products: number } | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    const from = new Date(); from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0)
    Promise.all([
      supabase.from('sales').select('total,origin,created_at').eq('status', 'confirmada').gte('created_at', from.toISOString()),
      supabase.from('expenses').select('amount,expense_date').gte('expense_date', dayKey(from)),
      supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', OPEN),
      supabase.from('product_variants').select('id', { count: 'exact', head: true }).eq('active', true).gt('stock_qty', 0),
    ]).then(([s, e, o, p]) => {
      const bad = s.error || e.error || o.error || p.error
      if (bad) return setErr('Não foi possível carregar os dados. Verifique a conexão e o banco de dados.')
      setD({ sales: (s.data ?? []).map(x => ({ ...x, total: Number(x.total) })) as Sale[], exps: (e.data ?? []).map(x => ({ ...x, amount: Number(x.amount) })) as Exp[], pending: o.count ?? 0, products: p.count ?? 0 })
    })
  }, [])

  const now = new Date(), today = dayKey(now), h = now.getHours()
  const hello = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const days = Array.from({ length: 7 }, (_, i) => { const x = new Date(); x.setDate(x.getDate() - 6 + i); return x })
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
  const sales = d?.sales ?? [], exps = d?.exps ?? []
  const tSales = sales.filter(s => dayKey(new Date(s.created_at)) === today)
  const rev = sum(tSales.map(s => s.total)), exp = sum(exps.filter(e => e.expense_date === today).map(e => e.amount))
  const byOrigin = (o: string) => sum(tSales.filter(s => s.origin === o).map(s => s.total))
  const chart = days.map(x => { const k = dayKey(x); return { label: x.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
    a: sum(sales.filter(s => dayKey(new Date(s.created_at)) === k).map(s => s.total)), b: sum(exps.filter(e => e.expense_date === k).map(e => e.amount)) } })
  const pres = byOrigin('presencial'), zap = byOrigin('whatsapp')
  const card = 'rounded-3xl bg-white p-5 shadow-sm ring-1 ring-deep/10'
  const kpis = [
    ['Faturamento de hoje', brl(rev)], ['Despesas de hoje', brl(exp)], ['Saldo após despesas', brl(rev - exp)],
    ['Vendas hoje', String(tSales.length)], ['Pedidos pendentes', String(d?.pending ?? 0)], ['Produtos disponíveis', String(d?.products ?? 0)],
  ]
  const shortcuts = [['/vendas', 'Registrar venda', Plus], ['/pedidos', 'Novo pedido', MessageCircle], ['/financeiro', 'Registrar despesa', Receipt], ['/estoque', 'Registrar produção', Boxes]] as const

  return (
    <div className="space-y-5">
      <div><h1 className="font-script text-5xl text-leaf">{hello}{name && `, ${name.split(' ')[0]}`}!</h1>
        <p className="capitalize text-deep/70">{date}</p></div>
      {err && <p role="alert" className="rounded-2xl bg-red-50 p-4 font-semibold text-red-800">{err}</p>}
      {!d && !err && <p className="text-deep/70">Carregando…</p>}
      {d && <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{kpis.map(([l, v], i) => (
          <div key={l} className={`${card} ${i === 2 ? 'bg-leaf text-white ring-0' : ''}`}><p className={`text-sm font-semibold ${i === 2 ? 'text-cream' : 'text-deep/70'}`}>{l}</p><p className="mt-1 text-2xl font-extrabold">{v}</p></div>))}</div>
        <p className="text-xs text-deep/60">O saldo mostra as vendas confirmadas menos as despesas que você registrou. Não é lucro contábil.</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{shortcuts.map(([to, l, I]) => (
          <Link key={to} to={to} className="flex flex-col items-center gap-2 rounded-3xl bg-sun p-4 text-center font-extrabold"><I size={26} />{l}</Link>))}</div>
        <section className={card}><h2 className="mb-3 font-extrabold">Últimos 7 dias</h2>
          {sales.length + exps.length === 0 ? <p className="py-8 text-center text-deep/60">Ainda não há vendas nem despesas. Registre a primeira venda para ver o gráfico.</p> : <>
            <Bars data={chart} /><p className="mt-2 text-xs"><span className="text-leaf">■</span> Receitas <span className="ml-3 text-sun">■</span> Despesas</p></>}</section>
        <section className={card}><h2 className="mb-3 font-extrabold">Vendas de hoje por origem</h2>
          {[['Presencial', pres], ['WhatsApp', zap]].map(([l, v]) => (
            <div key={l as string} className="mb-3"><div className="flex justify-between text-sm font-bold"><span>{l}</span><span>{brl(v as number)}</span></div>
              <div className="mt-1 h-3 rounded-full bg-cream"><div className={`h-3 rounded-full ${l === 'Presencial' ? 'bg-leaf' : 'bg-rose'}`} style={{ width: `${rev ? ((v as number) / rev) * 100 : 0}%` }} /></div></div>))}</section>
      </>}
    </div>
  )
}
