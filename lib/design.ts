// ══════════════════════════════════════════════
// DESIGN SYSTEM — PastryApp V2
// Tokens CSS variables (dark mode natif)
// ══════════════════════════════════════════════

export const D = {
  // Fonds
  craie:      'var(--bg-app)',
  craieMid:   'var(--bg-card)',
  blanc:      'var(--bg-card-solid)',
  craieDark:  'var(--border-color)',

  // Textes
  ardoise:    'var(--text-main)',
  gris:       'var(--text-muted)',
  grisClair:  'var(--text-light)',

  // Marque
  or:         'var(--brand-gold)',
  orGlow:     'var(--brand-gold-glow)',
  orClair:    'var(--brand-gold)',

  // Gradients
  gradOr:     'var(--gradient-gold)',
  gradDark:   'var(--gradient-dark)',

  // Statuts
  bleu:       'var(--status-received)',
  bleuBg:     'var(--status-received-bg)',
  or2:        'var(--status-progress)',
  or2Bg:      'var(--status-progress-bg)',
  rouge:      'var(--status-baking)',
  rougeBg:    'var(--status-baking-bg)',
  vert:       'var(--status-ready)',
  vertBg:     'var(--status-ready-bg)',
  orange:     'var(--status-orange)',
  orangeBg:   'var(--status-orange-bg)',

  // Effets
  shadowSm:   'var(--shadow-sm)',
  shadowMd:   'var(--shadow-md)',
  shadowLg:   'var(--shadow-lg)',
  shadowXl:   'var(--shadow-xl)',
  blur:       'var(--blur-glass)',

  // Rayons
  rSm:  'var(--radius-sm)',
  rMd:  'var(--radius-md)',
  rLg:  'var(--radius-lg)',
  rXl:  'var(--radius-xl)',
} as const

// Couleurs statiques hex (pour les gradients, boxShadow, etc.)
export const C = {
  or:     '#C17F24',
  orDark: '#DF9F42',
  vert:   '#10B981',
  rouge:  '#EF4444',
  bleu:   '#3B82F6',
  orange: '#F97316',
  ambre:  '#F59E0B',
  violet: '#8B5CF6',
  ardoise:'#1C1917',
  creme:  '#F8F5F0',
} as const

export const ROLE_COLORS: Record<string, string> = {
  gerant:                C.or,
  patissier:             C.vert,
  boulanger_livry:       C.ambre,
  boulanger_villemomble: C.ambre,
  boutique_livry:        C.bleu,
  boutique_villemomble:  C.violet,
  framboise:             C.or,
}

export const ROLE_LABELS: Record<string, string> = {
  gerant:                'Direction',
  patissier:             'Pâtissier',
  boulanger_livry:       'Boulanger Livry',
  boulanger_villemomble: 'Boulanger Villemomble',
  boutique_livry:        'QG Boutique Livry',
  boutique_villemomble:  "L'Atelier des Saveurs",
  framboise:             'La Framboise',
}

export const EQUIPE_ROLES  = ['patissier', 'boulanger_livry', 'boulanger_villemomble']
export const CLIENT_ROLES  = ['boutique_livry', 'boutique_villemomble', 'framboise']
