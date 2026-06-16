'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { D } from '@/lib/design'
import { AppHeader, BottomNav, Card, Badge, SectionLabel, Loader, Avatar } from '@/app/components/ui'
import type { User } from '@/lib/supabase'

type ShowToast = (msg: string, type?: string) => void

const NAV = [
  { id: 'accueil',     icon: '🏠', label: 'Accueil' },
  { id: 'commandes',   icon: '📋', label: 'Commandes' },
  { id: 'calendrier',  icon: '📅', label: 'Calendrier' },
  { id: 'clients',     icon: '👥', label: 'Clients' },
  { id: 'facturation', icon: '💶', label: 'Facturation' },
  { id: 'stock',       icon: '📦', label: 'Stock' },
  { id: 'config',      icon: '⚙️', label: 'Config' },
]

// ═══════════════════════════════════════════════
// DIRECTION APP
// ═══════════════════════════════════════════════
export default function DirectionApp({ user, onLogout, showToast }: {
  user: User, onLogout: () => void, showToast: ShowToast
}) {
  const [tab, setTab]             = useState('accueil')
  const [commandes, setCommandes] = useState<any[]>([])
  const [clients, setClients]     = useState<any[]>([])
  const [stock, setStock]         = useState<any[]>([])
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    const [{ data: cmds }, { data: cls }, { data: stk }] = await Promise.all([
      supabase.from('commandes')
        .select('*, users!commandes_client_id_fkey(nom, couleur, role)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('users')
        .select('*')
        .neq('role', 'gerant')
        .eq('actif', true)
        .order('nom'),
      supabase.from('demandes_stock')
        .select('*, matieres(nom, categorie), users!demandes_stock_demandeur_id_fkey(nom, role)')
        .eq('statut', 'en_attente')
        .order('created_at', { ascending: false }),
    ])
    setCommandes(cmds || [])
    setClients(cls || [])
    setStock(stk || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Validation auto après 1h
  useEffect(() => {
    const interval = setInterval(async () => {
      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      await supabase.from('commandes')
        .update({ statut: 'validee', validee_at: new Date().toISOString(), validation_auto: true })
        .eq('statut', 'en_attente')
        .lt('created_at', cutoff)
      load()
    }, 60000) // check chaque minute
    return () => clearInterval(interval)
  }, [load])

  const validerCommande = async (id: string) => {
    await supabase.from('commandes').update({
      statut: 'validee',
      validee_at: new Date().toISOString(),
      validation_auto: false,
    }).eq('id', id)
    showToast('Commande validée ✓')
    load()
  }

  const refuserCommande = async (id: string) => {
    await supabase.from('commandes').update({ statut: 'refusee' }).eq('id', id)
    showToast('Commande refusée', 'err')
    load()
  }

  const traiterStock = async (id: string, statut: string) => {
    await supabase.from('demandes_stock').update({
      statut,
      traite_at: new Date().toISOString(),
    }).eq('id', id)
    showToast(statut === 'commande' ? 'Marqué commandé ✓' : 'Marqué reçu ✓')
    load()
  }

  const pending    = commandes.filter(c => c.statut === 'en_attente')
  const urgentStock = stock.filter(s => s.priorite === 'urgent')
  const totalBadge = urgentStock.length

  const navItems = NAV.map(n => ({
    ...n,
    badge: n.id === 'commandes' ? pending.length
         : n.id === 'stock'     ? urgentStock.length
         : 0,
  }))

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppHeader user={user} onLogout={onLogout} />
      <Loader />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppHeader user={user} onLogout={onLogout} badge={totalBadge} />
      <div style={{ flex: 1, overflowY: 'auto', background: D.craie }}>
        {tab === 'accueil'     && <DirectionAccueil commandes={commandes} stock={stock} valider={validerCommande} />}
        {tab === 'commandes'   && <DirectionCommandes commandes={commandes} clients={clients} valider={validerCommande} refuser={refuserCommande} />}
        {tab === 'calendrier'  && <DirectionCalendrier commandes={commandes} />}
        {tab === 'clients'     && <DirectionClients clients={clients} showToast={showToast} load={load} />}
        {tab === 'facturation' && <DirectionFacturation clients={clients} showToast={showToast} />}
        {tab === 'stock'       && <DirectionStock stock={stock} traiter={traiterStock} showToast={showToast} load={load} />}
        {tab === 'config'      && <DirectionConfig clients={clients} showToast={showToast} load={load} />}
      </div>
      <BottomNav items={navItems} active={tab} onChange={setTab} />
    </div>
  )
}

// ═══════════════════════════════════════════════
// ACCUEIL
// ═══════════════════════════════════════════════
function DirectionAccueil({ commandes, stock, valider }: {
  commandes: any[], stock: any[], valider: (id: string) => void
}) {
  const pending      = commandes.filter(c => c.statut === 'en_attente')
  const validees     = commandes.filter(c => c.statut === 'validee')
  const urgentStock  = stock.filter(s => s.priorite === 'urgent')
  const caJour       = commandes
    .filter(c => c.created_at?.startsWith(new Date().toISOString().split('T')[0]))
    .reduce((s, c) => s + Number(c.total_ht), 0)

  // Temps restant avant validation auto
  const tempsRestant = (createdAt: string) => {
    const diff = 3600000 - (Date.now() - new Date(createdAt).getTime())
    if (diff <= 0) return 'Expirée'
    const mins = Math.floor(diff / 60000)
    return `Auto dans ${mins} min`
  }

  return (
    <div style={{ padding: 16 }}>
      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: D.grisClair, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        <div className="serif" style={{ fontSize: 28, fontWeight: 300, color: D.ardoise, lineHeight: 1.1 }}>
          Bonjour,<br /><span style={{ color: D.or }}>M. HAFID</span>
        </div>
      </div>

      {/* KPI CA */}
      <div style={{
        background: D.ardoise, borderRadius: 16, padding: 16, marginBottom: 12,
      }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          CA du jour
        </div>
        <div className="serif" style={{ fontSize: 38, fontWeight: 300, color: D.orClair, lineHeight: 1 }}>
          {caJour.toFixed(2)} €
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>HT · toutes boutiques</div>
      </div>

      {/* KPIs secondaires */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        <div style={{ background: pending.length > 0 ? D.orangeBg : D.vertBg, borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 10, color: pending.length > 0 ? D.orange : D.vert, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 4 }}>
            En attente
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, color: pending.length > 0 ? D.orange : D.vert, lineHeight: 1 }}>
            {pending.length}
          </div>
        </div>
        <div style={{ background: D.vertBg, borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 10, color: D.vert, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 4 }}>
            Validées
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, color: D.vert, lineHeight: 1 }}>
            {validees.length}
          </div>
        </div>
      </div>

      {/* Commandes en attente */}
      {pending.length > 0 && (
        <>
          <SectionLabel>⏰ À valider maintenant</SectionLabel>
          <div style={{ marginTop: 8 }}>
            {pending.map((cmd: any) => (
              <Card key={cmd.id} borderColor={cmd.users?.couleur || D.or}>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar nom={cmd.users?.nom || '?'} couleur={cmd.users?.couleur || D.or} size={32} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: D.ardoise }}>{cmd.users?.nom || '?'}</div>
                        <div style={{ fontSize: 10, color: D.gris }}>{tempsRestant(cmd.created_at)}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: D.or }}>{Number(cmd.total_ht).toFixed(2)} € HT</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => valider(cmd.id)} className="press" style={{
                      flex: 1, padding: '10px', background: D.vert, color: 'white',
                      border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}>✓ Valider</button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Stock urgents */}
      {urgentStock.length > 0 && (
        <>
          <SectionLabel color={D.rouge}>🔴 Manques urgents</SectionLabel>
          <div style={{ marginTop: 8 }}>
            {urgentStock.slice(0, 3).map((s: any) => (
              <Card key={s.id} borderColor={D.rouge}>
                <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: D.ardoise }}>{s.matieres?.nom}</div>
                    <div style={{ fontSize: 10, color: D.gris }}>{s.users?.nom} · {s.quantite} {s.unite}</div>
                  </div>
                  <Badge type="rouge">Urgent</Badge>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {pending.length === 0 && urgentStock.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: D.gris }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 14 }}>Tout est à jour</div>
          <div style={{ fontSize: 12, marginTop: 6, color: D.grisClair }}>Aucune action requise</div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// COMMANDES
// ═══════════════════════════════════════════════
function DirectionCommandes({ commandes, clients, valider, refuser }: {
  commandes: any[], clients: any[], valider: (id: string) => void, refuser: (id: string) => void
}) {
  const [filtre, setFiltre] = useState<'tous' | 'en_attente' | 'validee' | 'refusee'>('en_attente')

  const filtered = filtre === 'tous' ? commandes : commandes.filter(c => c.statut === filtre)
  const statusLabel: Record<string, string> = {
    en_attente: 'En attente', validee: 'Validée', refusee: 'Refusée'
  }
  const statusBadge: Record<string, 'or' | 'vert' | 'rouge'> = {
    en_attente: 'or', validee: 'vert', refusee: 'rouge'
  }

  return (
    <div>
      {/* Filtres */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', background: 'white', borderBottom: `1px solid ${D.craieDark}`, overflowX: 'auto' }}>
        {(['tous', 'en_attente', 'validee', 'refusee'] as const).map(f => (
          <button key={f} onClick={() => setFiltre(f)} className="press" style={{
            padding: '7px 14px', borderRadius: 20, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500,
            background: filtre === f ? D.ardoise : 'transparent',
            color: filtre === f ? 'white' : D.gris,
            border: `1.5px solid ${filtre === f ? D.ardoise : D.craieDark}`,
            cursor: 'pointer',
          }}>
            {f === 'tous' ? 'Toutes' : statusLabel[f]}
            {f === 'en_attente' && commandes.filter(c => c.statut === 'en_attente').length > 0 && (
              <span style={{ marginLeft: 6, background: D.rouge, color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>
                {commandes.filter(c => c.statut === 'en_attente').length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: D.gris }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
            <div>Aucune commande</div>
          </div>
        ) : filtered.map((cmd: any) => (
          <Card key={cmd.id} borderColor={cmd.users?.couleur || D.or}>
            <div style={{ padding: '12px 14px' }}>
              {/* En-tête */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar nom={cmd.users?.nom || '?'} couleur={cmd.users?.couleur || D.or} size={36} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: D.ardoise }}>{cmd.users?.nom || '?'}</div>
                    <div style={{ fontSize: 11, color: D.gris }}>
                      {new Date(cmd.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      {' · '}{Number(cmd.total_ht).toFixed(2)} € HT
                    </div>
                  </div>
                </div>
                <Badge type={statusBadge[cmd.statut] || 'gris'}>{statusLabel[cmd.statut] || cmd.statut}</Badge>
              </div>

              {/* Horodatages */}
              {cmd.statut !== 'en_attente' && (
                <div style={{ fontSize: 10, color: D.gris, marginBottom: 8 }}>
                  {cmd.validee_at && `✓ Validée le ${new Date(cmd.validee_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                  {cmd.validation_auto && ' (auto)'}
                </div>
              )}

              {/* Actions */}
              {cmd.statut === 'en_attente' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => valider(cmd.id)} className="press" style={{
                    flex: 1, padding: '10px', background: D.vert, color: 'white',
                    border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>✓ Valider</button>
                  <button onClick={() => refuser(cmd.id)} className="press" style={{
                    padding: '10px 14px', background: D.rougeBg, color: D.rouge,
                    border: `1px solid ${D.rouge}30`, borderRadius: 10, fontSize: 13, cursor: 'pointer',
                  }}>Refuser</button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// CALENDRIER
// ═══════════════════════════════════════════════
function DirectionCalendrier({ commandes }: { commandes: any[] }) {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selDay, setSelDay] = useState<string | null>(now.toISOString().split('T')[0])

  const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
  const JOURS = ['L','M','M','J','V','S','D']

  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const caByDay: Record<string, number> = {}
  commandes.forEach(c => {
    const d = c.created_at?.split('T')[0]
    if (d) caByDay[d] = (caByDay[d] || 0) + Number(c.total_ht)
  })

  const selCommandes = selDay ? commandes.filter(c => c.created_at?.startsWith(selDay)) : []
  const caTotal = Object.values(caByDay).reduce((s, v) => s + v, 0)

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  return (
    <div style={{ padding: 16 }}>
      {/* Header mois */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <button onClick={prevMonth} style={{ background: 'transparent', border: `1px solid ${D.craieDark}`, borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: D.gris }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 20, fontWeight: 300, color: D.ardoise }}>{MOIS[month]} {year}</div>
          <div style={{ fontSize: 12, color: D.vert, fontWeight: 600, marginTop: 2 }}>{caTotal.toFixed(2)} € HT</div>
        </div>
        <button onClick={nextMonth} style={{ background: 'transparent', border: `1px solid ${D.craieDark}`, borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: D.gris }}>›</button>
      </div>

      {/* Grille calendrier */}
      <div style={{ background: 'white', borderRadius: 14, border: `1px solid ${D.craieDark}`, padding: 12, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 6 }}>
          {JOURS.map((j, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: D.grisClair, padding: '3px 0' }}>{j}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
          {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
          {Array(daysInMonth).fill(null).map((_, i) => {
            const d = i + 1
            const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const hasCmd = !!caByDay[ds]
            const isToday = ds === now.toISOString().split('T')[0]
            const isSel = ds === selDay
            return (
              <div key={d} onClick={() => setSelDay(isSel ? null : ds)} style={{
                borderRadius: 8, padding: '5px 2px', textAlign: 'center', cursor: 'pointer',
                background: isSel ? D.ardoise : hasCmd ? `${D.or}20` : 'transparent',
                border: `1.5px solid ${isSel ? D.ardoise : isToday ? D.or : 'transparent'}`,
                minHeight: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: isSel ? 'white' : isToday ? D.or : D.ardoise }}>{d}</div>
                {hasCmd && <div style={{ width: 4, height: 4, borderRadius: '50%', background: isSel ? 'rgba(255,255,255,.6)' : D.or }} />}
                {hasCmd && <div style={{ fontSize: 8, color: isSel ? 'rgba(255,255,255,.6)' : D.gris }}>{caByDay[ds].toFixed(0)}€</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Commandes du jour sélectionné */}
      {selDay && selCommandes.length > 0 && (
        <>
          <SectionLabel>{new Date(selDay + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</SectionLabel>
          <div style={{ marginTop: 8 }}>
            {selCommandes.map((cmd: any) => (
              <Card key={cmd.id} borderColor={cmd.users?.couleur || D.or}>
                <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: D.ardoise }}>{cmd.users?.nom || '?'}</div>
                    <div style={{ fontSize: 11, color: D.gris }}>{Number(cmd.total_ht).toFixed(2)} € HT</div>
                  </div>
                  <Badge type={cmd.statut === 'validee' ? 'vert' : cmd.statut === 'refusee' ? 'rouge' : 'or'}>
                    {cmd.statut === 'validee' ? 'Validée' : cmd.statut === 'refusee' ? 'Refusée' : 'En attente'}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// CLIENTS
// ═══════════════════════════════════════════════
function DirectionClients({ clients, showToast, load }: {
  clients: any[], showToast: ShowToast, load: () => void
}) {
  const [mode, setMode]   = useState<'list' | 'form'>('list')
  const [edit, setEdit]   = useState<any>(null)
  const [form, setForm]   = useState({ nom: '', login: '', role: 'boutique_livry', couleur: '#2557A7', email: '' })

  const ROLES_CLIENT = [
    { id: 'patissier',             label: 'Pâtissier',           color: '#2D7A47' },
    { id: 'boulanger_livry',       label: 'Boulanger Livry',     color: '#B85C00' },
    { id: 'boulanger_villemomble', label: 'Boulanger Villemomble', color: '#B85C00' },
    { id: 'boutique_livry',        label: 'QG Boutique Livry',   color: '#2557A7' },
    { id: 'boutique_villemomble',  label: "L'Atelier des Saveurs", color: '#7A4E9F' },
    { id: 'framboise',             label: 'La Framboise',        color: '#C17F24' },
  ]

  const openForm = (client?: any) => {
    if (client) {
      setEdit(client)
      setForm({ nom: client.nom, login: client.login, role: client.role, couleur: client.couleur || '#2557A7', email: client.email || '' })
    } else {
      setEdit(null)
      setForm({ nom: '', login: '', role: 'boutique_livry', couleur: '#2557A7', email: '' })
    }
    setMode('form')
  }

  const save = async () => {
    if (!form.nom || !form.login) { showToast('Nom et identifiant requis', 'err'); return }
    if (edit) {
      await supabase.from('users').update({ nom: form.nom, login: form.login, role: form.role, couleur: form.couleur, email: form.email }).eq('id', edit.id)
      showToast('Modifié ✓')
    }
    setMode('list'); load()
  }

  const toggleActif = async (id: string, actif: boolean) => {
    await supabase.from('users').update({ actif: !actif }).eq('id', id)
    showToast(!actif ? 'Compte activé ✓' : 'Compte désactivé')
    load()
  }

  if (mode === 'form') return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => setMode('list')} style={{ background: 'transparent', border: 'none', color: D.or, fontSize: 22, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 15, fontWeight: 600, color: D.ardoise }}>{edit ? 'Modifier le compte' : 'Nouveau compte'}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[{ label: 'Nom', key: 'nom', placeholder: 'Ex: La Framboise' },
          { label: 'Identifiant de connexion', key: 'login', placeholder: 'Ex: framboise' },
          { label: 'Email', key: 'email', placeholder: 'contact@example.com' }
        ].map(f => (
          <div key={f.key}>
            <div style={{ fontSize: 11, color: D.gris, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>{f.label}</div>
            <input value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder} style={inputStyle} />
          </div>
        ))}
        <div>
          <div style={{ fontSize: 11, color: D.gris, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Rôle</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ROLES_CLIENT.map(r => (
              <button key={r.id} onClick={() => setForm(prev => ({ ...prev, role: r.id, couleur: r.color }))} style={{
                padding: '10px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                border: `2px solid ${form.role === r.id ? r.color : D.craieDark}`,
                background: form.role === r.id ? `${r.color}12` : 'white',
                color: form.role === r.id ? r.color : D.ardoise, fontSize: 13, fontWeight: form.role === r.id ? 600 : 400,
              }}>{r.label}</button>
            ))}
          </div>
        </div>
        <button onClick={save} className="press" style={{
          width: '100%', padding: 14, background: D.ardoise, color: 'white',
          border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8,
        }}>
          {edit ? 'Enregistrer ✓' : 'Créer le compte ✓'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: D.gris }}>{clients.length} compte{clients.length > 1 ? 's' : ''}</div>
        <button onClick={() => openForm()} className="press" style={{
          padding: '9px 16px', background: D.ardoise, color: 'white',
          border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>+ Nouveau</button>
      </div>
      {clients.map((c: any) => (
        <Card key={c.id} borderColor={c.couleur}>
          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar nom={c.nom} couleur={c.couleur} size={42} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.couleur }}>{c.nom}</div>
              <div style={{ fontSize: 11, color: D.gris, marginTop: 2 }}>@{c.login} · {c.role}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => openForm(c)} style={{
                width: 30, height: 30, background: D.craieMid, border: `1px solid ${D.craieDark}`,
                borderRadius: 8, cursor: 'pointer', fontSize: 13,
              }}>✏️</button>
              <button onClick={() => toggleActif(c.id, c.actif)} style={{
                width: 30, height: 30, background: c.actif ? D.vertBg : D.rougeBg,
                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 11,
                color: c.actif ? D.vert : D.rouge, fontWeight: 600,
              }}>{c.actif ? '✓' : '✕'}</button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════
// FACTURATION
// ═══════════════════════════════════════════════
function DirectionFacturation({ clients, showToast }: { clients: any[], showToast: ShowToast }) {
  const [factures, setFactures]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<'releves' | 'libre'>('releves')
  const [openId, setOpenId]       = useState<string | null>(null)
  const [lignes, setLignes]       = useState([{ description: '', quantite: 1, prix_unit: 0 }])
  const [clientId, setClientId]   = useState('')

  useEffect(() => {
    supabase.from('factures')
      .select('*, users!factures_client_id_fkey(nom, couleur), facture_lignes(*)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setFactures(data || []); setLoading(false) })
  }, [])

  const reload = () => {
    supabase.from('factures')
      .select('*, users!factures_client_id_fkey(nom, couleur), facture_lignes(*)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setFactures(data || []))
  }

  const totalHT = lignes.reduce((s, l) => s + (l.quantite * l.prix_unit), 0)
  const tva = totalHT * 0.055

  const creerFacture = async () => {
    if (!clientId) { showToast('Sélectionner un client', 'err'); return }
    const now = new Date()
    const numero = `FAC-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getTime()).slice(-4)}`
    const { data: f } = await supabase.from('factures').insert({
      numero, client_id: clientId,
      periode: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      total_ht: totalHT, tva_pct: 5.5, total_ttc: totalHT + tva,
      statut: 'brouillon',
    }).select().single()
    if (f) {
      await supabase.from('facture_lignes').insert(
        lignes.filter(l => l.description).map((l, i) => ({
          facture_id: f.id, description: l.description,
          quantite: l.quantite, prix_unit: l.prix_unit,
          total: l.quantite * l.prix_unit, ordre: i,
        }))
      )
    }
    showToast('Facture créée ✓')
    setLignes([{ description: '', quantite: 1, prix_unit: 0 }])
    setClientId('')
    reload()
    setTab('releves')
  }

  const updateStatut = async (id: string, statut: string) => {
    await supabase.from('factures').update({ statut, ...(statut === 'envoyee' ? { envoyee_at: new Date().toISOString() } : statut === 'payee' ? { payee_at: new Date().toISOString() } : {}) }).eq('id', id)
    showToast(statut === 'payee' ? 'Marquée payée ✓' : 'Envoyée ✓')
    reload()
  }

  if (loading) return <Loader />

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', background: 'white', borderBottom: `1px solid ${D.craieDark}` }}>
        {[{ id: 'releves', l: 'Relevés' }, { id: 'libre', l: 'Facture libre' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            flex: 1, padding: '9px', borderRadius: 10, cursor: 'pointer',
            background: tab === t.id ? D.ardoise : 'transparent',
            border: `1.5px solid ${tab === t.id ? D.ardoise : D.craieDark}`,
            color: tab === t.id ? 'white' : D.gris, fontSize: 13, fontWeight: 600,
          }}>{t.l}</button>
        ))}
      </div>

      {tab === 'releves' && (
        <div style={{ padding: 16 }}>
          {factures.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: D.gris }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
              <div>Aucune facture</div>
            </div>
          ) : factures.map((f: any) => (
            <Card key={f.id}>
              <div onClick={() => setOpenId(openId === f.id ? null : f.id)}
                style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: openId === f.id ? D.craieMid : 'white' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: D.ardoise }}>{f.numero}</div>
                  <div style={{ fontSize: 11, color: D.gris }}>{f.users?.nom} · {f.periode}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="serif" style={{ fontSize: 18, fontWeight: 300, color: D.ardoise }}>{Number(f.total_ttc).toFixed(2)} €</div>
                  <Badge type={f.statut === 'payee' ? 'vert' : f.statut === 'envoyee' ? 'bleu' : 'gris'}>{f.statut}</Badge>
                </div>
              </div>
              {openId === f.id && (
                <div style={{ borderTop: `1px solid ${D.craieDark}` }}>
                  {(f.facture_lignes || []).map((l: any, i: number) => (
                    <div key={i} style={{ padding: '8px 14px', borderBottom: `1px solid ${D.craieDark}`, display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 12, color: D.ardoise }}>{l.description}</div>
                        <div style={{ fontSize: 10, color: D.gris }}>{l.quantite} × {Number(l.prix_unit).toFixed(2)} €</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: D.or }}>{Number(l.total).toFixed(2)} €</div>
                    </div>
                  ))}
                  <div style={{ padding: '10px 14px', background: D.craieMid }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: D.gris, marginBottom: 2 }}><span>HT</span><span>{Number(f.total_ht).toFixed(2)} €</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: D.gris, marginBottom: 6 }}><span>TVA {f.tva_pct}%</span><span>{(Number(f.total_ht) * Number(f.tva_pct) / 100).toFixed(2)} €</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: D.ardoise }}><span>TTC</span><span>{Number(f.total_ttc).toFixed(2)} €</span></div>
                  </div>
                  <div style={{ padding: '8px 14px', display: 'flex', gap: 8 }}>
                    {f.statut === 'brouillon' && <button onClick={() => updateStatut(f.id, 'envoyee')} className="press" style={{ flex: 1, padding: '9px', background: D.bleuBg, color: D.bleu, border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✉️ Envoyer</button>}
                    {f.statut === 'envoyee'   && <button onClick={() => updateStatut(f.id, 'payee')} className="press" style={{ flex: 1, padding: '9px', background: D.vertBg, color: D.vert, border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✓ Payée</button>}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === 'libre' && (
        <div style={{ padding: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: D.gris, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Client</div>
            <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
              <option value="">-- Sélectionner --</option>
              {clients.filter(c => ['boutique_livry','boutique_villemomble','framboise'].includes(c.role)).map((c: any) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 11, color: D.gris, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>Lignes</div>
          {lignes.map((l, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 45px 70px 28px', gap: 6, marginBottom: 8 }}>
              <input value={l.description} onChange={e => setLignes(ls => ls.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Description" style={{ ...inputStyle, marginBottom: 0, padding: '9px 10px', fontSize: 12 }} />
              <input type="number" min="1" value={l.quantite} onChange={e => setLignes(ls => ls.map((x, j) => j === i ? { ...x, quantite: parseInt(e.target.value) || 1 } : x))} style={{ ...inputStyle, marginBottom: 0, padding: '9px 4px', textAlign: 'center', fontSize: 12 }} />
              <input type="number" step="0.01" value={l.prix_unit || ''} onChange={e => setLignes(ls => ls.map((x, j) => j === i ? { ...x, prix_unit: parseFloat(e.target.value) || 0 } : x))} placeholder="€" style={{ ...inputStyle, marginBottom: 0, padding: '9px 4px', textAlign: 'center', fontSize: 12 }} />
              <button onClick={() => setLignes(ls => ls.filter((_, j) => j !== i))} style={{ background: 'transparent', border: `1px solid ${D.craieDark}`, color: D.rouge, borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>×</button>
            </div>
          ))}
          <button onClick={() => setLignes(ls => [...ls, { description: '', quantite: 1, prix_unit: 0 }])} style={{ width: '100%', padding: '9px', background: 'transparent', border: `1.5px dashed ${D.craieDark}`, color: D.gris, borderRadius: 10, fontSize: 12, cursor: 'pointer', marginBottom: 14 }}>+ Ligne</button>
          <div style={{ background: D.craieMid, borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: D.gris, marginBottom: 3 }}><span>HT</span><span>{totalHT.toFixed(2)} €</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: D.gris, marginBottom: 8 }}><span>TVA 5,5%</span><span>{tva.toFixed(2)} €</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: D.ardoise }}><span>TTC</span><span>{(totalHT + tva).toFixed(2)} €</span></div>
          </div>
          <button onClick={creerFacture} disabled={!clientId || totalHT === 0} className="press" style={{
            width: '100%', padding: 14, background: !clientId || totalHT === 0 ? D.craieDark : D.ardoise,
            color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            opacity: !clientId || totalHT === 0 ? .5 : 1,
          }}>Créer la facture ✓</button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// STOCK
// ═══════════════════════════════════════════════
function DirectionStock({ stock, traiter, showToast, load }: {
  stock: any[], traiter: (id: string, statut: string) => void, showToast: ShowToast, load: () => void
}) {
  const [view, setView]         = useState<'demandes' | 'produits'>('demandes')
  const [roleFilter, setRoleFilter] = useState('patissier')
  const [matieres, setMatieres] = useState<any[]>([])
  const [mode, setMode]         = useState<'list' | 'form'>('list')
  const [editItem, setEditItem] = useState<any>(null)
  const [fNom, setFNom]         = useState('')
  const [fCat, setFCat]         = useState('')
  const [fFourn, setFFourn]     = useState('')
  const [fUnite, setFUnite]     = useState('kg')
  const [fRole, setFRole]       = useState('patissier')

  useEffect(() => {
    supabase.from('matieres').select('*').order('profil').order('categorie').order('ordre')
      .then(({ data }) => setMatieres(data || []))
  }, [])

  const reloadMatieres = () => {
    supabase.from('matieres').select('*').order('profil').order('categorie').order('ordre')
      .then(({ data }) => setMatieres(data || []))
  }

  const saveMatiere = async () => {
    if (!fNom || !fCat) { showToast('Nom et catégorie requis', 'err'); return }
    if (editItem) {
      await supabase.from('matieres').update({ nom: fNom, categorie: fCat, fournisseur: fFourn, unite: fUnite, profil: fRole }).eq('id', editItem.id)
      showToast('Modifié ✓')
    } else {
      const max = Math.max(...matieres.filter(m => m.profil === fRole).map(m => m.ordre || 0), 0)
      await supabase.from('matieres').insert({ nom: fNom, categorie: fCat, fournisseur: fFourn, unite: fUnite, profil: fRole, actif: true, ordre: max + 1 })
      showToast('Ajouté ✓')
    }
    setMode('list'); reloadMatieres()
  }

  const openForm = (item?: any) => {
    setEditItem(item || null)
    setFNom(item?.nom || '')
    setFCat(item?.categorie || '')
    setFFourn(item?.fournisseur || '')
    setFUnite(item?.unite || 'kg')
    setFRole(item?.profil || roleFilter)
    setMode('form')
  }

  const urgent   = stock.filter(s => s.priorite === 'urgent')
  const normal   = stock.filter(s => s.priorite !== 'urgent')
  const ROLES    = [{ id: 'patissier', l: 'Pâtissier', ic: '👨‍🍳' }, { id: 'boulanger', l: 'Boulanger', ic: '🍞' }, { id: 'boutique', l: 'Boutiques', ic: '🏪' }]
  const filteredM = matieres.filter(m => m.profil === roleFilter)
  const cats     = [...new Set(filteredM.map(m => m.categorie))]

  if (mode === 'form') return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => setMode('list')} style={{ background: 'transparent', border: 'none', color: D.or, fontSize: 22, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 15, fontWeight: 600, color: D.ardoise }}>{editItem ? 'Modifier' : 'Nouveau produit'}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {ROLES.map(r => (
          <button key={r.id} onClick={() => setFRole(r.id)} style={{
            padding: '8px 14px', borderRadius: 10, border: `2px solid ${fRole === r.id ? D.or : D.craieDark}`,
            background: fRole === r.id ? `${D.or}12` : 'transparent',
            color: fRole === r.id ? D.or : D.gris, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{r.ic} {r.l}</button>
        ))}
      </div>
      {[{ label: 'Nom *', val: fNom, set: setFNom, ph: 'Ex: Beurre tourage' },
        { label: 'Catégorie *', val: fCat, set: setFCat, ph: 'Ex: Matières grasses' },
        { label: 'Fournisseur', val: fFourn, set: setFFourn, ph: 'Ex: Frisson' },
      ].map(f => (
        <div key={f.label}>
          <div style={{ fontSize: 11, color: D.gris, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>{f.label}</div>
          <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={inputStyle} />
        </div>
      ))}
      <div style={{ fontSize: 11, color: D.gris, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>Unité</div>
      <select value={fUnite} onChange={e => setFUnite(e.target.value)} style={inputStyle}>
        {['kg', 'g', 'L', 'ml', 'unité', 'lot', 'sac', 'seau', 'boîte'].map(u => <option key={u} value={u}>{u}</option>)}
      </select>
      <button onClick={saveMatiere} className="press" style={{ width: '100%', padding: 14, background: D.ardoise, color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>
        {editItem ? 'Enregistrer ✓' : 'Ajouter ✓'}
      </button>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', background: 'white', borderBottom: `1px solid ${D.craieDark}` }}>
        <button onClick={() => setView('demandes')} style={{ flex: 1, padding: '9px', borderRadius: 10, background: view === 'demandes' ? D.ardoise : 'transparent', border: `1.5px solid ${view === 'demandes' ? D.ardoise : D.craieDark}`, color: view === 'demandes' ? 'white' : D.gris, fontSize: 12, fontWeight: 600, cursor: 'pointer', position: 'relative' }}>
          📋 Demandes
          {urgent.length > 0 && <span style={{ position: 'absolute', top: -6, right: -6, background: D.rouge, color: 'white', borderRadius: '50%', width: 16, height: 16, fontSize: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{urgent.length}</span>}
        </button>
        <button onClick={() => setView('produits')} style={{ flex: 1, padding: '9px', borderRadius: 10, background: view === 'produits' ? D.ardoise : 'transparent', border: `1.5px solid ${view === 'produits' ? D.ardoise : D.craieDark}`, color: view === 'produits' ? 'white' : D.gris, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          🗂️ Gérer produits
        </button>
      </div>

      {view === 'demandes' && (
        <div style={{ padding: 16, paddingBottom: 80 }}>
          {urgent.length > 0 && (
            <div style={{ background: D.rougeBg, border: `1px solid ${D.rouge}30`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.rouge, marginBottom: 8, textTransform: 'uppercase' }}>🔴 Urgent</div>
              {urgent.map((s: any) => (
                <Card key={s.id} borderColor={D.rouge}>
                  <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: D.ardoise }}>{s.matieres?.nom}</div>
                      <div style={{ fontSize: 11, color: D.gris }}>{s.users?.nom} · {s.quantite} {s.unite}</div>
                    </div>
                    <button onClick={() => traiter(s.id, 'commande')} className="press" style={{ padding: '7px 12px', background: D.bleuBg, color: D.bleu, border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>📦 Commandé</button>
                  </div>
                </Card>
              ))}
            </div>
          )}
          {normal.length > 0 && (
            <>
              <SectionLabel>⏳ En attente</SectionLabel>
              {normal.map((s: any) => (
                <Card key={s.id} borderColor={D.or}>
                  <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: D.ardoise }}>{s.matieres?.nom}</div>
                      <div style={{ fontSize: 11, color: D.gris }}>{s.users?.nom} · {s.quantite} {s.unite}</div>
                    </div>
                    <button onClick={() => traiter(s.id, 'commande')} className="press" style={{ padding: '7px 12px', background: D.bleuBg, color: D.bleu, border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Commander</button>
                  </div>
                </Card>
              ))}
            </>
          )}
          {stock.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', color: D.gris }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
              <div>Aucune demande en cours</div>
            </div>
          )}
        </div>
      )}

      {view === 'produits' && (
        <div style={{ paddingBottom: 80 }}>
          <div style={{ padding: '10px 16px', background: 'white', borderBottom: `1px solid ${D.craieDark}` }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {ROLES.map(r => (
                <button key={r.id} onClick={() => setRoleFilter(r.id)} style={{
                  flex: 1, padding: '10px 4px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                  border: `2px solid ${roleFilter === r.id ? D.or : D.craieDark}`,
                  background: roleFilter === r.id ? `${D.or}12` : 'transparent',
                }}>
                  <div style={{ fontSize: 20 }}>{r.ic}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: roleFilter === r.id ? D.or : D.gris, marginTop: 2 }}>{r.l}</div>
                </button>
              ))}
            </div>
            <button onClick={() => openForm()} className="press" style={{ width: '100%', padding: '10px', background: D.ardoise, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Ajouter un produit
            </button>
          </div>
          {cats.map(cat => (
            <div key={cat}>
              <SectionLabel>{cat}</SectionLabel>
              {filteredM.filter(m => m.categorie === cat).map((m: any) => (
                <div key={m.id} style={{ padding: '11px 16px', borderBottom: `1px solid ${D.craieDark}`, display: 'flex', alignItems: 'center', gap: 10, background: 'white', opacity: m.actif ? 1 : .5 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: D.ardoise, fontWeight: 500 }}>{m.nom}</div>
                    <div style={{ fontSize: 10, color: D.grisClair }}>{m.fournisseur && `${m.fournisseur} · `}{m.unite}</div>
                  </div>
                  <button onClick={() => openForm(m)} style={{ width: 30, height: 30, background: D.craieMid, border: `1px solid ${D.craieDark}`, borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>✏️</button>
                  <button onClick={async () => { await supabase.from('matieres').update({ actif: !m.actif }).eq('id', m.id); reloadMatieres() }} style={{ width: 30, height: 30, background: m.actif ? D.vertBg : D.rougeBg, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 11, color: m.actif ? D.vert : D.rouge, fontWeight: 600 }}>{m.actif ? '✓' : '✕'}</button>
                  <button onClick={async () => { await supabase.from('matieres').delete().eq('id', m.id); showToast(`${m.nom} supprimé`); reloadMatieres() }} style={{ width: 30, height: 30, background: D.rougeBg, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: D.rouge }}>🗑️</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════
function DirectionConfig({ clients, showToast, load }: {
  clients: any[], showToast: ShowToast, load: () => void
}) {
  const [pwdVisible, setPwdVisible] = useState<Record<string, boolean>>({})
  const [newPwd, setNewPwd]         = useState<Record<string, string>>({})
  const [pwds, setPwds]             = useState<Record<string, string>>({})

  // Charger les mots de passe (on stocke pas en clair, on permet juste de changer)
  const changerPwd = async (userId: string) => {
    const pwd = newPwd[userId]
    if (!pwd || pwd.length < 4) { showToast('Mot de passe trop court (min 4 caractères)', 'err'); return }
    const { error } = await supabase.rpc('changer_password', { p_user_id: userId, p_new_password: pwd })
    if (error) {
      // Fallback direct
      await supabase.from('users').update({ password_hash: pwd }).eq('id', userId)
    }
    showToast('Mot de passe mis à jour ✓')
    setNewPwd(prev => ({ ...prev, [userId]: '' }))
  }

  const ROLE_LABELS_LOCAL: Record<string, string> = {
    patissier: 'Pâtissier', boulanger_livry: 'Boulanger Livry',
    boulanger_villemomble: 'Boulanger Villemomble', boutique_livry: 'QG Boutique Livry',
    boutique_villemomble: "L'Atelier des Saveurs", framboise: 'La Framboise',
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: D.ardoise, marginBottom: 14 }}>Accès utilisateurs</div>
      {clients.map((c: any) => (
        <Card key={c.id}>
          <div style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Avatar nom={c.nom} couleur={c.couleur} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.couleur }}>{c.nom}</div>
                <div style={{ fontSize: 11, color: D.gris }}>@{c.login} · {ROLE_LABELS_LOCAL[c.role] || c.role}</div>
              </div>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: c.actif ? D.vert : D.rouge,
              }} />
            </div>
            {/* Changer mot de passe */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type={pwdVisible[c.id] ? 'text' : 'password'}
                  value={newPwd[c.id] || ''}
                  onChange={e => setNewPwd(prev => ({ ...prev, [c.id]: e.target.value }))}
                  placeholder="Nouveau mot de passe"
                  style={{ ...inputStyle, marginBottom: 0, paddingRight: 36, fontSize: 12 }}
                />
                <button onClick={() => setPwdVisible(prev => ({ ...prev, [c.id]: !prev[c.id] }))} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: D.gris,
                }}>
                  {pwdVisible[c.id] ? '🙈' : '👁️'}
                </button>
              </div>
              <button onClick={() => changerPwd(c.id)} className="press" style={{
                padding: '9px 14px', background: D.ardoise, color: 'white',
                border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>OK</button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─── Style commun ─────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  background: 'white', border: `1.5px solid ${D.craieDark}`,
  borderRadius: 10, fontSize: 13, color: D.ardoise,
  outline: 'none', marginBottom: 8,
}
