'use client'
import { D, ROLE_LABELS, ROLE_COLORS } from '@/lib/design'
import type { User } from '@/lib/supabase'

// ─── Avatar ───────────────────────────────────
export function Avatar({ nom, couleur, size = 36 }: { nom: string, couleur: string, size?: number }) {
  const initiales = nom.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: size * .28,
      background: `${couleur}20`, border: `1.5px solid ${couleur}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * .33, fontWeight: 700, color: couleur, flexShrink: 0,
    }}>
      {initiales}
    </div>
  )
}

// ─── Header ───────────────────────────────────
export function AppHeader({ user, onLogout, title, right }: {
  user: User, onLogout: () => void, title?: string, right?: React.ReactNode
}) {
  const couleur = ROLE_COLORS[user.role] || D.or
  return (
    <div style={{
      background: D.blanc, borderBottom: `1px solid ${D.craieDark}`,
      padding: '10px 16px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar nom={user.nom} couleur={couleur} size={34} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: D.ardoise, lineHeight: 1.2 }}>
            {title || user.nom}
          </div>
          <div style={{ fontSize: 10, color: D.grisClair }}>
            {ROLE_LABELS[user.role] || user.role}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {right}
        <span className="serif-i" style={{ fontSize: 14, color: D.or }}>PastryApp</span>
        <button onClick={onLogout} style={{
          background: 'transparent', border: `1px solid ${D.craieDark}`,
          color: D.gris, borderRadius: 8, padding: '5px 10px',
          fontSize: 11, cursor: 'pointer',
        }}>Déco.</button>
      </div>
    </div>
  )
}

// ─── Tab Bar ──────────────────────────────────
export type TabItem = { id: string, icon: string, label: string, badge?: number }

export function TabBar({ tabs, active, onChange, color }: {
  tabs: TabItem[], active: string, onChange: (id: string) => void, color?: string
}) {
  const c = color || D.or
  return (
    <div style={{
      display: 'flex', background: D.blanc,
      borderBottom: `1px solid ${D.craieDark}`,
      overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0,
    }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)} style={{
          flex: 1, minWidth: 60, padding: '10px 8px',
          background: 'none', border: 'none',
          borderBottom: `2px solid ${active === tab.id ? c : 'transparent'}`,
          fontSize: 10, fontWeight: active === tab.id ? 700 : 400,
          color: active === tab.id ? c : D.grisClair,
          cursor: 'pointer', position: 'relative', whiteSpace: 'nowrap',
          transition: 'color .15s',
        }}>
          <div style={{ fontSize: 18, lineHeight: 1, marginBottom: 2 }}>{tab.icon}</div>
          {tab.label}
          {(tab.badge || 0) > 0 && (
            <span style={{
              position: 'absolute', top: 4, right: '18%',
              background: D.rouge, color: 'white', borderRadius: '50%',
              width: 14, height: 14, fontSize: 8,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700,
            }}>{tab.badge! > 9 ? '9+' : tab.badge}</span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Card ─────────────────────────────────────
export function Card({ children, style, accent, onClick }: {
  children: React.ReactNode,
  style?: React.CSSProperties,
  accent?: string,
  onClick?: () => void,
}) {
  return (
    <div onClick={onClick} style={{
      background: D.blanc, borderRadius: 14,
      border: `1px solid ${D.craieDark}`,
      overflow: 'hidden', marginBottom: 8,
      borderLeft: accent ? `4px solid ${accent}` : undefined,
      cursor: onClick ? 'pointer' : undefined,
      transition: onClick ? 'opacity .1s' : undefined,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── Badge ────────────────────────────────────
type BadgeVariant = 'or' | 'vert' | 'rouge' | 'bleu' | 'orange' | 'gris'
const BADGE: Record<BadgeVariant, { bg: string, color: string }> = {
  or:     { bg: 'rgba(193,127,36,.13)', color: 'var(--or)' },
  vert:   { bg: 'rgba(45,122,71,.13)',  color: 'var(--vert)' },
  rouge:  { bg: 'rgba(184,50,50,.13)',  color: 'var(--rouge)' },
  bleu:   { bg: 'rgba(37,87,167,.13)', color: 'var(--bleu)' },
  orange: { bg: 'rgba(184,92,0,.13)',   color: 'var(--orange)' },
  gris:   { bg: 'rgba(107,101,96,.1)', color: 'var(--gris)' },
}

export function Badge({ children, variant = 'gris' }: { children: React.ReactNode, variant?: BadgeVariant }) {
  const s = BADGE[variant]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '3px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color,
    }}>
      {children}
    </span>
  )
}

// ─── Section Label ────────────────────────────
export function SectionLabel({ children, color }: { children: React.ReactNode, color?: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
      textTransform: 'uppercase', color: color || D.grisClair,
      padding: '7px 16px 5px',
      background: D.craieMid,
      borderTop: `1px solid ${D.craieDark}`,
      borderBottom: `1px solid ${D.craieDark}`,
    }}>
      {children}
    </div>
  )
}

// ─── Loader ───────────────────────────────────
export function Loader({ text = 'Chargement...' }: { text?: string }) {
  return (
    <div style={{ padding: 60, textAlign: 'center', color: D.gris }}>
      <div style={{ fontSize: 28, marginBottom: 10, animation: 'pulse 1.5s ease infinite' }}>⏳</div>
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────
export function EmptyState({ icon, title, subtitle, action, onAction }: {
  icon: string, title: string, subtitle?: string,
  action?: string, onAction?: () => void,
}) {
  return (
    <div style={{ padding: '60px 32px', textAlign: 'center', color: D.gris }}>
      <div style={{ fontSize: 48, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: D.ardoise, marginBottom: 6 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: D.gris, lineHeight: 1.6, marginBottom: 20 }}>{subtitle}</div>}
      {action && onAction && (
        <button onClick={onAction} className="press" style={{
          padding: '10px 20px', background: D.ardoise, color: 'white',
          border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>{action}</button>
      )}
    </div>
  )
}

// ─── Btn Primary ──────────────────────────────
export function BtnPrimary({ children, onClick, color, disabled, loading, fullWidth = true, style }: {
  children: React.ReactNode, onClick?: () => void,
  color?: string, disabled?: boolean, loading?: boolean,
  fullWidth?: boolean, style?: React.CSSProperties,
}) {
  return (
    <button onClick={onClick} disabled={disabled || loading} className={disabled || loading ? '' : 'press'} style={{
      width: fullWidth ? '100%' : 'auto',
      padding: '14px 20px',
      background: disabled || loading ? D.craieDark : (color || D.ardoise),
      color: 'white', border: 'none', borderRadius: 12,
      fontSize: 14, fontWeight: 600,
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      opacity: disabled ? .5 : 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      ...style,
    }}>
      {loading ? <span style={{ animation: 'pulse 1s ease infinite' }}>⏳</span> : null}
      {children}
    </button>
  )
}

// ─── Progress Bar ─────────────────────────────
export function ProgressBar({ value, total, color }: { value: number, total: number, color?: string }) {
  const pct = total === 0 ? 0 : Math.min(100, Math.round((value / total) * 100))
  return (
    <div style={{
      padding: '7px 16px', background: D.blanc,
      borderBottom: `1px solid ${D.craieDark}`,
      display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
    }}>
      <div style={{ flex: 1, height: 5, background: D.craieMid, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: color || `linear-gradient(to right, ${D.or}, ${D.vert})`,
          width: `${pct}%`, transition: 'width .4s ease',
        }} />
      </div>
      <div style={{ fontSize: 11, color: D.gris, whiteSpace: 'nowrap', minWidth: 40 }}>
        <span style={{ color: D.vert, fontWeight: 700 }}>{value}</span>/{total}
      </div>
    </div>
  )
}

// ─── Notification Banner ──────────────────────
export function NotifBanner({ icon, text, color }: { icon: string, text: string, color: string }) {
  return (
    <div style={{
      background: `${color}10`, borderBottom: `1px solid ${color}20`,
      padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{ fontSize: 12, color, fontWeight: 500 }}>{text}</div>
    </div>
  )
}

// ─── Pavé numérique ───────────────────────────
export function PaveNumerique({ value, onChange, onConfirm, onClose, title, subtitle, color }: {
  value: string, onChange: (v: string) => void, onConfirm: () => void, onClose: () => void,
  title: string, subtitle?: string, color?: string,
}) {
  const c = color || D.or
  const pad = (n: string) => onChange(value === '0' ? n : value.length < 4 ? value + n : value)
  const del = () => onChange(value.length <= 1 ? '0' : value.slice(0, -1))

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(28,25,23,.7)',
      zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      animation: 'fadeIn .15s ease',
    }} onClick={onClose}>
      <div style={{
        background: D.blanc, borderRadius: '22px 22px 0 0',
        padding: '20px 16px 36px', animation: 'slideUp .2s ease',
      }} onClick={e => e.stopPropagation()}>
        {/* Titre */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: D.ardoise }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: D.grisClair, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {/* Affichage */}
        <div style={{
          background: D.craieMid, borderRadius: 14, padding: '12px 20px',
          marginBottom: 14, textAlign: 'center', border: `2px solid ${c}`,
        }}>
          <div className="serif" style={{ fontSize: 54, fontWeight: 300, color: D.ardoise, lineHeight: 1 }}>
            {value || '0'}
          </div>
          <div style={{ fontSize: 11, color: D.gris, marginTop: 4 }}>pièces</div>
        </div>
        {/* Grille */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
          {['1','2','3','4','5','6','7','8','9'].map(n => (
            <button key={n} onClick={() => pad(n)} style={{
              height: 58, borderRadius: 12, background: D.craieMid,
              border: `1px solid ${D.craieDark}`, color: D.ardoise,
              fontSize: 22, cursor: 'pointer', fontWeight: 400,
            }}>{n}</button>
          ))}
          <button onClick={() => onChange('0')} style={{ height: 58, borderRadius: 12, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.gris, fontSize: 12, cursor: 'pointer' }}>Effacer</button>
          <button onClick={() => pad('0')} style={{ height: 58, borderRadius: 12, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.ardoise, fontSize: 22, cursor: 'pointer' }}>0</button>
          <button onClick={del} style={{ height: 58, borderRadius: 12, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.ardoise, fontSize: 20, cursor: 'pointer' }}>⌫</button>
        </div>
        <BtnPrimary onClick={onConfirm} color={c}>Confirmer — {value || 0} pcs ✓</BtnPrimary>
      </div>
    </div>
  )
}

// ─── Sticky Send Bar ──────────────────────────
export function SendBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      padding: '12px 16px 32px',
      background: `linear-gradient(to top, var(--creme) 65%, transparent)`,
      zIndex: 30,
    }}>
      {children}
    </div>
  )
}

// ─── Success Screen ───────────────────────────
export function SuccessScreen({ title, subtitle, info, onReset, resetLabel = 'Nouvelle commande' }: {
  title: string, subtitle?: string, info?: string,
  onReset: () => void, resetLabel?: string,
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '56px 28px', textAlign: 'center',
      minHeight: 400, animation: 'scaleIn .25s ease',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: `${D.vert}15`, border: `2px solid ${D.vert}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36, margin: '0 auto 20px',
      }}>✓</div>
      <div className="serif" style={{ fontSize: 26, fontWeight: 300, color: D.ardoise, marginBottom: 8 }}>{title}</div>
      {subtitle && <div style={{ color: D.gris, fontSize: 13, marginBottom: 6 }}>{subtitle}</div>}
      {info && <div style={{ fontSize: 11, color: D.grisClair, marginBottom: 28 }}>{info}</div>}
      <button onClick={onReset} style={{
        padding: '10px 24px', background: 'transparent',
        border: `1.5px solid ${D.craieDark}`, color: D.ardoise,
        borderRadius: 10, fontSize: 13, cursor: 'pointer',
      }}>{resetLabel}</button>
    </div>
  )
}
