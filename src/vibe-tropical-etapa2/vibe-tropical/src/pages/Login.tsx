import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { BRAND } from '../brand'
export default function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  async function enter() {
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setErr('E-mail ou senha incorretos. Confira e tente de novo.')
    setBusy(false)
  }
  const field = 'w-full rounded-2xl border border-deep/20 bg-white px-4 py-3.5 text-base'
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-deep to-leaf p-5">
      <div className="w-full max-w-sm rounded-[2rem] bg-[#FBF7EA] p-7 shadow-2xl">
        <img src="/logo.png" alt={BRAND} className="mx-auto h-40 w-40 rounded-full object-cover" />
        <div className="mt-3 flex flex-col gap-3">
          <input className={field} type="email" placeholder="E-mail" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className={field} type="password" placeholder="Senha" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && enter()} />
          {err && <p role="alert" className="text-sm font-semibold text-red-700">{err}</p>}
          <button onClick={enter} disabled={busy || !email || !password} className="rounded-2xl bg-leaf py-3.5 text-lg font-extrabold text-white disabled:opacity-50">{busy ? 'Entrando…' : 'Entrar'}</button>
        </div>
      </div>
    </main>
  )
}
