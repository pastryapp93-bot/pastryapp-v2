// ═══════════════════════════════════════════════
// DESIGN SYSTEM — PastryApp V2
// Ardoise & Farine
// ═══════════════════════════════════════════════

export const D = {
  // Fonds
  craie:     '#F8F5F0',  // fond principal
  craieMid:  '#EDE9E3',  // surfaces secondaires
  craieDark: '#DDD8D0',  // bordures, séparateurs

  // Texte
  ardoise:   '#1C1917',  // texte principal
  gris:      '#6B6560',  // texte secondaire
  grisClair: '#A8A39C',  // hints, labels

  // Or — accent principal
  or:        '#C17F24',
  orClair:   '#F0C97A',
  orTexte:   '#7A4E0F',

  // Statuts
  vert:      '#2D7A47',
  vertBg:    '#E8F5ED',
  rouge:     '#B83232',
  rougeBg:   '#FCEAEA',
  bleu:      '#2557A7',
  bleuBg:    '#EBF1FA',
  orange:    '#B85C00',
  orangeBg:  '#FEF0E2',
} as const

// Couleurs par rôle
export const ROLE_COLORS: Record<string, string> = {
  gerant:                '#C17F24',
  patissier:             '#2D7A47',
  boulanger_livry:       '#B85C00',
  boulanger_villemomble: '#B85C00',
  boutique_livry:        '#2557A7',
  boutique_villemomble:  '#7A4E9F',
  framboise:             '#C17F24',
}

// Labels par rôle
export const ROLE_LABELS: Record<string, string> = {
  gerant:                'Direction',
  patissier:             'Labo pâtisserie',
  boulanger_livry:       'Boulangerie Livry',
  boulanger_villemomble: 'Boulangerie Villemomble',
  boutique_livry:        'QG Boutique Livry',
  boutique_villemomble:  "L'Atelier des Saveurs",
  framboise:             'Client externe',
}
