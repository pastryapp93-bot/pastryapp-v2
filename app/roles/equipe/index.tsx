'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { D, ROLE_COLORS, ROLE_LABELS, C } from '@/lib/design'
import { AppHeader, TabBar, Card, Badge, SectionLabel, Loader, EmptyState, ProgressBar, NotifBanner, BtnPrimary, SendBar } from '@/app/components/ui'
import type { User } from '@/lib/supabase'

type ShowToast = (msg: string, type?: string) => void

// ═══════════════════════════════════════════════
// ÉQUIPE APP — Pâtissier + Boulangers
// ═══════════════════════════════════════════════
export default function EquipeApp({ user, onLogout, showToast }: {
  user: User, onLogout: () => void, showToast: ShowToast
}) {
  const [tab, setTab]               = useState('jour')
  const [commandes, setCommandes]   = useState<any[]>([])
  const [cmdsPain, setCmdsPain]     = useState<any[]>([])
  const [familles, setFamilles]     = useState<any[]>([])
  const [produits, setProduits]     = useState<any[]>([])
  const [prodStatuts, setProdStatuts] = useState<Record<string, string>>({})
  const [matieres, setMatieres]     = useState<any[]>([])
  const [messages, setMessages]     = useState<any[]>([])
  const [loading, setLoading]       = useState(true)

  const isPat  = user.role === 'patissier'
  const isBoulLivry = user.role === 'boulanger_livry'
  const isBoulVillm = user.role === 'boulanger_villemomble'
  const isBoul = isBoulLivry || isBoulVillm
  const couleur = ROLE_COLORS[user.role] || D.or
  const today  = new Date().toISOString().split('T')[0]
  const demain = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const dans2j = new Date(Date.now() + 172800000).toISOString().split('T')[0]

  const load = useCallback(async () => {
    const profilStock = isPat ? 'patissier' : 'boulanger'
    const typeProds   = isPat ? 'patisserie' : 'pain'

    // Boutique liée au boulanger
    const boutiqueRole = isBoulLivry ? 'boutique_livry' : isBoulVillm ? 'boutique_villemomble' : null
    const boutiqueData = boutiqueRole
      ? await supabase.from('users').select('id').eq('role', boutiqueRole).single()
      : null
    const boutiqueId = boutiqueData?.data?.id

    const queries = [
      // Commandes pâtisserie validées (pour pâtissier)
      isPat
        ? supabase.from('commandes')
            .select('*, users!commandes_client_id_fkey(nom, couleur, role), commande_lignes(*, produits(nom, famille_id))')
            .eq('statut', 'validee')
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      // Commandes pain (pour boulanger)
      isBoul && boutiqueId
        ? supabase.from('commandes_pain')
            .select('*, commande_pain_lignes(*, produits(nom))')
            .eq('boutique_id', boutiqueId)
            .order('date_livraison', { ascending: true })
        : Promise.resolve({ data: [] }),
      supabase.from('familles').select('*').eq('type', typeProds).order('ordre'),
      supabase.from('produits').select('*').eq('type', typeProds).eq('actif', true).order('ordre'),
      supabase.from('production_statuts').select('*').eq('date_prod', today),
      supabase.from('matieres').select('*').eq('profil', profilStock).eq('actif', true).order('ordre'),
      supabase.from('notifications')
        .select('*').eq('destinataire', user.id)
        .eq('lu', false).order('created_at', { ascending: false }).limit(10),
    ]

    const [
      { data: cmds }, { data: cmpain }, { data: fams }, { data: prods },
      { data: pstats }, { data: mats }, { data: msgs }
    ] = await Promise.all(queries)

    setCommandes(cmds || [])
    setCmdsPain(cmpain || [])
    setFamilles(fams || [])
    setProduits(prods || [])
    setMatieres(mats || [])
    setMessages(msgs || [])
    const map: Record<string, string> = {}
    ;(pstats || []).forEach((s: any) => { map[s.produit_id] = s.statut })
    setProdStatuts(map)
    setLoading(false)
  }, [user.id, isPat, isBoul, isBoulLivry, isBoulVillm, today])

  useEffect(() => { load() }, [load])

  // Supabase Realtime — mise à jour auto des commandes
  useEffect(() => {
    const channel = supabase.channel('equipe-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes_pain' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const updateProdStatut = async (produitId: string, statut: string, nom: string) => {
    await supabase.from('production_statuts').upsert(
      { date_prod: today, produit_id: produitId, statut, updated_at: new Date().toISOString() },
      { onConflict: 'date_prod,produit_id' }
    )
    setProdStatuts(prev => ({ ...prev, [produitId]: statut }))
    if (statut === 'termine')  showToast(`${nom} terminé ✓`)
    if (statut === 'rupture')  showToast(`🔴 Rupture : ${nom}`, 'err')
  }

  const marquerEtape = async (table: 'commandes' | 'commandes_pain', id: string, champ: string, valeur: string, notifClientId?: string, notifMsg?: string) => {
    await supabase.from(table).update({ [champ]: valeur }).eq('id', id)
    if (table === 'commandes') setCommandes(prev => prev.map(c => c.id === id ? { ...c, [champ]: valeur } : c))
    else setCmdsPain(prev => prev.map(c => c.id === id ? { ...c, [champ]: valeur } : c))
    if (notifClientId) {
      await supabase.from('notifications').insert({
        destinataire: notifClientId, type: 'update_commande',
        titre: notifMsg || 'Mise à jour commande', message: '',
      })
    }
  }

  // Agréger produits à produire
  const byProduit: Record<string, { total: number, nom: string, clients: { nom: string, color: string, qty: number }[] }> = {}
  if (isPat) {
    commandes.forEach(cmd => {
      ;(cmd.commande_lignes || []).forEach((l: any) => {
        if (!byProduit[l.produit_id]) byProduit[l.produit_id] = { total: 0, nom: l.produits?.nom || l.nom_produit, clients: [] }
        byProduit[l.produit_id].total += l.quantite
        byProduit[l.produit_id].clients.push({ nom: cmd.users?.nom, color: cmd.users?.couleur || C.or, qty: l.quantite })
      })
    })
  } else {
    const todayCmds = cmdsPain.filter(c => c.date_livraison === today)
    todayCmds.forEach(cmd => {
      ;(cmd.commande_pain_lignes || []).forEach((l: any) => {
        if (!byProduit[l.produit_id]) byProduit[l.produit_id] = { total: 0, nom: l.produits?.nom || l.nom_produit, clients: [] }
        byProduit[l.produit_id].total += l.quantite
      })
    })
  }

  const totalProds = Object.keys(byProduit).length
  const termines   = Object.values(prodStatuts).filter(s => s === 'termine').length
  const enCours    = Object.values(prodStatuts).filter(s => s === 'en_cours').length
  const nbNouv     = isPat
    ? commandes.filter(c => !c.vue_patissier_at).length
    : cmdsPain.filter(c => c.statut === 'en_attente').length

  // Rappels boulanger
  const rappel24h = isBoul ? cmdsPain.filter(c => c.date_livraison === demain && c.statut !== 'pret') : []
  const rappel48h = isBoul ? cmdsPain.filter(c => c.date_livraison === dans2j && c.statut !== 'pret') : []

  const TABS = isPat ? [
    { id: 'jour',       icon: '📋', label: 'Aujourd\'hui', badge: nbNouv },
    { id: 'production', icon: '🔥', label: 'Production',   badge: enCours },
    { id: 'pret',       icon: '✅', label: 'Prêt',         badge: termines },
    { id: 'stock',      icon: '📦', label: 'Stock',        badge: 0 },
  ] : [
    { id: 'jour',       icon: '📋', label: 'Commandes',    badge: nbNouv },
    { id: 'pret',       icon: '✅', label: 'Prêt',         badge: cmdsPain.filter((c:any) => c.statut === 'en_production').length },
    { id: 'stock',      icon: '📦', label: 'Stock',        badge: 0 },
  ]

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppHeader user={user} onLogout={onLogout} />
      <Loader />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppHeader user={user} onLogout={onLogout} />

      {/* Rappels boulanger */}
      {rappel24h.length > 0 && <NotifBanner icon="⏰" text={`Livraison DEMAIN — ${rappel24h.reduce((s, c) => s + (c.commande_pain_lignes||[]).reduce((ss:number,l:any)=>ss+l.quantite,0),0)} pcs à préparer`} color={C.rouge} />}
      {rappel48h.length > 0 && <NotifBanner icon="🔔" text={`Dans 2 jours — ${rappel48h.reduce((s, c) => s + (c.commande_pain_lignes||[]).reduce((ss:number,l:any)=>ss+l.quantite,0),0)} pcs`} color={C.orange} />}

      {/* Barre de progression */}
      {totalProds > 0 && <ProgressBar value={termines} total={totalProds} />}

      <TabBar tabs={TABS} active={tab} onChange={setTab} color={couleur} />

      <div style={{ flex: 1, overflowY: 'auto', background: D.craie, paddingBottom: 24 }}>
        {tab === 'jour'       && <EquipeJour user={user} isPat={isPat} commandes={commandes} cmdsPain={cmdsPain} byProduit={byProduit} prodStatuts={prodStatuts} today={today} demain={demain} dans2j={dans2j} marquerEtape={marquerEtape} couleur={couleur} />}
        {tab === 'production' && isPat && <EquipeProduction familles={familles} produits={produits} byProduit={byProduit} prodStatuts={prodStatuts} updateProdStatut={updateProdStatut} couleur={couleur} />}
        {tab === 'pret'       && <EquipePret isPat={isPat} commandes={commandes} cmdsPain={cmdsPain} prodStatuts={prodStatuts} byProduit={byProduit} marquerEtape={marquerEtape} couleur={couleur} />}
        {tab === 'stock'      && <EquipeStock user={user} matieres={matieres} showToast={showToast} couleur={couleur} />}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// AUJOURD'HUI
// ═══════════════════════════════════════════════
function EquipeJour({ user, isPat, commandes, cmdsPain, byProduit, prodStatuts, today, demain, dans2j, marquerEtape, couleur }: any) {
  const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  // Pâtissier
  const cmdPat = commandes.filter((c: any) => !c.remis_at)

  // Boulanger — par urgence
  const cmdAujd  = cmdsPain.filter((c: any) => c.date_livraison === today)
  const cmdDemain = cmdsPain.filter((c: any) => c.date_livraison === demain)
  const cmdDans2j = cmdsPain.filter((c: any) => c.date_livraison === dans2j)
  const cmdFutur  = cmdsPain.filter((c: any) => c.date_livraison > dans2j)

  const totalPcs = Object.values(byProduit).reduce((s: number, p: any) => s + p.total, 0)
  const termines = Object.values(prodStatuts).filter(s => s === 'termine').length
  const total    = Object.keys(byProduit).length

  if (isPat && cmdPat.length === 0) return (
    <EmptyState icon="⏳" title="Aucune commande validée" subtitle="En attente de validation par la direction" />
  )
  if (!isPat && cmdsPain.length === 0) return (
    <EmptyState icon="🍞" title="Aucune commande" subtitle="Les commandes de ta boutique apparaîtront ici" />
  )

  return (
    <div style={{ padding: 14 }}>
      {/* Résumé du jour */}
      <div style={{ background: D.ardoise, borderRadius: 16, padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="serif" style={{ fontSize: 22, fontWeight: 300, color: D.orClair, lineHeight: 1 }}>
              Bonjour {user.nom.split(' ')[0] || user.nom} 👋
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{now}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,.08)', borderRadius: 10, padding: '8px 12px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>{totalPcs}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>pièces à produire</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,.08)', borderRadius: 10, padding: '8px 12px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: termines === total && total > 0 ? '#7FFFB0' : D.orClair }}>{termines}/{total}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>familles terminées</div>
          </div>
        </div>
      </div>

      {/* Commandes pâtissier */}
      {isPat && cmdPat.map((cmd: any) => {
        const color = cmd.users?.couleur || C.or
        const tot = (cmd.commande_lignes || []).reduce((s: number, l: any) => s + l.quantite, 0)
        const isVue = !!cmd.vue_patissier_at
        const isFab = !!cmd.fabrication_at
        const isPret = !!cmd.pret_at

        return (
          <Card key={cmd.id} accent={isFab ? C.or : isVue ? C.vert : color}>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}15`, border: `1.5px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color, flexShrink: 0 }}>
                    {cmd.users?.nom?.slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: D.ardoise }}>{cmd.users?.nom}</div>
                    <div style={{ fontSize: 10, color: D.gris }}>{tot} pcs · {Number(cmd.total_ht).toFixed(2)} € HT</div>
                  </div>
                </div>
                <Badge variant={isFab ? 'or' : isVue ? 'vert' : 'gris'}>
                  {isFab ? '🔥 En fab.' : isVue ? '✓ Vu' : '🆕 Nouveau'}
                </Badge>
              </div>

              {/* Produits */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                {(cmd.commande_lignes || []).map((l: any) => (
                  <span key={l.id} style={{ background: `${color}10`, color, borderRadius: 6, padding: '2px 8px', fontSize: 10 }}>
                    {l.nom_produit} ×{l.quantite}
                  </span>
                ))}
              </div>

              {/* Notes */}
              {(cmd.commande_lignes || []).some((l: any) => l.note) && (
                <div style={{ background: `${C.or}08`, borderRadius: 8, padding: '7px 10px', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: C.or, fontWeight: 700, marginBottom: 3 }}>📝 Notes client</div>
                  {(cmd.commande_lignes || []).filter((l: any) => l.note).map((l: any) => (
                    <div key={l.id} style={{ fontSize: 11, color: D.ardoise }}><strong>{l.nom_produit}</strong> — {l.note}</div>
                  ))}
                </div>
              )}

              {/* Horodatages */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {cmd.vue_patissier_at && <span style={{ fontSize: 9, color: C.vert }}>✓ Vu {new Date(cmd.vue_patissier_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>}
                {cmd.fabrication_at  && <span style={{ fontSize: 9, color: C.or }}>🔥 {new Date(cmd.fabrication_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>}
                {cmd.pret_at         && <span style={{ fontSize: 9, color: C.vert }}>✅ {new Date(cmd.pret_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>}
              </div>

              {/* Actions */}
              {!isVue && <BtnPrimary onClick={() => marquerEtape('commandes', cmd.id, 'vue_patissier_at', new Date().toISOString())} color={D.ardoise} style={{ padding: '10px' }}>Pris en compte ✓</BtnPrimary>}
              {isVue && !isFab && <BtnPrimary onClick={() => marquerEtape('commandes', cmd.id, 'fabrication_at', new Date().toISOString())} color={C.or} style={{ padding: '10px' }}>🔥 Démarrer la fabrication</BtnPrimary>}
            </div>
          </Card>
        )
      })}

      {/* Commandes boulanger */}
      {!isPat && (
        <>
          {cmdAujd.length > 0 && (
            <>
              <SectionLabel color={C.rouge}>📅 Aujourd'hui</SectionLabel>
              {cmdAujd.map((cmd: any) => <CmdPainCard key={cmd.id} cmd={cmd} urgence="today" marquerEtape={marquerEtape} />)}
            </>
          )}
          {cmdDemain.length > 0 && (
            <>
              <SectionLabel color={C.rouge}>⏰ Demain</SectionLabel>
              {cmdDemain.map((cmd: any) => <CmdPainCard key={cmd.id} cmd={cmd} urgence="demain" marquerEtape={marquerEtape} />)}
            </>
          )}
          {cmdDans2j.length > 0 && (
            <>
              <SectionLabel color={C.orange}>🔔 Dans 2 jours</SectionLabel>
              {cmdDans2j.map((cmd: any) => <CmdPainCard key={cmd.id} cmd={cmd} urgence="2j" marquerEtape={marquerEtape} />)}
            </>
          )}
          {cmdFutur.length > 0 && (
            <>
              <SectionLabel>📆 Commandes futures</SectionLabel>
              {cmdFutur.map((cmd: any) => <CmdPainCard key={cmd.id} cmd={cmd} marquerEtape={marquerEtape} />)}
            </>
          )}
        </>
      )}
    </div>
  )
}

function CmdPainCard({ cmd, urgence, marquerEtape }: any) {
  const tot = (cmd.commande_pain_lignes || []).reduce((s: number, l: any) => s + l.quantite, 0)
  const color = urgence === 'today' || urgence === 'demain' ? C.rouge : urgence === '2j' ? C.orange : C.or
  const dateStr = new Date(cmd.date_livraison + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const STATUT: Record<string, string> = { en_attente: '⏳ En attente', vue: '✓ Pris en compte', pret: '✅ Prête' }
  const STATUT_V: Record<string, any> = { en_attente: 'gris', vue: 'vert', pret: 'vert' }

  return (
    <Card accent={color}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color }}>{dateStr}</div>
            <div style={{ fontSize: 10, color: D.gris, marginTop: 1 }}>{tot} pièces</div>
          </div>
          <Badge variant={STATUT_V[cmd.statut] || 'gris'}>{STATUT[cmd.statut] || cmd.statut}</Badge>
        </div>

        {/* Produits */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
          {(cmd.commande_pain_lignes || []).map((l: any) => (
            <span key={l.id} style={{ background: `${color}10`, color, borderRadius: 6, padding: '2px 8px', fontSize: 10 }}>
              {l.produits?.nom || l.nom_produit} ×{l.quantite}
            </span>
          ))}
        </div>

        {/* Horodatages */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: cmd.statut === 'pret' ? 0 : 10 }}>
          <span style={{ fontSize: 9, color: C.bleu }}>
            📤 Reçue {new Date(cmd.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
          </span>
          {cmd.vue_at  && <span style={{ fontSize: 9, color: C.vert }}>✓ Pris en compte {new Date(cmd.vue_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>}
          {cmd.pret_at && <span style={{ fontSize: 9, color: C.vert }}>✅ Prête {new Date(cmd.pret_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>}
        </div>

        {/* Actions — workflow simplifié boulanger */}
        {cmd.statut === 'en_attente' && (
          <BtnPrimary onClick={() => marquerEtape('commandes_pain', cmd.id, 'statut', 'vue', null, null)} style={{ padding: '11px' }}>
            Pris en compte ✓
          </BtnPrimary>
        )}
        {cmd.statut === 'vue' && (
          <BtnPrimary onClick={() => marquerEtape('commandes_pain', cmd.id, 'statut', 'pret', null, null)} color={C.vert} style={{ padding: '11px' }}>
            ✅ Commande prête
          </BtnPrimary>
        )}
      </div>
    </Card>
  )
}

// ═══════════════════════════════════════════════
// PRODUCTION — Mode focus par famille
// ═══════════════════════════════════════════════
function EquipeProduction({ familles, produits, byProduit, prodStatuts, updateProdStatut, couleur }: any) {
  const [focusFam, setFocusFam] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const prodsAFaire = produits.filter((p: any) => byProduit[p.id])
  if (prodsAFaire.length === 0) return <EmptyState icon="👨‍🍳" title="Aucune production aujourd'hui" subtitle="Les familles à produire apparaîtront ici" />

  const getFamStatut = (prods: any[]) => {
    if (!prods.length) return null
    if (prods.every((p: any) => prodStatuts[p.id] === 'termine')) return 'termine'
    if (prods.some((p: any) => prodStatuts[p.id] === 'en_cours')) return 'en_cours'
    if (prods.some((p: any) => prodStatuts[p.id] === 'rupture')) return 'rupture'
    return 'a_faire'
  }

  // Mode focus — plein écran sur une famille
  if (focusFam) {
    const fam = familles.find((f: any) => f.id === focusFam)
    const famProds = produits.filter((p: any) => p.famille_id === focusFam && byProduit[p.id])
    const total = famProds.reduce((s: number, p: any) => s + (byProduit[p.id]?.total || 0), 0)
    const termFam = famProds.filter((p: any) => prodStatuts[p.id] === 'termine').length

    return (
      <div style={{ minHeight: '100%', background: D.ardoise, display: 'flex', flexDirection: 'column', animation: 'scaleIn .2s ease' }}>
        {/* Header focus */}
        <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setFocusFam(null)} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.1)', border: 'none', color: 'white', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: 1 }}>Mode focus</div>
            <div className="serif" style={{ fontSize: 22, fontWeight: 300, color: D.orClair }}>{fam?.nom}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '6px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'white', lineHeight: 1 }}>{total}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)' }}>pcs</div>
          </div>
        </div>

        {/* Barre progression focus */}
        <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,.1)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: couleur, borderRadius: 2, width: `${famProds.length ? Math.round(termFam/famProds.length*100) : 0}%`, transition: 'width .4s' }} />
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{termFam}/{famProds.length}</div>
        </div>

        {/* Produits en focus */}
        <div style={{ flex: 1, padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          {famProds.map((prod: any) => {
            const statut = prodStatuts[prod.id] || 'a_faire'
            const done = statut === 'termine'
            const rupt = statut === 'rupture'
            return (
              <div key={prod.id} style={{ background: done ? 'rgba(45,122,71,.15)' : rupt ? 'rgba(184,50,50,.15)' : 'rgba(255,255,255,.07)', borderRadius: 14, padding: '14px 16px', border: `1px solid ${done ? 'rgba(45,122,71,.3)' : rupt ? 'rgba(184,50,50,.3)' : 'rgba(255,255,255,.1)'}`, opacity: rupt ? .6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: done || rupt ? 0 : 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: done ? '#7FFFB0' : rupt ? '#FF9999' : 'white' }}>
                      {done ? '✅ ' : rupt ? '🔴 ' : ''}{prod.nom}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: done ? '#7FFFB0' : D.orClair, marginTop: 2 }}>
                      {byProduit[prod.id]?.total} pcs
                    </div>
                    {byProduit[prod.id]?.clients?.map((c: any, i: number) => (
                      <span key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginRight: 6 }}>{c.nom} ×{c.qty}</span>
                    ))}
                  </div>
                </div>
                {!done && !rupt && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => updateProdStatut(prod.id, 'termine', prod.nom)} className="press" style={{ flex: 1, padding: '12px', background: C.vert, color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>✅ Terminé</button>
                    <button onClick={() => updateProdStatut(prod.id, 'rupture', prod.nom)} style={{ padding: '12px 14px', background: 'rgba(184,50,50,.2)', border: '1px solid rgba(184,50,50,.3)', color: '#FF9999', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>🔴</button>
                  </div>
                )}
                {(done || rupt) && (
                  <button onClick={() => updateProdStatut(prod.id, 'a_faire', prod.nom)} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.5)', borderRadius: 8, fontSize: 11, cursor: 'pointer', marginTop: 8 }}>↩ Rouvrir</button>
                )}
              </div>
            )
          })}
        </div>

        {/* Bouton tout terminer */}
        {famProds.some((p: any) => !['termine','rupture'].includes(prodStatuts[p.id] || 'a_faire')) && (
          <div style={{ padding: '12px 16px 32px' }}>
            <button onClick={() => { famProds.forEach((p: any) => { if ((prodStatuts[p.id] || 'a_faire') !== 'rupture') updateProdStatut(p.id, 'termine', p.nom) }); setFocusFam(null) }} className="press" style={{ width: '100%', padding: 14, background: C.vert, color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              ✅ Toute la famille terminée !
            </button>
          </div>
        )}
      </div>
    )
  }

  // Vue normale — liste des familles
  return (
    <div style={{ padding: 14 }}>
      {familles.map((famille: any) => {
        const famProds = produits.filter((p: any) => p.famille_id === famille.id && byProduit[p.id])
        if (!famProds.length) return null

        const famStatut = getFamStatut(famProds)
        const total = famProds.reduce((s: number, p: any) => s + (byProduit[p.id]?.total || 0), 0)
        const termFam = famProds.filter((p: any) => prodStatuts[p.id] === 'termine').length
        const borderCol = famStatut === 'termine' ? C.vert : famStatut === 'en_cours' ? C.or : famStatut === 'rupture' ? C.rouge : '#DDD8D0'
        const isExp = expanded[famille.id]

        return (
          <div key={famille.id} style={{
            background: D.blanc, borderRadius: 16, border: `1px solid ${D.craieDark}`,
            marginBottom: 10, overflow: 'hidden', position: 'relative',
            opacity: famStatut === 'termine' ? .75 : 1, transition: 'opacity .3s',
          }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: borderCol, transition: 'background .3s' }} />
            <div style={{ padding: '13px 13px 13px 17px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: famStatut !== 'termine' ? 12 : 0 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: famStatut === 'termine' ? D.vertBg : famStatut === 'en_cours' ? D.orangeBg : famStatut === 'rupture' ? D.rougeBg : D.craieMid, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  {famStatut === 'termine' ? '✅' : famStatut === 'en_cours' ? '🔥' : famStatut === 'rupture' ? '🔴' : '⬜'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: famStatut === 'termine' ? C.vert : famStatut === 'en_cours' ? C.orange : famStatut === 'rupture' ? C.rouge : D.ardoise }}>
                    {famille.nom}
                  </div>
                  <div style={{ fontSize: 11, color: D.gris, marginTop: 2 }}>{termFam}/{famProds.length} terminés</div>
                </div>
                <div style={{ background: famStatut === 'termine' ? C.vert : famStatut === 'en_cours' ? C.or : D.ardoise, color: 'white', borderRadius: 12, padding: '6px 14px', textAlign: 'center', minWidth: 56 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{total}</div>
                  <div style={{ fontSize: 8, opacity: .7 }}>pcs</div>
                </div>
              </div>

              {famStatut !== 'termine' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setFocusFam(famille.id)} className="press" style={{ flex: 1, padding: 11, background: famStatut === 'en_cours' ? C.vert : D.ardoise, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {famStatut === 'en_cours' ? '✅ Voir et terminer' : '🔥 Commencer'}
                  </button>
                  <button onClick={() => setExpanded(e => ({ ...e, [famille.id]: !e[famille.id] }))} style={{ padding: '11px 12px', background: D.craieMid, border: `1px solid ${D.craieDark}`, borderRadius: 10, color: D.gris, fontSize: 12, cursor: 'pointer' }}>
                    {isExp ? '▲' : '▼'}
                  </button>
                </div>
              )}
              {famStatut === 'termine' && (
                <button onClick={() => { famProds.forEach((p: any) => updateProdStatut(p.id, 'a_faire', p.nom)) }} style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${D.craieDark}`, borderRadius: 8, color: D.gris, fontSize: 11, cursor: 'pointer' }}>↩ Rouvrir</button>
              )}
            </div>

            {isExp && (
              <div style={{ borderTop: `1px solid ${D.craieDark}`, background: D.craie }}>
                {famProds.map((prod: any) => {
                  const statut = prodStatuts[prod.id] || 'a_faire'
                  const done = statut === 'termine'; const rupt = statut === 'rupture'
                  return (
                    <div key={prod.id} style={{ padding: '10px 13px 10px 17px', borderBottom: `1px solid ${D.craieDark}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: done ? C.vert : rupt ? C.rouge : D.ardoise }}>{done ? '✅ ' : rupt ? '🔴 ' : ''}{prod.nom}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.or }}>{byProduit[prod.id]?.total} pcs</div>
                      </div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {!done && !rupt && <button onClick={() => updateProdStatut(prod.id, 'termine', prod.nom)} style={{ width: 32, height: 32, borderRadius: 8, background: D.vertBg, border: `1px solid ${C.vert}40`, color: C.vert, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</button>}
                        {done && <button onClick={() => updateProdStatut(prod.id, 'a_faire', prod.nom)} style={{ width: 32, height: 32, borderRadius: 8, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.gris, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↩</button>}
                        {!done && !rupt && <button onClick={() => updateProdStatut(prod.id, 'rupture', prod.nom)} style={{ width: 32, height: 32, borderRadius: 8, background: D.rougeBg, border: `1px solid ${C.rouge}40`, color: C.rouge, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔴</button>}
                        {rupt && <button onClick={() => updateProdStatut(prod.id, 'a_faire', prod.nom)} style={{ padding: '0 8px', height: 32, borderRadius: 8, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.gris, fontSize: 10, cursor: 'pointer' }}>↩</button>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════
// PRÊT
// ═══════════════════════════════════════════════
function EquipePret({ isPat, commandes, cmdsPain, prodStatuts, byProduit, marquerEtape, couleur }: any) {
  const termines = Object.entries(byProduit).filter(([id]: any) => prodStatuts[id] === 'termine')
  const totalPcs = termines.reduce((s, [, d]) => s + (d as any).total, 0)

  if (!termines.length) return <EmptyState icon="⏳" title="Rien de prêt pour l'instant" subtitle="Les produits terminés apparaîtront ici" />

  return (
    <div style={{ padding: 14 }}>
      <div style={{ background: D.vertBg, border: `1px solid ${C.vert}30`, borderRadius: 14, padding: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 36 }}>✅</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.vert }}>{termines.length} références prêtes</div>
          <div style={{ fontSize: 12, color: D.gris, marginTop: 2 }}>{totalPcs} pièces au total</div>
        </div>
      </div>

      {isPat && commandes.filter((c: any) => !c.remis_at && c.fabrication_at).map((cmd: any) => {
        const color = cmd.users?.couleur || C.or
        const isPret = !!cmd.pret_at
        const lignesTerminees = (cmd.commande_lignes || []).filter((l: any) => prodStatuts[l.produit_id] === 'termine')
        if (!lignesTerminees.length) return null
        return (
          <Card key={cmd.id} accent={isPret ? C.vert : color}>
            <div style={{ padding: '10px 14px', background: D.craieMid, borderBottom: `1px solid ${D.craieDark}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color }}>{cmd.users?.nom}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{lignesTerminees.reduce((s: number, l: any) => s + l.quantite, 0)} pcs</div>
            </div>
            <div style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                {lignesTerminees.map((l: any) => <span key={l.id} style={{ background: `${color}10`, color, borderRadius: 6, padding: '2px 7px', fontSize: 10 }}>{l.nom_produit} ×{l.quantite}</span>)}
              </div>
              {cmd.pret_at && <div style={{ fontSize: 9, color: C.vert, marginBottom: 8 }}>✅ Prêt {new Date(cmd.pret_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div>}
              {cmd.remis_at && <div style={{ fontSize: 9, color: D.gris, marginBottom: 8 }}>🤝 Remis {new Date(cmd.remis_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div>}
              {!isPret && <BtnPrimary onClick={() => marquerEtape('commandes', cmd.id, 'pret_at', new Date().toISOString(), cmd.client_id, 'Votre commande est prête !')} color={C.vert} style={{ padding: '10px' }}>✅ Marquer prêt</BtnPrimary>}
              {isPret && !cmd.remis_at && <BtnPrimary onClick={() => marquerEtape('commandes', cmd.id, 'remis_at', new Date().toISOString())} style={{ padding: '10px' }}>🤝 Remis au client</BtnPrimary>}
            </div>
          </Card>
        )
      })}

      {!isPat && cmdsPain.filter((c: any) => c.statut === 'vue').map((cmd: any) => (
        <Card key={cmd.id} accent={C.vert}>
          <div style={{ padding: '10px 14px', background: D.craieMid, borderBottom: `1px solid ${D.craieDark}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.vert }}>
              {new Date(cmd.date_livraison + 'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{(cmd.commande_pain_lignes||[]).reduce((s:number,l:any)=>s+l.quantite,0)} pcs</div>
          </div>
          <div style={{ padding: '10px 14px' }}>
            <BtnPrimary onClick={() => marquerEtape('commandes_pain', cmd.id, 'statut', 'pret', null, null)} color={C.vert} style={{ padding: '10px' }}>✅ Commande prête — notifier la boutique</BtnPrimary>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════
// STOCK
// ═══════════════════════════════════════════════
function EquipeStock({ user, matieres, showToast, couleur }: any) {
  const [view, setView]             = useState<'signaler'|'demandes'>('signaler')
  const [selections, setSelections] = useState<Record<string, { qty: string, unite: string, prio: string }>>({})
  const [demandes, setDemandes]     = useState<any[]>([])
  const [search, setSearch]         = useState('')
  const [sending, setSending]       = useState(false)

  useEffect(() => {
    supabase.from('demandes_stock').select('*, matieres(nom,categorie)')
      .eq('demandeur_id', user.id).order('created_at',{ascending:false}).limit(30)
      .then(({data}) => setDemandes(data||[]))
  }, [user.id])

  const cats = [...new Set(matieres.map((m: any) => m.categorie))] as string[]
  const filtered = search.length > 1 ? matieres.filter((m: any) => m.nom.toLowerCase().includes(search.toLowerCase())) : matieres
  const nbSel = Object.keys(selections).length
  const hasUrgent = Object.values(selections).some((s: any) => s.prio === 'urgent')

  const toggle = (m: any) => setSelections(prev => {
    if (prev[m.id]) { const n = {...prev}; delete n[m.id]; return n }
    return { ...prev, [m.id]: { qty: '1', unite: m.unite||'kg', prio: 'normal' } }
  })

  const envoyer = async () => {
    if (!nbSel) return
    setSending(true)
    for (const [matId, sel] of Object.entries(selections)) {
      await supabase.from('demandes_stock').insert({ matiere_id: matId, demandeur_id: user.id, quantite: parseFloat((sel as any).qty)||1, unite: (sel as any).unite, priorite: (sel as any).prio, statut: 'en_attente' })
    }
    showToast(hasUrgent ? '🔴 Urgent envoyé ✓' : `${nbSel} demande${nbSel>1?'s':''} envoyée${nbSel>1?'s':''} ✓`)
    setSending(false); setSelections({}); setView('demandes')
    const {data} = await supabase.from('demandes_stock').select('*, matieres(nom,categorie)').eq('demandeur_id',user.id).order('created_at',{ascending:false}).limit(30)
    setDemandes(data||[])
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: D.blanc, borderBottom: `1px solid ${D.craieDark}` }}>
        {[{id:'signaler',l:'➕ Signaler'},{id:'demandes',l:'📋 Mes demandes'}].map(v => (
          <button key={v.id} onClick={() => setView(v.id as any)} style={{ flex: 1, padding: '9px', borderRadius: 10, background: view===v.id ? D.ardoise : 'transparent', border: `1.5px solid ${view===v.id ? D.ardoise : D.craieDark}`, color: view===v.id ? 'white' : D.gris, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{v.l}</button>
        ))}
      </div>

      {view === 'signaler' && (
        <div style={{ paddingBottom: 100 }}>
          <div style={{ padding: '10px 14px', background: D.blanc, borderBottom: `1px solid ${D.craieDark}` }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..." style={{ width:'100%', padding:'10px 14px', border:`1.5px solid ${D.craieDark}`, borderRadius:10, fontSize:13, color:D.ardoise, outline:'none', background:D.blanc }} />
          </div>
          {nbSel > 0 && (
            <div style={{ margin:'8px 14px', background:`${C.or}10`, border:`1px solid ${C.or}40`, borderRadius:10, padding:'8px 14px', display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:12, color:'#7A4E0F', fontWeight:600 }}>{nbSel} sélectionné{nbSel>1?'s':''}</span>
              <button onClick={() => setSelections({})} style={{ background:'transparent', border:'none', color:D.gris, fontSize:12, cursor:'pointer' }}>Effacer</button>
            </div>
          )}
          {(search.length > 1 ? [{cat:'Résultats', prods:filtered}] : cats.map(cat => ({cat, prods:matieres.filter((m:any)=>m.categorie===cat)}))).map(({cat,prods}) => (
            <div key={cat}>
              <SectionLabel>{cat}</SectionLabel>
              {(prods as any[]).map((m:any) => {
                const sel = selections[m.id]; const isSel = !!sel
                return (
                  <div key={m.id}>
                    <div onClick={() => toggle(m)} style={{ padding:'13px 16px', borderBottom:`1px solid ${D.craieDark}`, display:'flex', alignItems:'center', gap:12, cursor:'pointer', background:isSel?`${C.or}06`:D.blanc }}>
                      <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${isSel?C.or:D.craieDark}`, background:isSel?C.or:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {isSel && <span style={{ color:'white', fontSize:13, fontWeight:700 }}>✓</span>}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:isSel?600:400, color:isSel?C.orange:D.ardoise }}>{m.nom}</div>
                        {m.fournisseur && <div style={{ fontSize:10, color:D.grisClair }}>{m.fournisseur}</div>}
                      </div>
                    </div>
                    {isSel && (
                      <div style={{ padding:'8px 16px 10px 50px', borderBottom:`1px solid ${D.craieDark}`, background:`${C.or}04`, display:'flex', gap:8, alignItems:'center' }} onClick={e=>e.stopPropagation()}>
                        <div style={{ display:'flex', alignItems:'center', gap:4, background:D.blanc, border:`1.5px solid ${C.or}`, borderRadius:8, padding:'4px 6px' }}>
                          <button onClick={() => setSelections(prev => ({...prev,[m.id]:{...prev[m.id],qty:String(Math.max(1,parseFloat((prev[m.id] as any).qty)-1))}}))} style={{ width:28, height:28, border:'none', background:'transparent', color:D.ardoise, fontSize:16, cursor:'pointer' }}>−</button>
                          <input type="number" value={(sel as any).qty} onChange={e => setSelections(prev=>({...prev,[m.id]:{...prev[m.id],qty:e.target.value}}))} style={{ width:36, textAlign:'center', border:'none', outline:'none', fontSize:15, fontWeight:700, color:C.or, background:'transparent' }} />
                          <button onClick={() => setSelections(prev => ({...prev,[m.id]:{...prev[m.id],qty:String(parseFloat((prev[m.id] as any).qty)+1)}}))} style={{ width:28, height:28, border:'none', background:C.or, borderRadius:5, color:'white', fontSize:16, cursor:'pointer', fontWeight:700 }}>+</button>
                        </div>
                        <select value={(sel as any).unite} onChange={e => setSelections(prev=>({...prev,[m.id]:{...prev[m.id],unite:e.target.value}}))} style={{ padding:'6px 8px', background:D.blanc, border:`1px solid ${D.craieDark}`, borderRadius:8, color:D.ardoise, fontSize:12, outline:'none' }}>
                          {['kg','g','L','ml','unité','lot','sac'].map(u=><option key={u} value={u}>{u}</option>)}
                        </select>
                        <div style={{ display:'flex', gap:5, marginLeft:'auto' }}>
                          {[{id:'normal',l:'🟡'},{id:'urgent',l:'🔴'}].map(p=>(
                            <button key={p.id} onClick={() => setSelections(prev=>({...prev,[m.id]:{...prev[m.id],prio:p.id}}))} style={{ width:34, height:34, borderRadius:8, border:`2px solid ${(sel as any).prio===p.id?(p.id==='urgent'?C.rouge:C.or):D.craieDark}`, background:(sel as any).prio===p.id?(p.id==='urgent'?D.rougeBg:`${C.or}15`):D.blanc, fontSize:17, cursor:'pointer' }}>{p.l}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          <SendBar>
            <BtnPrimary disabled={!nbSel||sending} onClick={envoyer} color={!nbSel?undefined:hasUrgent?C.rouge:D.ardoise} loading={sending}>
              {sending ? 'Envoi...' : !nbSel ? 'Cocher les produits manquants' : hasUrgent ? `🔴 Envoyer URGENT — ${nbSel} produit${nbSel>1?'s':''}` : `📦 Envoyer — ${nbSel} produit${nbSel>1?'s':''}`}
            </BtnPrimary>
          </SendBar>
        </div>
      )}

      {view === 'demandes' && (
        <div style={{ padding:14 }}>
          {!demandes.length ? <EmptyState icon="✅" title="Aucune demande" /> : demandes.map((d:any) => (
            <Card key={d.id} accent={d.priorite==='urgent'?C.rouge:C.or}>
              <div style={{ padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:D.ardoise }}>{d.matieres?.nom}</div>
                  <div style={{ fontSize:11, color:D.gris, marginTop:2 }}>{d.quantite} {d.unite} · {new Date(d.created_at).toLocaleDateString('fr-FR')}</div>
                </div>
                <Badge variant={d.statut==='recu'?'vert':d.statut==='commande'?'bleu':d.priorite==='urgent'?'rouge':'or'}>
                  {d.statut==='recu'?'✅ Reçu':d.statut==='commande'?'📦 Commandé':d.priorite==='urgent'?'🔴 Urgent':'⏳ En attente'}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
