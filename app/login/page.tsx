'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Λάθος email ή password')
    } else {
      router.push('/editor')
    }
  }

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:'12px'}}>
      <h1 style={{fontSize:'24px',fontWeight:'700'}}>Orfeas Studio</h1>
      <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}
        style={{padding:'10px',border:'1px solid #ccc',borderRadius:'8px',width:'280px'}}/>
      <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)}
        style={{padding:'10px',border:'1px solid #ccc',borderRadius:'8px',width:'280px'}}/>
      {error && <p style={{color:'red',fontSize:'13px'}}>{error}</p>}
      <button onClick={handleLogin}
        style={{padding:'10px 24px',background:'#111',color:'#fff',border:'none',borderRadius:'8px',cursor:'pointer',width:'280px'}}>
        Σύνδεση
      </button>
    </div>
  )
}