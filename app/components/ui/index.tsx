'use client'
import { D } from '@/lib/design'
import type { User } from '@/lib/supabase'

// ─── Avatar ───────────────────────────────────
export function Avatar({ nom, couleur, size = 36 }: { nom: string, couleur: string, size?: number }) {
  const initiales = nom.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 3,
      background: `${couleur}18`, border: `1.5px solid ${couleur}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.33, fontWeight: 700, color: couleur, flexShrink: 0,
    }}>
      {initiales}
    </div>
  )
}

// ─── Header ───────────────────────────────────
export function AppHeader({ user, onLogout, badge = 0 }: { user: User, onLogout: () => void, badge?: number }) {
  return (
    <div style={{
      background: 'white', borderBottom: `1.5px solid ${D.craieDark}`,
      padding: '10px 16px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50,
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar nom={user.nom} couleur={user.couleur || D.or} size={36} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: D.ardoise, lineHeight: 1.2 }}>{user.nom}</div>
          <div style={{ fontSize: 10, color: D.grisClair }}>Direction</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {badge > 0 && (
          <span style={{
            background: D.rougeBg, color: D.rouge, borderRadius: 20,
            padding: '3px 8px', fontSize: 11, fontWeight: 600,
          }}>
            {badge} urgent{badge > 1 ? 's' : ''}
          </span>
        )}
        <span className="serif-i" style={{ fontSize: 15, color: D.or }}>PastryApp</span>
        <button onClick={onLogout} style={{
          background: 'transparent', border: `1px solid ${D.craieDark}`,
          color: D.gris, borderRadius: 8, padding: '4px 10px',
          fontSize: 11, cursor: 'pointer',
        }}>Déco.</button>
      </div>
    </div>
  )
}

// ─── Bottom Nav ───────────────────────────────
export type NavItem = { id: string, icon: string, label: string, badge?: number }

export function BottomNav({ items, active, onChange }: {
  items: NavItem[], active: string, onChange: (id: string) => void
}) {
  return (
    <div style={{
      display: 'flex', background: 'white',
      borderTop: `1.5px solid ${D.craieDark}`,
      padding: '6px 0 10px', flexShrink: 0,
      position: 'sticky', bottom: 0, zIndex: 40,
    }}>
      {items.map(item => (
        <button key={item.id} onClick={() => onChange(item.id)} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 3, background: 'none', border: 'none', cursor: 'pointer',
          padding: '4px 0', position: 'relative',
        }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
          <span style={{
            fontSize: 9, fontWeight: active === item.id ? 600 : 400,
            color: active === item.id ? D.or : D.grisClair,
          }}>{item.label}</span>
          {active === item.id && (
            <div style={{
              position: 'absolute', bottom: -10, left: '50%',
              transform: 'translateX(-50%)',
              width: 4, height: 4, borderRadius: '50%', background: D.or,
            }} />
          )}
          {(item.badge || 0) > 0 && (
            <div style={{
              position: 'absolute', top: 0, right: '12%',
              background: D.rouge, color: 'white', borderRadius: '50%',
              width: 14, height: 14, fontSize: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700,
            }}>
              {item.badge}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Card ─────────────────────────────────────
export function Card({ children, style, borderColor }: {
  children: React.ReactNode, style?: React.CSSProperties, borderColor?: string
}) {
  return (
    <div style={{
      background: 'white', borderRadius: 14,
      border: `1px solid ${D.craieDark}`,
      overflow: 'hidden', marginBottom: 8,
      borderLeft: borderColor ? `4px solid ${borderColor}` : undefined,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── Badge ────────────────────────────────────
type BadgeType = 'or' | 'vert' | 'rouge' | 'bleu' | 'orange' | 'gris'
const BADGE_STYLES: Record<BadgeType, { bg: string, color: string }> = {
  or:     { bg: 'rgba(193,127,36,.12)',  color: D.or },
  vert:   { bg: 'rgba(45,122,71,.12)',   color: D.vert },
  rouge:  { bg: 'rgba(184,50,50,.12)',   color: D.rouge },
  bleu:   { bg: 'rgba(37,87,167,.12)',   color: D.bleu },
  orange: { bg: 'rgba(184,92,0,.12)',    color: D.orange },
  gris:   { bg: 'rgba(168,163,156,.15)', color: D.gris },
}

export function Badge({ children, type = 'gris' }: { children: React.ReactNode, type?: BadgeType }) {
  const s = BADGE_STYLES[type]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
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
      fontSize: 10, fontWeight: 600, letterSpacing: 1,
      textTransform: 'uppercase', color: color || D.grisClair,
      padding: '8px 16px 6px',
      background: 'rgba(221,216,208,.3)',
      borderTop: `1px solid ${D.craieDark}`,
      borderBottom: `1px solid ${D.craieDark}`,
    }}>
      {children}
    </div>
  )
}

// ─── Loader ───────────────────────────────────
export function Loader() {
  return (
    <div style={{ padding: 60, textAlign: 'center', color: D.gris }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
      <div style={{ fontSize: 13 }}>Chargement...</div>
    </div>
  )
}

// ─── Bouton principal ─────────────────────────
export function BtnPrimary({ children, onClick, color, disabled, fullWidth = true, style }: {
  children: React.ReactNode, onClick?: () => void,
  color?: string, disabled?: boolean, fullWidth?: boolean,
  style?: React.CSSProperties,
}) {
  return (
    <button onClick={onClick} disabled={disabled} className="press" style={{
      width: fullWidth ? '100%' : 'auto',
      padding: '13px 20px',
      background: disabled ? D.craieDark : (color || D.ardoise),
      color: 'white', border: 'none', borderRadius: 12,
      fontSize: 14, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .5 : 1,
      ...style,
    }}>
      {children}
    </button>
  )
}

// ─── Progress Bar ─────────────────────────────
export function ProgressBar({ value, total }: { value: number, total: number }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100)
  return (
    <div style={{
      padding: '7px 16px', background: 'white',
      borderBottom: `1px solid ${D.craieDark}`,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        flex: 1, height: 5, background: D.craieMid,
        borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: `linear-gradient(to right, ${D.or}, ${D.vert})`,
          width: `${pct}%`, transition: 'width .4s',
        }} />
      </div>
      <div style={{ fontSize: 11, color: D.gris, whiteSpace: 'nowrap' }}>
        <span style={{ color: D.vert, fontWeight: 700 }}>{value}</span>/{total}
      </div>
    </div>
  )
}
