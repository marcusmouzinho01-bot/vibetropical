import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Layout, { NAV } from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Soon from './pages/Soon'

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
        {NAV.slice(1).map(n => <Route key={n.to} path={n.to} element={<Soon title={n.label} stage={n.stage} />} />)}
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
