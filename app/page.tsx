'use client'
import { useState, useEffect, useCallback } from 'react'
import { loginUser } from '@/lib/supabase'
import { D, ROLE_COLORS, ROLE_LABELS } from '@/lib/design'
import type { User } from '@/lib/supabase'
import DirectionApp from '@/app/roles/direction'
import PatissierApp from '@/app/roles/patissier'
import BoulangerApp from '@/app/roles/boulanger'

// ═══════════════════════════════════════════════
// PAGE PRINCIPALE — Routage par rôle
// ═══════════════════════════════════════════════
export default function Home() {
  const [user, setUser]       = useState<User | null>(null)
  const [splash, setSplash]   = useState(true)
  const [mounted, setMounted] = useState(false)
  const [toast, setToast]     = useState<{msg: string, type: string} | null>(null)

  const showToast = useCallback((msg: string, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    setMounted(true)
    // Restaurer session
    try {
      const saved = localStorage.getItem('pastryapp_v2_user')
      if (saved) setUser(JSON.parse(saved))
    } catch {}
    // Splash screen 3 secondes
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

  return (
    <div style={{
      background: D.craie,
      minHeight: '100vh',
      maxWidth: 480,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, background: toast.type === 'err' ? D.rouge : D.ardoise,
          color: 'white', borderRadius: 20, padding: '10px 20px',
          fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,.15)',
          animation: 'slideUp .2s ease',
        }}>
          {toast.type === 'ok' ? '✓ ' : '⚠ '}{toast.msg}
        </div>
      )}

      {/* Splash Screen */}
      {splash && <SplashScreen />}

      {/* App */}
      {!splash && !user && (
        <LoginPage onLogin={handleLogin} />
      )}
      {!splash && user && user.role === 'gerant' && (
        <DirectionApp user={user} onLogout={handleLogout} showToast={showToast} />
      )}
      {!splash && user && user.role === 'patissier' && (
        <PatissierApp user={user} onLogout={handleLogout} showToast={showToast} />
      )}
      {!splash && user && ['boulanger_livry','boulanger_villemomble'].includes(user.role) && (
        <BoulangerApp user={user} onLogout={handleLogout} showToast={showToast} />
      )}
      {!splash && user && !['gerant','patissier','boulanger_livry','boulanger_villemomble'].includes(user.role) && (
        <WelcomeScreen user={user} onLogout={handleLogout} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// SPLASH SCREEN
// ═══════════════════════════════════════════════
function SplashScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: D.craie,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, gap: 12,
    }}>
      <img
        src="/logo.png"
        alt="PastryApp"
        style={{
          width: 160, height: 160, objectFit: 'contain',
          animation: 'splashLogo 3s ease forwards',
        }}
      />
      <div className="serif" style={{
        fontSize: 36, fontWeight: 300, color: D.ardoise,
        letterSpacing: '-1px', lineHeight: 1,
        animation: 'splashText 3s ease .2s forwards',
      }}>
        PastryApp
      </div>
      <div className="serif-i" style={{
        fontSize: 17, color: D.or,
        animation: 'splashText 3s ease .3s forwards',
      }}>
        Aux Mille Saveurs
      </div>
      <div style={{
        height: 2, background: D.or, borderRadius: 1,
        animation: 'splashLine 3s ease .4s forwards',
      }} />
      <div style={{
        fontSize: 10, color: D.grisClair,
        letterSpacing: '2px', textTransform: 'uppercase',
        animation: 'splashText 3s ease .5s forwards',
      }}>
        Gestion · Boulangerie · Pâtisserie
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// PAGE DE CONNEXION
// ═══════════════════════════════════════════════
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
    <div style={{
      minHeight: '100vh', display: 'flex',
      flexDirection: 'column', padding: '0 24px',
      background: D.craie,
    }}>
      {/* Logo + titre */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingTop: 48, paddingBottom: 24,
      }}>
        <img src="/logo.png" alt="PastryApp"
          style={{ width: 140, height: 140, objectFit: 'contain', marginBottom: 16 }}
        />
        <div className="serif" style={{
          fontSize: 36, fontWeight: 300, color: D.ardoise,
          letterSpacing: '-1px', textAlign: 'center', lineHeight: 1,
        }}>
          PastryApp
        </div>
        <div style={{ fontSize: 12, color: D.grisClair, marginTop: 8 }}>
          by <span className="serif-i" style={{ fontSize: 16, color: D.or }}>Aux Mille Saveurs</span>
        </div>
        <div style={{ fontSize: 10, color: D.grisClair, letterSpacing: '2px', textTransform: 'uppercase', marginTop: 4, marginBottom: 32 }}>
          Gestion · Boulangerie · Pâtisserie
        </div>

        {/* Séparateur */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, width: '100%' }}>
          <div style={{ flex: 1, height: 1, background: D.craieDark }} />
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: D.or }} />
          <div style={{ flex: 1, height: 1, background: D.craieDark }} />
        </div>

        {/* Formulaire */}
        <div style={{ width: '100%' }}>
          <input
            value={login}
            onChange={e => setLogin(e.target.value)}
            placeholder="Identifiant"
            autoCapitalize="none"
            style={inputStyle}
          />
          <div style={{ position: 'relative', marginBottom: 4 }}>
            <input
              type={showPwd ? 'text' : 'password'}
              value={pwd}
              onChange={e => setPwd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handle()}
              placeholder="Mot de passe"
              style={{ ...inputStyle, marginBottom: 0, paddingRight: 44 }}
            />
            <button
              onClick={() => setShowPwd(!showPwd)}
              style={{
                position: 'absolute', right: 12, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none',
                color: D.gris, cursor: 'pointer', fontSize: 16,
              }}>
              {showPwd ? '🙈' : '👁️'}
            </button>
          </div>

          {err && (
            <div style={{
              color: D.rouge, fontSize: 12, margin: '8px 0',
              padding: '8px 12px', background: D.rougeBg,
              borderRadius: 8, textAlign: 'center',
            }}>
              {err}
            </div>
          )}

          <button
            onClick={handle}
            disabled={loading}
            className="press"
            style={{
              width: '100%', padding: '15px 20px',
              background: loading ? D.gris : D.ardoise,
              color: 'white', border: 'none',
              borderRadius: 14, fontSize: 15, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 12,
            }}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ paddingBottom: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: D.grisClair, letterSpacing: '2px', textTransform: 'uppercase' }}>
          🔒 Connexion sécurisée
        </div>
      </div>
    </div>
  )
}

// ─── Styles communs ───────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  background: 'white',
  border: `1.5px solid ${D.craieDark}`,
  borderRadius: 12,
  fontSize: 14,
  color: D.ardoise,
  outline: 'none',
  marginBottom: 10,
}


// ═══════════════════════════════════════════════
// ÉCRAN D'ACCUEIL TEMPORAIRE (en attendant les interfaces)
// ═══════════════════════════════════════════════
function WelcomeScreen({ user, onLogout }: { user: User, onLogout: () => void }) {
  const color = user.couleur || D.or
  const initiales = user.nom.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: D.craie }}>
      {/* Header */}
      <div style={{
        background: 'white', borderBottom: `1.5px solid ${D.craieDark}`,
        padding: '12px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${color}18`, border: `1.5px solid ${color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color,
          }}>
            {initiales}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: D.ardoise }}>{user.nom}</div>
            <div style={{ fontSize: 10, color: D.grisClair, textTransform: 'capitalize' }}>{user.role}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="serif-i" style={{ fontSize: 15, color: D.or }}>PastryApp</span>
          <button onClick={onLogout} style={{
            background: 'transparent', border: `1px solid ${D.craieDark}`,
            color: D.gris, borderRadius: 8, padding: '4px 10px',
            fontSize: 11, cursor: 'pointer',
          }}>Déco.</button>
        </div>
      </div>

      {/* Corps */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <img src="/logo.png" alt="" style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: 20 }} />
        <div className="serif" style={{ fontSize: 28, fontWeight: 300, color: D.ardoise, marginBottom: 8, textAlign: 'center' }}>
          Bonjour, {user.nom} !
        </div>
        <div style={{ fontSize: 13, color: D.gris, textAlign: 'center', marginBottom: 32 }}>
          Connexion réussie ✓
        </div>
        <div style={{
          background: D.vertBg, border: `1px solid ${D.vert}30`,
          borderRadius: 12, padding: '14px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, color: D.vert, fontWeight: 600 }}>✅ Base de données connectée</div>
          <div style={{ fontSize: 11, color: D.gris, marginTop: 4 }}>Rôle : {user.role}</div>
        </div>
      </div>
    </div>
  )
}
