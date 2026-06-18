// ═══════════════════════════════════════════════
// DESIGN SYSTEM — PastryApp V2
// Utilise les CSS variables pour le dark mode
// ═══════════════════════════════════════════════

export const D = {
  craie:     'var(--creme)',
  craieMid:  'var(--craieMid)',
  craieDark: 'var(--craieDark)',
  ardoise:   'var(--ardoise)',
  gris:      'var(--gris)',
  grisClair: 'var(--grisClair)',
  blanc:     'var(--blanc)',
  or:        'var(--or)',
  orClair:   'var(--orClair)',
  orTexte:   'var(--orTexte)',
  vert:      'var(--vert)',
  vertBg:    'var(--vertBg)',
  rouge:     'var(--rouge)',
  rougeBg:   'var(--rougeBg)',
  bleu:      'var(--bleu)',
  bleuBg:    'var(--bleuBg)',
  orange:    'var(--orange)',
  orangeBg:  'var(--orangeBg)',
} as const

// Couleurs statiques (pour les valeurs hex directes si besoin)
export const C = {
  or:     '#C17F24',
  vert:   '#2D7A47',
  rouge:  '#B83232',
  bleu:   '#2557A7',
  orange: '#B85C00',
  violet: '#7A4E9F',
} as const

export const ROLE_COLORS: Record<string, string> = {
  gerant:                C.or,
  patissier:             C.vert,
  boulanger_livry:       C.orange,
  boulanger_villemomble: C.orange,
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

export const EQUIPE_ROLES = ['patissier', 'boulanger_livry', 'boulanger_villemomble']
export const CLIENT_ROLES = ['boutique_livry', 'boutique_villemomble', 'framboise']
