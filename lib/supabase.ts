import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ───────────────────────────────────
export type Role =
  | 'gerant'
  | 'patissier'
  | 'boulanger_livry'
  | 'boulanger_villemomble'
  | 'boutique_livry'
  | 'boutique_villemomble'
  | 'framboise'

export type AccountType = 'direction' | 'boutique' | 'societe' | 'particulier' | 'personnel'
export type Poste = 'patissier' | 'boulanger' | 'vendeur'

export type User = {
  id: string
  login: string
  nom: string
  role: Role
  couleur: string
  logo_url: string | null
  email: string | null
  // Modèle de comptes dynamique (migration 001)
  type?: AccountType | null
  poste?: Poste | null
  boutique_id?: string | null
}

export type Reglage = {
  cle: string
  valeur: string | null
  maj_at: string
}

export type Famille = {
  id: string
  nom: string
  type: 'patisserie' | 'pain'
  ordre: number
}

export type Produit = {
  id: string
  famille_id: string
  nom: string
  type: 'patisserie' | 'pain'
  prix_base: number
  unite: string
  actif: boolean
  ordre: number
}

export type Commande = {
  id: string
  client_id: string
  statut: 'en_attente' | 'validee' | 'refusee'
  total_ht: number
  created_at: string
  validee_at: string | null
  validation_auto: boolean
  vue_patissier_at: string | null
  fabrication_at: string | null
  pret_at: string | null
  remis_at: string | null
}

export type CommandeLigne = {
  id: string
  commande_id: string
  produit_id: string
  nom_produit: string
  quantite: number
  prix_unit: number
  note: string | null
}

export type CommandePain = {
  id: string
  boutique_id: string
  boulanger_id: string
  date_livraison: string
  statut: 'en_attente' | 'vue' | 'en_production' | 'pret'
  created_at: string
  vue_at: string | null
  production_at: string | null
  pret_at: string | null
}

export type Matiere = {
  id: string
  nom: string
  categorie: string
  fournisseur: string | null
  unite: string
  profil: 'patissier' | 'boulanger' | 'boutique'
  actif: boolean
  ordre: number
}

export type DemandeStock = {
  id: string
  matiere_id: string
  demandeur_id: string
  quantite: number
  unite: string
  priorite: 'normal' | 'urgent'
  statut: 'en_attente' | 'commande' | 'recu'
  created_at: string
  traite_at: string | null
}

export type Facture = {
  id: string
  numero: string
  client_id: string
  periode: string
  total_ht: number
  tva_pct: number
  total_ttc: number
  statut: 'brouillon' | 'envoyee' | 'payee'
  created_at: string
  envoyee_at: string | null
  payee_at: string | null
}

export type Notification = {
  id: string
  destinataire: string
  type: string
  titre: string
  message: string | null
  lu: boolean
  created_at: string
}

// ─── Auth ─────────────────────────────────────
export async function loginUser(login: string, password: string): Promise<User | null> {
  const { data, error } = await supabase.rpc('login_user', {
    p_login: login,
    p_password: password
  })
  if (error || !data || data.length === 0) return null
  const base = data[0] as User
  // Enrichit avec le type de compte si le RPC ne le renvoie pas encore (migration 001)
  if (!base.type) {
    const { data: extra } = await supabase
      .from('users')
      .select('type, poste, boutique_id')
      .eq('id', base.id)
      .single()
    if (extra) return { ...base, ...extra } as User
  }
  return base
}
