'use client'
import { useState, useEffect, useCallback } from 'react'
import { loginUser } from '@/lib/supabase'
import { D, C, EQUIPE_ROLES, CLIENT_ROLES } from '@/lib/design'
import type { User } from '@/lib/supabase'
import DirectionApp from '@/app/roles/direction'
import EquipeApp    from '@/app/roles/equipe'
import ClientApp    from '@/app/roles/client'

// Interface à afficher selon le type de compte (repli sur le rôle pour les sessions déjà ouvertes)
function interfaceFor(u: User): 'direction' | 'equipe' | 'client' | null {
  const t = u.type
  if (t === 'direction') return 'direction'
  if (t === 'personnel') return 'equipe'
  if (t === 'boutique' || t === 'societe' || t === 'particulier') return 'client'
  if (u.role === 'gerant') return 'direction'
  if (EQUIPE_ROLES.includes(u.role)) return 'equipe'
  if (CLIENT_ROLES.includes(u.role)) return 'client'
  return null
}

export default function Home() {
  const [user, setUser]     = useState<User | null>(null)
  const [splash, setSplash] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [toast, setToast]   = useState<{ msg: string, type: string } | null>(null)

  const showToast = useCallback((msg: string, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    setMounted(true)
    try { const s = localStorage.getItem('pastryapp_v2_user'); if (s) setUser(JSON.parse(s)) } catch {}
    const t = setTimeout(() => setSplash(false), 3000)
    return () => clearTimeout(t)
  }, [])

  const handleLogin  = (u: User) => { setUser(u); try { localStorage.setItem('pastryapp_v2_user', JSON.stringify(u)) } catch {} }
  const handleLogout = () => { setUser(null); try { localStorage.removeItem('pastryapp_v2_user') } catch {} }

  if (!mounted) return null

  const iface = user ? interfaceFor(user) : null

  return (
    <div style={{ background: D.craie, minHeight: '100vh', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999,
          background: toast.type === 'err'
            ? `linear-gradient(135deg, #7F1D1D, ${C.rouge})`
            : D.gradDark,
          color: 'white', borderRadius: 100,
          padding: '10px 22px', fontSize: 13, fontWeight: 600,
          whiteSpace: 'nowrap',
          boxShadow: `0 8px 24px rgba(0,0,0,.2)`,
          animation: 'slideDown .25s ease',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>{toast.type === 'ok' ? '✓' : '⚠'}</span>
          {toast.msg}
        </div>
      )}

      {splash && <SplashScreen />}
      {!splash && !user          && <LoginPage onLogin={handleLogin} />}
      {!splash && user && iface === 'direction' && <DirectionApp user={user} onLogout={handleLogout} showToast={showToast} />}
      {!splash && user && iface === 'equipe'    && <EquipeApp    user={user} onLogout={handleLogout} showToast={showToast} />}
      {!splash && user && iface === 'client'    && <ClientApp    user={user} onLogout={handleLogout} showToast={showToast} />}
    </div>
  )
}

// ═══ SPLASH ════════════════════════════════════
function SplashScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: D.gradDark,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      animation: 'splashFade 3s ease forwards',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, animation: 'splashLogo 3s ease forwards' }}>
        {/* Logo box */}
        <div style={{
          width: 88, height: 88,
          background: D.gradOr,
          borderRadius: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 12px 32px ${C.or}40`,
        }}>
          <img src="/logo.png" alt="PastryApp" style={{ width: 60, height: 60, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 32, fontWeight: 400, color: '#F5F5F4', letterSpacing: '-0.5px', animation: 'splashText 3s ease .2s forwards' }}>
            Aux Mille Saveurs
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '3px', textTransform: 'uppercase', marginTop: 4, animation: 'splashText 3s ease .4s forwards' }}>
            PastryApp
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══ LOGIN ═════════════════════════════════════
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
    <div style={{ minHeight: '100vh', background: D.craie, display: 'flex', flexDirection: 'column', padding: '0 24px', position: 'relative', overflow: 'hidden' }}>

      {/* Glow décoratif */}
      <div style={{ position: 'absolute', width: 280, height: 280, background: D.orGlow, filter: 'blur(70px)', borderRadius: '50%', top: -80, right: -60, pointerEvents: 'none', zIndex: 0 }} />

      {/* Contenu */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: 56, paddingBottom: 32, position: 'relative', zIndex: 1 }}>

        {/* En-tête */}
        <div>
          {/* Badge localisation */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: D.blanc, border: `1px solid ${D.craieDark}`, padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 500, color: D.gris, boxShadow: D.shadowSm, marginBottom: 20 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            Livry-Gargan
          </div>

          {/* Titre */}
          <h1 className="serif" style={{ fontSize: 36, fontWeight: 400, color: D.ardoise, lineHeight: 1.15, letterSpacing: '-0.5px', marginBottom: 32 }}>
            L'artisanat,<br />
            au <span style={{ background: D.gradOr, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>bout des doigts.</span>
          </h1>

          {/* Card login glassmorphism */}
          <div style={{
            background: D.craieMid,
            backdropFilter: D.blur,
            WebkitBackdropFilter: D.blur,
            border: `1px solid ${D.craieDark}`,
            borderRadius: D.rXl,
            padding: '28px 22px',
            boxShadow: D.shadowXl,
          }}>
            {/* Identifiant */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: D.gris, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '.5px' }}>Identifiant</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: D.grisClair, display: 'flex', alignItems: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
                <input
                  value={login} onChange={e => setLogin(e.target.value)}
                  placeholder="direction" autoCapitalize="none"
                  style={{ width: '100%', background: D.blanc, border: `1px solid ${D.craieDark}`, padding: '14px 16px 14px 42px', borderRadius: D.rMd, fontSize: 14, color: D.ardoise, outline: 'none', boxShadow: D.shadowSm, transition: 'var(--transition)' }}
                  onFocus={e => e.target.style.borderColor = C.or}
                  onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div style={{ marginBottom: 6 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: D.gris, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '.5px' }}>Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: D.grisClair, display: 'flex', alignItems: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={pwd} onChange={e => setPwd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handle()}
                  placeholder="••••••••"
                  style={{ width: '100%', background: D.blanc, border: `1px solid ${D.craieDark}`, padding: '14px 44px 14px 42px', borderRadius: D.rMd, fontSize: 14, color: D.ardoise, outline: 'none', boxShadow: D.shadowSm, transition: 'var(--transition)' }}
                  onFocus={e => e.target.style.borderColor = C.or}
                  onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                />
                <button onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: D.grisClair, cursor: 'pointer', fontSize: 16, padding: 4 }}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Erreur */}
            {err && (
              <div style={{ fontSize: 12, color: C.rouge, background: `${C.rouge}10`, border: `1px solid ${C.rouge}20`, borderRadius: D.rSm, padding: '8px 12px', margin: '12px 0', textAlign: 'center' }}>
                {err}
              </div>
            )}

            {/* Bouton */}
            <button
              onClick={handle} disabled={loading} className={loading ? '' : 'press'}
              style={{
                width: '100%', marginTop: 16,
                background: loading ? D.craieDark : D.gradDark,
                color: 'white', border: 'none',
                padding: '16px', borderRadius: D.rMd,
                fontSize: 15, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: D.shadowMd,
              }}>
              {loading ? 'Connexion...' : 'Se connecter'}
              {!loading && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 11, color: D.grisClair, letterSpacing: '1.5px', textTransform: 'uppercase' as const }}>
          🔒 PastryApp v2.0 — Connexion sécurisée
        </div>
      </div>
    </div>
  )
}
