'use client'
import { D, C, ROLE_LABELS, ROLE_COLORS } from '@/lib/design'
import type { User } from '@/lib/supabase'

// ─── Avatar ─────────────────────────────────────
export function Avatar({ nom, couleur, size = 36 }: { nom: string, couleur: string, size?: number }) {
  const initiales = nom.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: size * .3,
      background: `${couleur}20`,
      border: `1.5px solid ${couleur}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * .34, fontWeight: 700, color: couleur, flexShrink: 0,
    }}>
      {initiales}
    </div>
  )
}

// ─── App Header ────────────────────────────────
export function AppHeader({ user, onLogout, title, right }: {
  user: User, onLogout: () => void, title?: string, right?: React.ReactNode
}) {
  const couleur = ROLE_COLORS[user.role] || C.or
  return (
    <div style={{
      background: D.blanc,
      borderBottom: `1px solid ${D.craieDark}`,
      padding: '12px 18px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 50, flexShrink: 0,
      backdropFilter: D.blur,
      WebkitBackdropFilter: D.blur,
      boxShadow: D.shadowSm,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar nom={user.nom} couleur={couleur} size={34} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: D.ardoise, lineHeight: 1.2 }}>
            {title || user.nom}
          </div>
          <div style={{ fontSize: 10, color: D.grisClair }}>{ROLE_LABELS[user.role]}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {right}
        <span className="serif-i" style={{ fontSize: 14, color: D.or }}>PastryApp</span>
        <button onClick={onLogout} style={{
          background: 'transparent',
          border: `1px solid ${D.craieDark}`,
          color: D.gris, borderRadius: D.rSm,
          padding: '5px 10px', fontSize: 11, cursor: 'pointer',
        }}>Déco.</button>
      </div>
    </div>
  )
}

// ─── Live Pulse ────────────────────────────────
export function LivePulse({ color = C.vert }: { color?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: D.blanc,
      border: `1px solid ${D.craieDark}`,
      padding: '5px 12px', borderRadius: 100,
      fontSize: 11, fontWeight: 600, color: D.gris,
      boxShadow: D.shadowSm,
    }}>
      <div style={{ position: 'relative', width: 6, height: 6 }}>
        <div style={{ width: 6, height: 6, background: color, borderRadius: '50%', position: 'absolute' }} />
        <div style={{ width: 6, height: 6, background: color, borderRadius: '50%', position: 'absolute', animation: 'pulse 2s infinite' }} />
      </div>
      Temps réel
    </div>
  )
}

// ─── Tab Bar ────────────────────────────────────
export type TabItem = { id: string, icon: string, label: string, badge?: number }

export function TabBar({ tabs, active, onChange, color }: {
  tabs: TabItem[], active: string, onChange: (id: string) => void, color?: string
}) {
  const c = color || D.or
  return (
    <div style={{
      display: 'flex',
      background: `var(--bg-card)`,
      backdropFilter: D.blur,
      WebkitBackdropFilter: D.blur,
      borderBottom: `1px solid ${D.craieDark}`,
      overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0,
    }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)} style={{
          flex: 1, minWidth: 62, padding: '10px 6px',
          background: 'none', border: 'none',
          borderBottom: `2px solid ${active === tab.id ? c : 'transparent'}`,
          fontSize: 9.5, fontWeight: active === tab.id ? 700 : 400,
          color: active === tab.id ? c : D.grisClair,
          cursor: 'pointer', position: 'relative', whiteSpace: 'nowrap',
          transition: 'var(--transition)',
        }}>
          <div style={{ fontSize: 19, lineHeight: 1, marginBottom: 3 }}>{tab.icon}</div>
          {tab.label}
          {(tab.badge || 0) > 0 && (
            <span style={{
              position: 'absolute', top: 4, right: '16%',
              background: C.rouge, color: 'white', borderRadius: '50%',
              width: 14, height: 14, fontSize: 8,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, boxShadow: `0 0 0 2px var(--bg-app)`,
            }}>{(tab.badge || 0) > 9 ? '9+' : tab.badge}</span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Card ───────────────────────────────────────
export function Card({ children, style, accent, onClick, glass }: {
  children: React.ReactNode, style?: React.CSSProperties,
  accent?: string, onClick?: () => void, glass?: boolean,
}) {
  return (
    <div onClick={onClick} style={{
      background: glass ? D.craieMid : D.blanc,
      backdropFilter: glass ? D.blur : undefined,
      WebkitBackdropFilter: glass ? D.blur : undefined,
      borderRadius: D.rMd,
      border: `1px solid ${D.craieDark}`,
      overflow: 'hidden', marginBottom: 10,
      borderLeft: accent ? `4px solid ${accent}` : undefined,
      boxShadow: D.shadowMd,
      cursor: onClick ? 'pointer' : undefined,
      transition: 'var(--transition)',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── KPI Card ───────────────────────────────────
export function KpiCard({ label, value, sub, icon, accent }: {
  label: string, value: string | number, sub?: React.ReactNode,
  icon?: string, accent?: boolean,
}) {
  return (
    <div style={{
      background: D.craieMid,
      backdropFilter: D.blur,
      WebkitBackdropFilter: D.blur,
      border: `1px solid ${D.craieDark}`,
      borderRadius: D.rMd,
      padding: '14px 16px',
      boxShadow: D.shadowMd,
      position: 'relative', overflow: 'hidden',
    }}>
      {accent && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: D.gradOr }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: D.gris }}>{label}</span>
        {icon && (
          <div style={{
            width: 28, height: 28, borderRadius: D.rSm,
            background: D.blanc,
            border: `1px solid ${D.craieDark}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}>{icon}</div>
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: D.ardoise, letterSpacing: '-0.5px', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, marginTop: 5, color: D.gris }}>{sub}</div>}
    </div>
  )
}

// ─── Badge ──────────────────────────────────────
type BadgeVariant = 'or' | 'vert' | 'rouge' | 'bleu' | 'orange' | 'gris'
const BADGE: Record<BadgeVariant, { bg: string, color: string }> = {
  or:     { bg: 'var(--status-progress-bg)',  color: 'var(--status-progress)' },
  vert:   { bg: 'var(--status-ready-bg)',     color: 'var(--status-ready)' },
  rouge:  { bg: 'var(--status-baking-bg)',    color: 'var(--status-baking)' },
  bleu:   { bg: 'var(--status-received-bg)',  color: 'var(--status-received)' },
  orange: { bg: 'var(--status-orange-bg)',    color: 'var(--status-orange)' },
  gris:   { bg: 'var(--border-color)',        color: 'var(--text-muted)' },
}

export function Badge({ children, variant = 'gris' }: { children: React.ReactNode, variant?: BadgeVariant }) {
  const s = BADGE[variant]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 100,
      fontSize: 10.5, fontWeight: 700, letterSpacing: '.3px',
      background: s.bg, color: s.color,
      textTransform: 'uppercase' as const,
    }}>
      {children}
    </span>
  )
}

// ─── Section Label ──────────────────────────────
export function SectionLabel({ children, color }: { children: React.ReactNode, color?: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
      textTransform: 'uppercase' as const,
      color: color || D.grisClair,
      padding: '7px 18px 5px',
      background: D.craieMid,
      borderTop: `1px solid ${D.craieDark}`,
      borderBottom: `1px solid ${D.craieDark}`,
    }}>
      {children}
    </div>
  )
}

// ─── Loader ─────────────────────────────────────
export function Loader({ text = 'Chargement...' }: { text?: string }) {
  return (
    <div style={{ padding: 60, textAlign: 'center', color: D.gris }}>
      <div style={{ fontSize: 28, marginBottom: 12, animation: 'pulseSoft 1.5s ease infinite' }}>⏳</div>
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  )
}

// ─── Empty State ────────────────────────────────
export function EmptyState({ icon, title, subtitle, action, onAction }: {
  icon: string, title: string, subtitle?: string,
  action?: string, onAction?: () => void,
}) {
  return (
    <div style={{ padding: '64px 32px', textAlign: 'center', color: D.gris }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: D.ardoise, marginBottom: 8, fontFamily: 'var(--font-title)' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: D.gris, lineHeight: 1.6, marginBottom: 24 }}>{subtitle}</div>}
      {action && onAction && (
        <button onClick={onAction} className="press" style={{
          padding: '11px 22px',
          background: D.gradDark, color: 'white',
          border: 'none', borderRadius: D.rMd,
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          boxShadow: D.shadowMd,
        }}>{action}</button>
      )}
    </div>
  )
}

// ─── Btn Primary ────────────────────────────────
export function BtnPrimary({ children, onClick, color, disabled, loading, fullWidth = true, small, style }: {
  children: React.ReactNode, onClick?: () => void,
  color?: string, disabled?: boolean, loading?: boolean,
  fullWidth?: boolean, small?: boolean, style?: React.CSSProperties,
}) {
  const bg = disabled || loading ? 'var(--border-color)' : (color || D.gradDark)
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={disabled || loading ? '' : 'press'}
      style={{
        width: fullWidth ? '100%' : 'auto',
        padding: small ? '10px 16px' : '14px 20px',
        background: bg,
        color: 'white', border: 'none',
        borderRadius: D.rMd,
        fontSize: small ? 12 : 14, fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? .5 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: disabled ? 'none' : D.shadowMd,
        ...style,
      }}>
      {loading ? <span style={{ animation: 'pulseSoft 1s ease infinite' }}>⏳</span> : null}
      {children}
    </button>
  )
}

// ─── Progress Bar ───────────────────────────────
export function ProgressBar({ value, total, color }: { value: number, total: number, color?: string }) {
  const pct = total === 0 ? 0 : Math.min(100, Math.round((value / total) * 100))
  return (
    <div style={{
      padding: '8px 18px', background: D.blanc,
      borderBottom: `1px solid ${D.craieDark}`,
      display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
    }}>
      <div style={{
        flex: 1, height: 4, background: D.craieDark,
        borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: color || D.gradOr,
          width: `${pct}%`, transition: 'width .5s ease',
        }} />
      </div>
      <div style={{ fontSize: 11, color: D.gris, whiteSpace: 'nowrap', minWidth: 36 }}>
        <span style={{ color: C.vert, fontWeight: 700 }}>{value}</span>/{total}
      </div>
    </div>
  )
}

// ─── Notification Banner ────────────────────────
export function NotifBanner({ icon, text, color }: { icon: string, text: string, color: string }) {
  return (
    <div style={{
      background: `${color}12`,
      borderBottom: `1px solid ${color}20`,
      padding: '9px 18px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
    }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <div style={{ fontSize: 12, color, fontWeight: 600 }}>{text}</div>
    </div>
  )
}

// ─── Pavé Numérique ─────────────────────────────
export function PaveNumerique({ value, onChange, onConfirm, onClose, title, subtitle, color }: {
  value: string, onChange: (v: string) => void,
  onConfirm: () => void, onClose: () => void,
  title: string, subtitle?: string, color?: string,
}) {
  const c = color || C.or
  const pad = (n: string) => onChange(value === '0' ? n : value.length < 4 ? value + n : value)
  const del = () => onChange(value.length <= 1 ? '0' : value.slice(0, -1))

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,13,12,.75)',
      zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      animation: 'fadeIn .15s ease',
    }} onClick={onClose}>
      <div style={{
        background: D.blanc,
        borderRadius: `${D.rXl} ${D.rXl} 0 0`,
        padding: '22px 18px 40px',
        animation: 'slideUpFull .25s cubic-bezier(0.16,1,0.3,1)',
        boxShadow: D.shadowXl,
      }} onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: D.craieDark, borderRadius: 2, margin: '0 auto 20px' }} />
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: D.ardoise }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: D.grisClair, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {/* Display */}
        <div style={{
          background: D.craieMid,
          borderRadius: D.rLg, padding: '14px 20px',
          marginBottom: 16, textAlign: 'center',
          border: `2px solid ${c}`,
          boxShadow: `0 0 0 4px ${c}15`,
        }}>
          <div className="serif" style={{ fontSize: 56, fontWeight: 300, color: D.ardoise, lineHeight: 1 }}>
            {value || '0'}
          </div>
          <div style={{ fontSize: 11, color: D.gris, marginTop: 4 }}>pièces</div>
        </div>
        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
          {['1','2','3','4','5','6','7','8','9'].map(n => (
            <button key={n} onClick={() => pad(n)} className="press" style={{
              height: 58, borderRadius: D.rMd,
              background: D.craieMid,
              border: `1px solid ${D.craieDark}`,
              color: D.ardoise, fontSize: 22, cursor: 'pointer',
              boxShadow: D.shadowSm,
            }}>{n}</button>
          ))}
          <button onClick={() => onChange('0')} style={{ height: 58, borderRadius: D.rMd, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.gris, fontSize: 12, cursor: 'pointer' }}>Effacer</button>
          <button onClick={() => pad('0')} className="press" style={{ height: 58, borderRadius: D.rMd, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.ardoise, fontSize: 22, cursor: 'pointer' }}>0</button>
          <button onClick={del} className="press" style={{ height: 58, borderRadius: D.rMd, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.ardoise, fontSize: 20, cursor: 'pointer' }}>⌫</button>
        </div>
        <BtnPrimary onClick={onConfirm} color={c}>Confirmer — {value || 0} pcs ✓</BtnPrimary>
      </div>
    </div>
  )
}

// ─── Send Bar ───────────────────────────────────
export function SendBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      padding: '14px 18px 36px',
      background: `linear-gradient(to top, var(--bg-app) 60%, transparent)`,
      zIndex: 30,
    }}>
      {children}
    </div>
  )
}

// ─── Success Screen ─────────────────────────────
export function SuccessScreen({ title, subtitle, info, onReset, resetLabel = 'Nouvelle commande' }: {
  title: string, subtitle?: string, info?: string,
  onReset: () => void, resetLabel?: string,
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 28px', textAlign: 'center',
      minHeight: 420, animation: 'scaleIn .3s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <div style={{
        width: 84, height: 84, borderRadius: '50%',
        background: `${C.vert}15`,
        border: `2px solid ${C.vert}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36, margin: '0 auto 22px',
        boxShadow: `0 0 0 8px ${C.vert}08`,
      }}>✓</div>
      <div className="serif" style={{ fontSize: 28, fontWeight: 400, color: D.ardoise, marginBottom: 8 }}>{title}</div>
      {subtitle && <div style={{ color: D.gris, fontSize: 14, marginBottom: 6 }}>{subtitle}</div>}
      {info && <div style={{ fontSize: 12, color: D.grisClair, marginBottom: 32 }}>{info}</div>}
      <button onClick={onReset} className="press" style={{
        padding: '11px 26px',
        background: 'transparent',
        border: `1.5px solid ${D.craieDark}`,
        color: D.ardoise, borderRadius: D.rMd,
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        boxShadow: D.shadowSm,
      }}>{resetLabel}</button>
    </div>
  )
}
