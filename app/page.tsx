'use client'
import { useState, useEffect, useCallback } from 'react'
import { loginUser } from '@/lib/supabase'
import { D, EQUIPE_ROLES, CLIENT_ROLES } from '@/lib/design'
import type { User } from '@/lib/supabase'
import DirectionApp from '@/app/roles/direction'
import EquipeApp    from '@/app/roles/equipe'
import ClientApp    from '@/app/roles/client'

export default function Home() {
  const [user, setUser]     = useState<User | null>(null)
  const [splash, setSplash] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [toast, setToast]   = useState<{ msg: string, type: string } | null>(null)

  const showToast = useCallback((msg: string, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    setMounted(true)
    try { const s = localStorage.getItem('pastryapp_v2_user'); if (s) setUser(JSON.parse(s)) } catch {}
    const t = setTimeout(() => setSplash(false), 3000)
    return () => clearTimeout(t)
  }, [])

  const handleLogin = (u: User) => {
    setUser(u)
    try { localStorage.setItem('pastryapp_v2_user', JSON.stringify(u)) } catch {}
  }

  const handleLogout = () => {
    setUser(null)
    try { localStorage.removeItem('pastryapp_v2_user') } catch {}
  }

  if (!mounted) return null

  const isDirection = user?.role === 'gerant'
  const isEquipe    = user ? EQUIPE_ROLES.includes(user.role) : false
  const isClient    = user ? CLIENT_ROLES.includes(user.role) : false

  return (
    <div style={{ background: D.craie, minHeight: '100vh', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, background: toast.type === 'err' ? 'var(--rouge)' : 'var(--ardoise)',
          color: 'white', borderRadius: 20, padding: '10px 20px',
          fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,.2)', animation: 'slideDown .2s ease',
        }}>
          {toast.type === 'ok' ? '✓ ' : '⚠ '}{toast.msg}
        </div>
      )}

      {splash && <SplashScreen />}
      {!splash && !user && <LoginPage onLogin={handleLogin} />}
      {!splash && user && isDirection && <DirectionApp user={user} onLogout={handleLogout} showToast={showToast} />}
      {!splash && user && isEquipe    && <EquipeApp    user={user} onLogout={handleLogout} showToast={showToast} />}
      {!splash && user && isClient    && <ClientApp    user={user} onLogout={handleLogout} showToast={showToast} />}
    </div>
  )
}

// ─── Splash ───────────────────────────────────
function SplashScreen() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: D.craie, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1000, gap: 12 }}>
      <img src="/logo.png" alt="PastryApp" style={{ width: 160, height: 160, objectFit: 'contain', animation: 'splashLogo 3s ease forwards' }} />
      <div className="serif" style={{ fontSize: 38, fontWeight: 300, color: D.ardoise, letterSpacing: '-1px', animation: 'splashText 3s ease .2s forwards' }}>PastryApp</div>
      <div className="serif-i" style={{ fontSize: 18, color: D.or, animation: 'splashText 3s ease .3s forwards' }}>Aux Mille Saveurs</div>
      <div style={{ height: 2, background: D.or, borderRadius: 1, animation: 'splashLine 3s ease .4s forwards' }} />
      <div style={{ fontSize: 10, color: D.grisClair, letterSpacing: '2.5px', textTransform: 'uppercase', animation: 'splashText 3s ease .5s forwards' }}>
        Boulangerie · Pâtisserie · Artisanale
      </div>
    </div>
  )
}

// ─── Login ────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (u: User) => void }) {
  const [login, setLogin]     = useState('')
  const [pwd, setPwd]         = useState('')
  const [err, setErr]         = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  const handle = async () => {
    if (!login || !pwd) { setErr('Remplis tous les champs'); return }
    setErr(''); setLoading(true)
    const user = await loginUser(login.trim(), pwd)
    setLoading(false)
    if (user) onLogin(user)
    else setErr('Identifiant ou mot de passe incorrect')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '0 24px', background: D.craie }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 48, paddingBottom: 24 }}>
        <img src="/logo.png" alt="" style={{ width: 130, height: 130, objectFit: 'contain', marginBottom: 16 }} />
        <div className="serif" style={{ fontSize: 38, fontWeight: 300, color: D.ardoise, letterSpacing: '-1px', textAlign: 'center', lineHeight: 1 }}>PastryApp</div>
        <div style={{ fontSize: 12, color: D.grisClair, marginTop: 8 }}>
          by <span className="serif-i" style={{ fontSize: 16, color: D.or }}>Aux Mille Saveurs</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0', width: '100%' }}>
          <div style={{ flex: 1, height: 1, background: D.craieDark }} />
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: D.or }} />
          <div style={{ flex: 1, height: 1, background: D.craieDark }} />
        </div>
        <div style={{ width: '100%' }}>
          <input value={login} onChange={e => setLogin(e.target.value)} placeholder="Identifiant" autoCapitalize="none" style={inputStyle} />
          <div style={{ position: 'relative', marginBottom: 4 }}>
            <input type={showPwd ? 'text' : 'password'} value={pwd} onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} placeholder="Mot de passe" style={{ ...inputStyle, marginBottom: 0, paddingRight: 44 }} />
            <button onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: D.gris, cursor: 'pointer', fontSize: 18 }}>
              {showPwd ? '🙈' : '👁️'}
            </button>
          </div>
          {err && <div style={{ color: 'var(--rouge)', fontSize: 12, margin: '8px 0', padding: '8px 12px', background: 'var(--rougeBg)', borderRadius: 8, textAlign: 'center' }}>{err}</div>}
          <button onClick={handle} disabled={loading} className={loading ? '' : 'press'} style={{ width: '100%', padding: '15px 20px', background: loading ? D.gris : D.ardoise, color: 'white', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 12 }}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </div>
      </div>
      <div style={{ paddingBottom: 32, textAlign: 'center', fontSize: 10, color: D.grisClair, letterSpacing: '2px', textTransform: 'uppercase' }}>
        🔒 Connexion sécurisée
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 16px',
  background: D.blanc, border: `1.5px solid ${D.craieDark}`,
  borderRadius: 12, fontSize: 14, color: D.ardoise,
  outline: 'none', marginBottom: 10,
}
