import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Layout, { NAV } from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Soon from './pages/Soon'
import Vendas from './pages/Vendas'
import Produtos from './pages/Produtos'
import Pedidos from './pages/Pedidos'
import Financeiro from './pages/Financeiro'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!ready) return <div className="grid min-h-screen place-items-center font-script text-5xl text-leaf">Vibe Tropical</div>
  if (!session) return <Login />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="vendas" element={<Vendas />} />
        <Route path="produtos" element={<Produtos />} />
        <Route path="pedidos" element={<Pedidos />} />
        <Route path="financeiro" element={<Financeiro />} />
        {NAV.slice(1).filter(n => n.to !== '/vendas' && n.to !== '/produtos' && n.to !== '/pedidos' && n.to !== '/financeiro').map(n => <Route key={n.to} path={n.to} element={<Soon title={n.label} stage={n.stage} />} />)}
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
