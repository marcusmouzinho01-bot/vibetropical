import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { Home, ShoppingBasket, MessageCircle, Package, Boxes, Wallet, Users, BarChart3, Settings, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BRAND } from '../brand'

export const NAV = [
  { to: '/', label: 'Início', icon: Home, stage: 1 },
  { to: '/vendas', label: 'Vendas', icon: ShoppingBasket, stage: 2 },
  { to: '/pedidos', label: 'Pedidos', icon: MessageCircle, stage: 3 },
  { to: '/produtos', label: 'Produtos', icon: Package, stage: 2 },
  { to: '/estoque', label: 'Estoque', icon: Boxes, stage: 5 },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet, stage: 4 },
  { to: '/clientes', label: 'Clientes', icon: Users, stage: 5 },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, stage: 6 },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, stage: 6 },
]
export type Ctx = { name: string }

export default function Layout() {
  const [profile, setProfile] = useState<{ full_name: string | null } | null | undefined>(undefined)
  useEffect(() => {
    supabase.from('profiles').select('full_name').maybeSingle().then(({ data }) => setProfile(data))
  }, [])
  const out = () => supabase.auth.signOut()
  if (profile === undefined) return null
  if (profile === null) return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div><p className="text-xl font-bold">Esta conta não tem acesso ao {BRAND}.</p>
      <button onClick={out} className="mt-4 rounded-2xl bg-leaf px-6 py-3 font-bold text-white">Sair</button></div>
    </main>)
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-2xl px-4 py-3 font-bold ${isActive ? 'bg-sun text-deep' : 'text-cream hover:bg-white/10'}`
  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-deep p-4 lg:flex">
        <div className="px-2 pb-4 text-center"><div className="font-script text-6xl leading-none text-cream">Vibe</div>
          <div className="text-sm tracking-[0.4em] text-sun">TROPICAL</div></div>
        <nav className="flex flex-1 flex-col gap-1">{NAV.map(n => <NavLink key={n.to} to={n.to} end={n.to === '/'} className={link}><n.icon size={20} />{n.label}</NavLink>)}</nav>
        <button onClick={out} className="flex items-center gap-3 px-4 py-3 font-bold text-cream/80"><LogOut size={20} />Sair</button>
      </aside>
      <div className="flex-1 pb-24 lg:pb-0">
        <header className="flex items-center justify-between bg-gradient-to-r from-deep to-leaf px-5 py-3 lg:hidden">
          <span className="font-script text-4xl text-cream">Vibe <span className="font-sans text-xs tracking-[0.3em] text-sun">TROPICAL</span></span>
          <Link to="/configuracoes" aria-label="Configurações" className="text-cream"><Settings /></Link>
        </header>
        <div className="mx-auto max-w-5xl p-4 lg:p-8"><Outlet context={{ name: profile.full_name ?? '' } satisfies Ctx} /></div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-10 flex gap-1 overflow-x-auto bg-deep p-2 lg:hidden">
        {NAV.map(n => <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-bold ${isActive ? 'bg-sun text-deep' : 'text-cream'}`}><n.icon size={22} />{n.label}</NavLink>)}
      </nav>
    </div>
  )
}
