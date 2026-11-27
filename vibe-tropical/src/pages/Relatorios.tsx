import { useEffect, useState } from 'react'
import { FileDown, FileSpreadsheet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl, dayKey } from '../brand'
import { PRESETS, range } from './Financeiro'

type SI = { product_name: string; size_ml: number; quantity: number; unit_price: number }
type Sale = { sale_number: number; created_at: string; origin: string; payment_method: string; total: number; delivery_fee: number; sale_items: SI[] }
type Exp = { description: string; amount: number; expense_date: string; payment_method: string | null; expense_categories: { name: string } | null }
type Mov = { kind: string; quantity: number; created_at: string; product_variants: { size_ml: number; products: { name: string } } | null }
type Data = { sales: Sale[]; exps: Exp[]; movs: Mov[]; deliveries: number; fees: number }
const PAYL: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'Pix', credito: 'Crédito', debito: 'Débito' }
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const field = 'rounded-2xl border border-deep/20 bg-white px-3 py-2.5'
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

export default function Relatorios() {
  const [preset, setPreset] = useState('mes')
  const [cf, setCf] = useState(dayKey(new Date())); const [ct, setCt] = useState(dayKey(new Date()))
  const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState('')
  const [from, to] = range(preset, cf, ct)

  useEffect(() => {
    if (from > to) return
    setD(null); setErr('')
    const a = new Date(from + 'T00:00:00').toISOString(), bd = new Date(to + 'T00:00:00'); bd.setDate(bd.getDate() + 1); const b = bd.toISOString()
    Promise.all([
      supabase.from('sales').select('sale_number,created_at,origin,payment_method,total,delivery_fee,sale_items(product_name,size_ml,quantity,unit_price)').eq('status', 'confirmada').gte('created_at', a).lt('created_at', b).order('created_at'),
      supabase.from('expenses').select('description,amount,expense_date,payment_method,expense_categories(name)').gte('expense_date', from).lte('expense_date', to).order('expense_date'),
      supabase.from('stock_movements').select('kind,quantity,created_at,product_variants(size_ml,products(name))').in('kind', ['producao', 'perda', 'descarte']).gte('created_at', a).lt('created_at', b).order('created_at'),
      supabase.from('orders').select('delivery_fee').eq('status', 'entregue').eq('service_type', 'entrega').gte('created_at', a).lt('created_at', b)])
      .then(([s, e, m, o]) => {
        if (s.error || e.error || m.error || o.error) return setErr('Não foi possível carregar o relatório.')
        const num = (x: any) => Number(x)
        setD({ sales: (s.data as any[]).map(x => ({ ...x, total: num(x.total), delivery_fee: num(x.delivery_fee), sale_items: x.sale_items.map((i: any) => ({ ...i, unit_price: num(i.unit_price) })) })), exps: (e.data as any[]).map(x => ({ ...x, amount: num(x.amount) })), movs: m.data as any[],
          deliveries: (o.data as any[]).length, fees: sum((o.data as any[]).map(x => num(x.delivery_fee))) })
      })
  }, [from, to])

  const sales = d?.sales ?? [], exps = d?.exps ?? [], movs = d?.movs ?? []
  const rev = sum(sales.map(s => s.total)), exp = sum(exps.map(e => e.amount))
  const group = <T,>(xs: T[], key: (x: T) => string, val: (x: T) => number) => { const m = new Map<string, number>(); xs.forEach(x => m.set(key(x), (m.get(key(x)) ?? 0) + val(x))); return [...m.entries()].sort((a, b) => b[1] - a[1]) }
  const items = sales.flatMap(s => s.sale_items)
  const top = (() => { const m = new Map<string, [number, number]>(); items.forEach(i => { const k = `${i.product_name} ${i.size_ml} ml`; const c = m.get(k) ?? [0, 0]; m.set(k, [c[0] + i.quantity, c[1] + i.quantity * i.unit_price]) }); return [...m.entries()].sort((a, b) => b[1][0] - a[1][0]) })()
  const byPay = group(sales, s => PAYL[s.payment_method], s => s.total)
  const byCat = group(exps, e => e.expense_categories?.name ?? 'Sem categoria', e => e.amount)
  const mv = (k: string) => sum(movs.filter(m => m.kind === k).map(m => m.quantity))
  const pres = sum(sales.filter(s => s.origin === 'presencial').map(s => s.total)), zap = rev - pres

  async function excel() {
    if (!d) return
    const X = await import('xlsx'); const wb = X.utils.book_new()
    const add = (n: string, rows: (string | number)[][]) => X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(rows), n)
    add('Resumo', [['Vibe Tropical — Relatório'], ['Período', `${fmt(from)} a ${fmt(to)}`], [], ['Faturamento', rev], ['Despesas', exp], ['Saldo após despesas', rev - exp], ['Vendas confirmadas', sales.length], ['Presencial', pres], ['WhatsApp', zap], ['Entregas realizadas', d.deliveries], ['Taxas de entrega', d.fees], ['Produzido (un.)', mv('producao')], ['Perdas (un.)', mv('perda')], ['Descartes (un.)', mv('descarte')], [], ['Forma de pagamento', 'Total'], ...byPay])
    add('Vendas', [['Nº', 'Data', 'Origem', 'Pagamento', 'Total'], ...sales.map(s => [s.sale_number, new Date(s.created_at).toLocaleString('pt-BR'), s.origin === 'presencial' ? 'Presencial' : 'WhatsApp', PAYL[s.payment_method], s.total])])
    add('Despesas', [['Data', 'Descrição', 'Categoria', 'Pagamento', 'Valor'], ...exps.map(e => [fmt(e.expense_date), e.description, e.expense_categories?.name ?? '', e.payment_method ? PAYL[e.payment_method] : '', e.amount])])
    add('Mais vendidos', [['Produto', 'Quantidade', 'Valor'], ...top.map(([k, v]) => [k, v[0], v[1]])])
    add('Estoque', [['Data', 'Tipo', 'Produto', 'Quantidade'], ...movs.map(m => [new Date(m.created_at).toLocaleString('pt-BR'), m.kind, `${m.product_variants?.products.name} ${m.product_variants?.size_ml} ml`, m.quantity])])
    X.writeFile(wb, `vibe-tropical-relatorio-${from}-a-${to}.xlsx`)
  }

  const card = 'rounded-3xl bg-white p-5 ring-1 ring-deep/10 break-inside-avoid'
  const Rows = ({ rows }: { rows: [string, string][] }) => <>{rows.map(([l, v]) => <div key={l} className="flex justify-between py-1"><span>{l}</span><span className="font-bold">{v}</span></div>)}{rows.length === 0 && <p className="text-deep/60">Sem dados no período.</p>}</>
  return (
    <div className="space-y-4">
      <div className="hidden print:block"><p className="font-script text-5xl text-leaf">Vibe <span className="font-sans text-sm tracking-[0.4em] text-deep">TROPICAL</span></p><p>Relatório de {fmt(from)} a {fmt(to)}</p></div>
      <h1 className="font-script text-5xl text-leaf print:hidden">Relatórios</h1>
      <div className="space-y-2 print:hidden">
        <div className="flex flex-wrap gap-2">{PRESETS.map(([k, l]) => <button key={k} onClick={() => setPreset(k)} className={`rounded-full px-4 py-2 font-bold ${preset === k ? 'bg-deep text-white' : 'bg-cream'}`}>{l}</button>)}</div>
        {preset === 'custom' && <div className="flex gap-2"><input type="date" aria-label="De" className={field} value={cf} max={ct} onChange={e => setCf(e.target.value)} /><input type="date" aria-label="Até" className={field} value={ct} min={cf} onChange={e => setCt(e.target.value)} /></div>}
        <div className="flex gap-2"><button onClick={() => window.print()} disabled={!d} className="flex items-center gap-2 rounded-2xl bg-sun px-4 py-3 font-extrabold disabled:opacity-40"><FileDown size={20} />Salvar em PDF</button>
          <button onClick={excel} disabled={!d} className="flex items-center gap-2 rounded-2xl bg-leaf px-4 py-3 font-extrabold text-white disabled:opacity-40"><FileSpreadsheet size={20} />Baixar Excel</button></div></div>
      {err && <p role="alert" className="rounded-2xl bg-red-50 p-3 font-semibold text-red-800">{err}</p>}
      {!d && !err && <p>Carregando…</p>}
      {d && <div className="grid gap-3 sm:grid-cols-2">
        <section className={card}><h2 className="mb-2 font-extrabold">Resumo</h2><Rows rows={[['Faturamento', brl(rev)], ['Despesas', brl(exp)], ['Saldo após despesas', brl(rev - exp)], ['Vendas confirmadas', String(sales.length)]]} /><p className="mt-2 text-xs text-deep/60">Saldo = vendas confirmadas menos despesas registradas. Não é lucro contábil.</p></section>
        <section className={card}><h2 className="mb-2 font-extrabold">Por origem</h2><Rows rows={[['Presencial', brl(pres)], ['WhatsApp', brl(zap)], ['Entregas realizadas', String(d.deliveries)], ['Taxas de entrega', brl(d.fees)]]} /></section>
        <section className={card}><h2 className="mb-2 font-extrabold">Formas de pagamento</h2><Rows rows={byPay.map(([k, v]) => [k, brl(v)])} /></section>
        <section className={card}><h2 className="mb-2 font-extrabold">Produtos mais vendidos</h2><Rows rows={top.map(([k, v]) => [`${k} (${v[0]} un.)`, brl(v[1])])} /></section>
        <section className={card}><h2 className="mb-2 font-extrabold">Despesas por categoria</h2><Rows rows={byCat.map(([k, v]) => [k, brl(v)])} /></section>
        <section className={card}><h2 className="mb-2 font-extrabold">Produção e perdas</h2><Rows rows={[['Produzido', `${mv('producao')} un.`], ['Perdas', `${mv('perda')} un.`], ['Descartes', `${mv('descarte')} un.`]]} /></section>
      </div>}
    </div>)
}
