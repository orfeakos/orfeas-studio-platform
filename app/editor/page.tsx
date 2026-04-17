'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function EditorPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
      }
      setLoading(false)
    }
    checkUser()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>Loading...</div>

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 16px',background:'#111',color:'#fff'}}>
        <h1 style={{fontSize:'14px',fontWeight:'700'}}>Orfeas Studio</h1>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <span style={{fontSize:'12px',color:'#aaa'}}>{user?.email}</span>
          <button onClick={handleLogout}
            style={{padding:'4px 12px',background:'#333',color:'#fff',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'12px'}}>
            Έξοδος
          </button>
        </div>
      </div>
      <iframe
        src="/orfeas_studio_v4-9.html"
        style={{flex:1,border:'none',width:'100%'}}
      />
    </div>
  )
}