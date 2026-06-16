'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { D } from '@/lib/design'
import { AppHeader, Card, Badge, SectionLabel, Loader, Avatar, ProgressBar } from '@/app/components/ui'
import type { User } from '@/lib/supabase'

type ShowToast = (msg: string, type?: string) => void

// ═══════════════════════════════════════════════
// BOULANGER APP — Livry + Villemomble
// ═══════════════════════════════════════════════
export default function BoulangerApp({ user, onLogout, showToast }: {
  user: User, onLogout: () => void, showToast: ShowToast
}) {
  const [tab, setTab]               = useState('commandes')
  const [commandes, setCommandes]   = useState<any[]>([])
  const [familles, setFamilles]     = useState<any[]>([])
  const [produits, setProduits]     = useState<any[]>([])
  const [prodStatuts, setProdStatuts] = useState<Record<string, string>>({})
  const [matieres, setMatieres]     = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const today = new Date().toISOString().split('T')[0]

  // Identifiant de la boutique liée à ce boulanger
  const boutiqueRole = user.role === 'boulanger_livry' ? 'boutique_livry' : 'boutique_villemomble'
  const boutiqueNom  = user.role === 'boulanger_livry' ? 'QG Boutique Livry' : "L'Atelier des Saveurs"

  const load = useCallback(async () => {
    // Récupérer l'ID de la boutique liée
    const { data: boutique } = await supabase
      .from('users').select('id').eq('role', boutiqueRole).single()

    const boutiqueId = boutique?.id

    const [{ data: cmds }, { data: fams }, { data: prods }, { data: pstats }, { data: mats }] = await Promise.all([
      boutiqueId
        ? supabase.from('commandes_pain')
            .select('*, commande_pain_lignes(*, produits(nom))')
            .eq('boutique_id', boutiqueId)
            .order('date_livraison', { ascending: true })
        : Promise.resolve({ data: [] }),
      supabase.from('familles').select('*').eq('type', 'pain').order('ordre'),
      supabase.from('produits').select('*').eq('type', 'pain').eq('actif', true).order('ordre'),
      supabase.from('production_statuts').select('*').eq('date_prod', today),
      supabase.from('matieres').select('*').eq('profil', 'boulanger').eq('actif', true).order('ordre'),
    ])

    setCommandes(cmds || [])
    setFamilles(fams || [])
    setProduits(prods || [])
    setMatieres(mats || [])
    const map: Record<string, string> = {}
    ;(pstats || []).forEach((s: any) => { map[s.produit_id] = s.statut })
    setProdStatuts(map)
    setLoading(false)
  }, [boutiqueRole, today])

  useEffect(() => { load() }, [load])

  const saveProdStatut = async (produitId: string, statut: string, nomProd: string) => {
    await supabase.from('production_statuts').upsert({
      date_prod: today, produit_id: produitId, statut,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'date_prod,produit_id' })
    setProdStatuts(prev => ({ ...prev, [produitId]: statut }))
    if (statut === 'termine') showToast(`${nomProd} — Terminé ✓`)
    if (statut === 'rupture') showToast(`Rupture : ${nomProd}`, 'err')
  }

  const marquerVue = async (cmdId: string) => {
    await supabase.from('commandes_pain').update({ statut: 'vue', vue_at: new Date().toISOString() }).eq('id', cmdId)
    setCommandes(prev => prev.map(c => c.id === cmdId ? { ...c, statut: 'vue', vue_at: new Date().toISOString() } : c))
    showToast('Commande prise en compte ✓')
  }

  const marquerProduction = async (cmdId: string) => {
    await supabase.from('commandes_pain').update({ statut: 'en_production', production_at: new Date().toISOString() }).eq('id', cmdId)
    setCommandes(prev => prev.map(c => c.id === cmdId ? { ...c, statut: 'en_production', production_at: new Date().toISOString() } : c))
    showToast('Production lancée 🔥')
  }

  const marquerPret = async (cmdId: string) => {
    await supabase.from('commandes_pain').update({ statut: 'pret', pret_at: new Date().toISOString() }).eq('id', cmdId)
    setCommandes(prev => prev.map(c => c.id === cmdId ? { ...c, statut: 'pret', pret_at: new Date().toISOString() } : c))
    showToast('Pain prêt ✅ — boutique notifiée')
  }

  // Agrégat produits à faire aujourd'hui
  const todayCmds = commandes.filter(c => c.date_livraison === today && c.statut !== 'pret')
  const byProduit: Record<string, { total: number, nom: string }> = {}
  todayCmds.forEach(cmd => {
    ;(cmd.commande_pain_lignes || []).forEach((ligne: any) => {
      if (!byProduit[ligne.produit_id]) byProduit[ligne.produit_id] = { total: 0, nom: ligne.produits?.nom || ligne.nom_produit }
      byProduit[ligne.produit_id].total += ligne.quantite
    })
  })

  const totalProds  = Object.keys(byProduit).length
  const termines    = Object.values(prodStatuts).filter(s => s === 'termine').length
  const nbNouvelles = commandes.filter(c => c.statut === 'en_attente').length

  // Rappels
  const demain = new Date(); demain.setDate(demain.getDate() + 1)
  const dans2j = new Date(); dans2j.setDate(dans2j.getDate() + 2)
  const demainStr = demain.toISOString().split('T')[0]
  const dans2jStr = dans2j.toISOString().split('T')[0]
  const rappels24h = commandes.filter(c => c.date_livraison === demainStr && c.statut !== 'pret')
  const rappels48h = commandes.filter(c => c.date_livraison === dans2jStr && c.statut !== 'pret')

  const NAV = [
    { id: 'commandes',  icon: '📋', label: 'Commandes',  badge: nbNouvelles },
    { id: 'production', icon: '🔥', label: 'Production',  badge: 0 },
    { id: 'pret',       icon: '✅', label: 'Prêt',        badge: termines },
    { id: 'stock',      icon: '📦', label: 'Stock',       badge: 0 },
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

      {/* Rappels */}
      {rappels24h.length > 0 && (
        <div style={{ background: D.rougeBg, borderBottom: `1px solid ${D.rouge}20`, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⏰</span>
          <div style={{ fontSize: 12, color: D.rouge, fontWeight: 600 }}>
            🔴 Livraison DEMAIN — {boutiqueNom} · {rappels24h.reduce((s, c) => s + (c.commande_pain_lignes || []).reduce((ss: number, l: any) => ss + l.quantite, 0), 0)} pcs
          </div>
        </div>
      )}
      {rappels48h.length > 0 && (
        <div style={{ background: D.orangeBg, borderBottom: `1px solid ${D.orange}20`, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🔔</span>
          <div style={{ fontSize: 11, color: D.orange, fontWeight: 500 }}>
            Dans 2 jours — {boutiqueNom} · {rappels48h.reduce((s, c) => s + (c.commande_pain_lignes || []).reduce((ss: number, l: any) => ss + l.quantite, 0), 0)} pcs
          </div>
        </div>
      )}

      {/* Barre progression */}
      {totalProds > 0 && <ProgressBar value={termines} total={totalProds} />}

      {/* Onglets */}
      <div style={{ display: 'flex', background: 'white', borderBottom: `1.5px solid ${D.craieDark}` }}>
        {NAV.map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} style={{
            flex: 1, padding: '11px 8px', background: 'none', border: 'none',
            borderBottom: `2px solid ${tab === item.id ? D.or : 'transparent'}`,
            fontSize: 11, fontWeight: tab === item.id ? 600 : 400,
            color: tab === item.id ? D.or : D.grisClair,
            cursor: 'pointer', position: 'relative',
          }}>
            {item.icon} {item.label}
            {(item.badge || 0) > 0 && (
              <span style={{ position: 'absolute', top: 4, right: 4, background: item.id === 'pret' ? D.vert : D.rouge, color: 'white', borderRadius: '50%', width: 14, height: 14, fontSize: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: D.craie, paddingBottom: 20 }}>
        {tab === 'commandes'  && <BoulangerCommandes commandes={commandes} boutiqueNom={boutiqueNom} today={today} demainStr={demainStr} dans2jStr={dans2jStr} marquerVue={marquerVue} marquerProduction={marquerProduction} />}
        {tab === 'production' && <BoulangerProduction familles={familles} produits={produits} byProduit={byProduit} prodStatuts={prodStatuts} saveProdStatut={saveProdStatut} />}
        {tab === 'pret'       && <BoulangerPret commandes={commandes} prodStatuts={prodStatuts} byProduit={byProduit} marquerPret={marquerPret} />}
        {tab === 'stock'      && <BoulangerStock user={user} matieres={matieres} showToast={showToast} />}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// COMMANDES
// ═══════════════════════════════════════════════
function BoulangerCommandes({ commandes, boutiqueNom, today, demainStr, dans2jStr, marquerVue, marquerProduction }: any) {
  const cmdAujourdhui = commandes.filter((c: any) => c.date_livraison === today)
  const cmdDemain     = commandes.filter((c: any) => c.date_livraison === demainStr)
  const cmdDans2j     = commandes.filter((c: any) => c.date_livraison === dans2jStr)
  const cmdFutures    = commandes.filter((c: any) => c.date_livraison > dans2jStr)

  const CmdCard = ({ cmd, highlight }: { cmd: any, highlight?: string }) => {
    const tot = (cmd.commande_pain_lignes || []).reduce((s: number, l: any) => s + l.quantite, 0)
    const dateStr = new Date(cmd.date_livraison + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    const borderCol = highlight === 'today' ? D.rouge : highlight === 'demain' ? D.rouge : highlight === '2j' ? D.orange : D.craieDark

    const STATUT_LABEL: Record<string, string> = {
      en_attente: 'En attente', vue: '✓ Vu', en_production: '🔥 En production', pret: '✅ Prêt'
    }
    const STATUT_TYPE: Record<string, any> = {
      en_attente: 'gris', vue: 'vert', en_production: 'or', pret: 'vert'
    }

    return (
      <Card borderColor={borderCol}>
        <div style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: highlight === 'today' ? D.rouge : highlight === 'demain' ? D.rouge : highlight === '2j' ? D.orange : D.ardoise }}>
                {highlight === 'today' ? '📅 AUJOURD\'HUI' : highlight === 'demain' ? '⏰ DEMAIN' : highlight === '2j' ? '🔔 Dans 2 jours' : dateStr}
              </div>
              {highlight && <div style={{ fontSize: 10, color: D.gris, marginTop: 1 }}>{dateStr} · {tot} pièces</div>}
              {!highlight && <div style={{ fontSize: 10, color: D.gris, marginTop: 1 }}>{tot} pièces</div>}
            </div>
            <Badge type={STATUT_TYPE[cmd.statut] || 'gris'}>{STATUT_LABEL[cmd.statut] || cmd.statut}</Badge>
          </div>

          {/* Produits */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {(cmd.commande_pain_lignes || []).map((l: any) => (
              <span key={l.id} style={{ background: `${D.or}12`, color: D.or, borderRadius: 6, padding: '3px 8px', fontSize: 11 }}>
                {l.produits?.nom || l.nom_produit} ×{l.quantite}
              </span>
            ))}
          </div>

          {/* Horodatages */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: cmd.statut === 'pret' ? 0 : 8 }}>
            {cmd.vue_at && <div style={{ fontSize: 10, color: D.vert }}>✓ Vu {new Date(cmd.vue_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>}
            {cmd.production_at && <div style={{ fontSize: 10, color: D.or }}>🔥 {new Date(cmd.production_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>}
            {cmd.pret_at && <div style={{ fontSize: 10, color: D.vert }}>✅ Prêt {new Date(cmd.pret_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>}
          </div>

          {/* Actions */}
          {cmd.statut === 'en_attente' && (
            <button onClick={() => marquerVue(cmd.id)} className="press" style={{ width: '100%', padding: 11, background: D.ardoise, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Pris en compte ✓
            </button>
          )}
          {cmd.statut === 'vue' && (
            <button onClick={() => marquerProduction(cmd.id)} className="press" style={{ width: '100%', padding: 11, background: D.or, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              🔥 Lancer la production
            </button>
          )}
        </div>
      </Card>
    )
  }

  if (commandes.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center', color: D.gris }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🍞</div>
      <div style={{ fontSize: 14 }}>Aucune commande en cours</div>
      <div style={{ fontSize: 12, marginTop: 6, color: D.grisClair }}>Les commandes de {boutiqueNom} apparaîtront ici</div>
    </div>
  )

  return (
    <div style={{ padding: 14 }}>
      {cmdAujourdhui.length > 0 && <>{<div style={{ fontSize: 10, color: D.rouge, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>📅 À livrer aujourd'hui</div>}{cmdAujourdhui.map((c: any) => <CmdCard key={c.id} cmd={c} highlight="today" />)}</>}
      {cmdDemain.length > 0 && <>{<div style={{ fontSize: 10, color: D.rouge, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 14, fontWeight: 700 }}>⏰ À livrer demain</div>}{cmdDemain.map((c: any) => <CmdCard key={c.id} cmd={c} highlight="demain" />)}</>}
      {cmdDans2j.length > 0 && <>{<div style={{ fontSize: 10, color: D.orange, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 14, fontWeight: 700 }}>🔔 Dans 2 jours</div>}{cmdDans2j.map((c: any) => <CmdCard key={c.id} cmd={c} highlight="2j" />)}</>}
      {cmdFutures.length > 0 && <>{<div style={{ fontSize: 10, color: D.gris, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 14 }}>📆 Commandes futures</div>}{cmdFutures.map((c: any) => <CmdCard key={c.id} cmd={c} />)}</>}
    </div>
  )
}

// ═══════════════════════════════════════════════
// PRODUCTION
// ═══════════════════════════════════════════════
function BoulangerProduction({ familles, produits, byProduit, prodStatuts, saveProdStatut }: any) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const prodsAFaire = produits.filter((p: any) => byProduit[p.id])
  if (prodsAFaire.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center', color: D.gris }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🍞</div>
      <div style={{ fontSize: 14 }}>Aucune production pour aujourd'hui</div>
    </div>
  )

  const getFamilyStatut = (famProds: any[]) => {
    if (famProds.length === 0) return null
    if (famProds.every((p: any) => prodStatuts[p.id] === 'termine')) return 'termine'
    if (famProds.some((p: any) => prodStatuts[p.id] === 'en_cours')) return 'en_cours'
    if (famProds.some((p: any) => prodStatuts[p.id] === 'rupture')) return 'rupture'
    return 'a_faire'
  }

  const setFamilyStatut = (famProds: any[], statut: string) => {
    famProds.forEach((p: any) => saveProdStatut(p.id, statut, p.nom))
  }

  return (
    <div style={{ padding: 14 }}>
      {familles.map((famille: any) => {
        const famProds = produits.filter((p: any) => p.famille_id === famille.id && byProduit[p.id])
        if (famProds.length === 0) return null

        const famStatut = getFamilyStatut(famProds)
        const isExp = expanded[famille.id]
        const totalFam = famProds.reduce((s: number, p: any) => s + (byProduit[p.id]?.total || 0), 0)
        const terminesFam = famProds.filter((p: any) => prodStatuts[p.id] === 'termine').length
        const borderColor = famStatut === 'termine' ? D.vert : famStatut === 'en_cours' ? D.or : famStatut === 'rupture' ? D.rouge : D.craieDark

        return (
          <div key={famille.id} style={{ background: 'white', borderRadius: 16, border: `1px solid ${D.craieDark}`, marginBottom: 10, overflow: 'hidden', position: 'relative', opacity: famStatut === 'termine' ? .75 : 1 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: borderColor }} />
            <div style={{ padding: '14px 14px 14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: famStatut !== 'termine' ? 12 : 0 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: famStatut === 'termine' ? D.vertBg : famStatut === 'en_cours' ? D.orangeBg : D.craieMid, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  {famStatut === 'termine' ? '✅' : famStatut === 'en_cours' ? '🔥' : '⬜'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: famStatut === 'termine' ? D.vert : famStatut === 'en_cours' ? D.orange : D.ardoise }}>{famille.nom}</div>
                  <div style={{ fontSize: 11, color: D.gris, marginTop: 2 }}>{terminesFam}/{famProds.length} terminés</div>
                </div>
                <div style={{ background: famStatut === 'termine' ? D.vert : famStatut === 'en_cours' ? D.or : D.ardoise, color: 'white', borderRadius: 12, padding: '6px 14px', textAlign: 'center', minWidth: 60 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{totalFam}</div>
                  <div style={{ fontSize: 9, opacity: .8 }}>pcs</div>
                </div>
              </div>
              {famStatut !== 'termine' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {famStatut === 'a_faire' && <button onClick={() => setFamilyStatut(famProds, 'en_cours')} className="press" style={{ flex: 1, padding: 11, background: D.ardoise, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🔥 Commencer</button>}
                  {famStatut === 'en_cours' && <button onClick={() => setFamilyStatut(famProds, 'termine')} className="press" style={{ flex: 1, padding: 11, background: D.vert, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✅ Famille terminée !</button>}
                  <button onClick={() => setExpanded(e => ({ ...e, [famille.id]: !e[famille.id] }))} style={{ padding: '11px 12px', background: D.craieMid, border: `1px solid ${D.craieDark}`, borderRadius: 10, color: D.gris, fontSize: 12, cursor: 'pointer' }}>
                    {isExp ? '▲' : '▼'}
                  </button>
                </div>
              )}
              {famStatut === 'termine' && (
                <button onClick={() => setFamilyStatut(famProds, 'en_cours')} style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${D.craieDark}`, borderRadius: 8, color: D.gris, fontSize: 11, cursor: 'pointer' }}>↩ Rouvrir</button>
              )}
            </div>
            {(isExp || famStatut === 'en_cours') && (
              <div style={{ borderTop: `1px solid ${D.craieDark}`, background: D.craie }}>
                {famProds.map((prod: any) => {
                  const statut = prodStatuts[prod.id] || 'a_faire'
                  const isRup = statut === 'rupture'
                  return (
                    <div key={prod.id} style={{ padding: '10px 14px 10px 18px', borderBottom: `1px solid ${D.craieDark}`, display: 'flex', alignItems: 'center', gap: 8, opacity: isRup ? .5 : 1 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: statut === 'termine' ? D.vert : isRup ? D.rouge : D.ardoise }}>
                          {statut === 'termine' ? '✅ ' : isRup ? '🔴 ' : ''}{prod.nom}
                        </div>
                        <div style={{ fontSize: 11, color: D.or, fontWeight: 700, marginTop: 2 }}>{byProduit[prod.id]?.total} pcs</div>
                      </div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {!isRup && statut !== 'termine' && (
                          <button onClick={() => saveProdStatut(prod.id, 'termine', prod.nom)} style={{ width: 32, height: 32, borderRadius: 8, background: D.vertBg, border: `1px solid ${D.vert}40`, color: D.vert, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</button>
                        )}
                        {statut === 'termine' && (
                          <button onClick={() => saveProdStatut(prod.id, 'en_cours', prod.nom)} style={{ width: 32, height: 32, borderRadius: 8, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.gris, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↩</button>
                        )}
                        {!isRup && statut !== 'termine' && (
                          <button onClick={() => saveProdStatut(prod.id, 'rupture', prod.nom)} style={{ width: 32, height: 32, borderRadius: 8, background: D.rougeBg, border: `1px solid ${D.rouge}40`, color: D.rouge, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔴</button>
                        )}
                        {isRup && (
                          <button onClick={() => saveProdStatut(prod.id, 'a_faire', prod.nom)} style={{ padding: '0 8px', height: 32, borderRadius: 8, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.gris, fontSize: 10, cursor: 'pointer' }}>↩</button>
                        )}
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
function BoulangerPret({ commandes, prodStatuts, byProduit, marquerPret }: any) {
  const termines = Object.entries(byProduit).filter(([id]: any) => prodStatuts[id] === 'termine')
  const totalPcs = termines.reduce((s, [, d]) => s + (d as any).total, 0)
  const cmdEnCours = commandes.filter((c: any) => c.statut === 'en_production' || c.statut === 'vue')

  if (termines.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center', color: D.gris }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
      <div style={{ fontSize: 14 }}>Rien de prêt pour l'instant</div>
    </div>
  )

  return (
    <div style={{ padding: 14 }}>
      <div style={{ background: D.vertBg, border: `1px solid ${D.vert}30`, borderRadius: 14, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 36 }}>✅</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: D.vert }}>{termines.length} références prêtes</div>
          <div style={{ fontSize: 12, color: D.gris, marginTop: 2 }}>{totalPcs} pièces au total · Les clients peuvent venir récupérer</div>
        </div>
      </div>

      {/* Produits prêts */}
      <div style={{ background: 'white', borderRadius: 14, border: `1px solid ${D.craieDark}`, marginBottom: 14, overflow: 'hidden' }}>
        {termines.map(([id, data]: any, i) => (
          <div key={id} style={{ padding: '10px 14px', borderBottom: i < termines.length - 1 ? `1px solid ${D.craieDark}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: D.ardoise }}>{data.nom}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: D.vert }}>×{data.total}</span>
          </div>
        ))}
      </div>

      {/* Bouton marquer prêt sur les commandes */}
      {cmdEnCours.map((cmd: any) => (
        <Card key={cmd.id} borderColor={D.vert}>
          <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: D.craieMid, borderBottom: `1px solid ${D.craieDark}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: D.vert }}>Commande du {new Date(cmd.date_livraison + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
            <div style={{ fontSize: 13, color: D.ardoise, fontWeight: 600 }}>
              {(cmd.commande_pain_lignes || []).reduce((s: number, l: any) => s + l.quantite, 0)} pcs
            </div>
          </div>
          <div style={{ padding: '10px 14px' }}>
            <button onClick={() => marquerPret(cmd.id)} className="press" style={{ width: '100%', padding: 11, background: D.vert, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              ✅ Marquer prêt — boutique notifiée
            </button>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════
// STOCK BOULANGER
// ═══════════════════════════════════════════════
function BoulangerStock({ user, matieres, showToast }: {
  user: User, matieres: any[], showToast: ShowToast
}) {
  const [view, setView]             = useState<'signaler' | 'demandes'>('signaler')
  const [selections, setSelections] = useState<Record<string, { qty: string, unite: string, prio: string }>>({})
  const [demandes, setDemandes]     = useState<any[]>([])
  const [search, setSearch]         = useState('')
  const [sending, setSending]       = useState(false)

  useEffect(() => {
    supabase.from('demandes_stock')
      .select('*, matieres(nom, categorie)')
      .eq('demandeur_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setDemandes(data || []))
  }, [user.id])

  const cats = [...new Set(matieres.map(m => m.categorie))] as string[]
  const filtered = search.length > 1 ? matieres.filter(m => m.nom.toLowerCase().includes(search.toLowerCase())) : matieres
  const nbSel = Object.keys(selections).length
  const hasUrgent = Object.values(selections).some(s => s.prio === 'urgent')

  const toggle = (m: any) => {
    setSelections(prev => {
      if (prev[m.id]) { const n = { ...prev }; delete n[m.id]; return n }
      return { ...prev, [m.id]: { qty: '1', unite: m.unite || 'kg', prio: 'normal' } }
    })
  }

  const envoyer = async () => {
    if (nbSel === 0) return
    setSending(true)
    for (const [matId, sel] of Object.entries(selections)) {
      await supabase.from('demandes_stock').insert({
        matiere_id: matId, demandeur_id: user.id,
        quantite: parseFloat(sel.qty) || 1,
        unite: sel.unite, priorite: sel.prio, statut: 'en_attente',
      })
    }
    showToast(hasUrgent ? '🔴 Urgent envoyé ✓' : `${nbSel} demande${nbSel > 1 ? 's' : ''} envoyée${nbSel > 1 ? 's' : ''} ✓`)
    setSending(false)
    setSelections({})
    setView('demandes')
    const { data } = await supabase.from('demandes_stock').select('*, matieres(nom, categorie)').eq('demandeur_id', user.id).order('created_at', { ascending: false }).limit(30)
    setDemandes(data || [])
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: 'white', borderBottom: `1px solid ${D.craieDark}` }}>
        <button onClick={() => setView('signaler')} style={{ flex: 1, padding: '9px', borderRadius: 10, background: view === 'signaler' ? D.ardoise : 'transparent', border: `1.5px solid ${view === 'signaler' ? D.ardoise : D.craieDark}`, color: view === 'signaler' ? 'white' : D.gris, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          ➕ Signaler un manque
        </button>
        <button onClick={() => setView('demandes')} style={{ flex: 1, padding: '9px', borderRadius: 10, background: view === 'demandes' ? D.ardoise : 'transparent', border: `1.5px solid ${view === 'demandes' ? D.ardoise : D.craieDark}`, color: view === 'demandes' ? 'white' : D.gris, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          📋 Mes demandes
        </button>
      </div>

      {view === 'signaler' && (
        <div style={{ paddingBottom: 100 }}>
          <div style={{ padding: '10px 14px 8px', background: 'white', borderBottom: `1px solid ${D.craieDark}` }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..."
              style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${D.craieDark}`, borderRadius: 10, fontSize: 13, color: D.ardoise, outline: 'none' }} />
          </div>
          {nbSel > 0 && (
            <div style={{ margin: '8px 14px', background: `${D.or}10`, border: `1px solid ${D.or}40`, borderRadius: 10, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: D.orTexte, fontWeight: 600 }}>{nbSel} sélectionné{nbSel > 1 ? 's' : ''}</span>
              <button onClick={() => setSelections({})} style={{ background: 'transparent', border: 'none', color: D.gris, fontSize: 12, cursor: 'pointer' }}>Effacer</button>
            </div>
          )}
          {(search.length > 1 ? [{ cat: 'Résultats', prods: filtered }] : cats.map(cat => ({ cat, prods: matieres.filter(m => m.categorie === cat) }))).map(({ cat, prods }) => (
            <div key={cat}>
              <SectionLabel>{cat}</SectionLabel>
              {(prods as any[]).map(m => {
                const sel = selections[m.id]
                const isSel = !!sel
                return (
                  <div key={m.id}>
                    <div onClick={() => toggle(m)} style={{ padding: '13px 16px', borderBottom: `1px solid ${D.craieDark}`, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: isSel ? `${D.or}06` : 'white' }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isSel ? D.or : D.craieDark}`, background: isSel ? D.or : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isSel && <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>✓</span>}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: isSel ? 600 : 400, color: isSel ? D.orange : D.ardoise, flex: 1 }}>{m.nom}</div>
                    </div>
                    {isSel && (
                      <div style={{ padding: '8px 16px 10px 50px', borderBottom: `1px solid ${D.craieDark}`, background: `${D.or}04`, display: 'flex', gap: 8, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'white', border: `1.5px solid ${D.or}`, borderRadius: 8, padding: '4px 6px' }}>
                          <button onClick={() => setSelections(prev => ({ ...prev, [m.id]: { ...prev[m.id], qty: String(Math.max(1, parseFloat(prev[m.id].qty) - 1)) } }))} style={{ width: 28, height: 28, border: 'none', background: 'transparent', color: D.ardoise, fontSize: 16, cursor: 'pointer' }}>−</button>
                          <input type="number" value={sel.qty} onChange={e => setSelections(prev => ({ ...prev, [m.id]: { ...prev[m.id], qty: e.target.value } }))} style={{ width: 36, textAlign: 'center', border: 'none', outline: 'none', fontSize: 15, fontWeight: 700, color: D.or, background: 'transparent' }} />
                          <button onClick={() => setSelections(prev => ({ ...prev, [m.id]: { ...prev[m.id], qty: String(parseFloat(prev[m.id].qty) + 1) } }))} style={{ width: 28, height: 28, border: 'none', background: D.or, borderRadius: 5, color: 'white', fontSize: 16, cursor: 'pointer', fontWeight: 700 }}>+</button>
                        </div>
                        <select value={sel.unite} onChange={e => setSelections(prev => ({ ...prev, [m.id]: { ...prev[m.id], unite: e.target.value } }))} style={{ padding: '6px 8px', background: 'white', border: `1px solid ${D.craieDark}`, borderRadius: 8, color: D.ardoise, fontSize: 12, outline: 'none' }}>
                          {['kg','g','L','ml','unité','lot','sac'].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: 5, marginLeft: 'auto' }}>
                          {[{ id: 'normal', l: '🟡' }, { id: 'urgent', l: '🔴' }].map(p => (
                            <button key={p.id} onClick={() => setSelections(prev => ({ ...prev, [m.id]: { ...prev[m.id], prio: p.id } }))} style={{ width: 34, height: 34, borderRadius: 8, border: `2px solid ${sel.prio === p.id ? (p.id === 'urgent' ? D.rouge : D.or) : D.craieDark}`, background: sel.prio === p.id ? (p.id === 'urgent' ? D.rougeBg : `${D.or}15`) : 'white', fontSize: 17, cursor: 'pointer' }}>
                              {p.l}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '12px 16px 28px', background: `linear-gradient(to top, ${D.craie} 70%, transparent)` }}>
            <button disabled={nbSel === 0 || sending} onClick={envoyer} className="press" style={{ width: '100%', padding: 14, background: nbSel === 0 ? D.craieDark : hasUrgent ? D.rouge : D.ardoise, color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: nbSel === 0 ? 'not-allowed' : 'pointer', opacity: nbSel === 0 ? .4 : 1 }}>
              {sending ? 'Envoi...' : nbSel === 0 ? 'Cocher les produits manquants' : hasUrgent ? `🔴 Envoyer URGENT — ${nbSel} produit${nbSel > 1 ? 's' : ''}` : `📦 Envoyer — ${nbSel} produit${nbSel > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {view === 'demandes' && (
        <div style={{ padding: 14 }}>
          {demandes.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: D.gris }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
              <div>Aucune demande envoyée</div>
            </div>
          ) : demandes.map((d: any) => (
            <Card key={d.id} borderColor={d.priorite === 'urgent' ? D.rouge : D.or}>
              <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: D.ardoise }}>{d.matieres?.nom}</div>
                  <div style={{ fontSize: 11, color: D.gris, marginTop: 2 }}>{d.quantite} {d.unite} · {new Date(d.created_at).toLocaleDateString('fr-FR')}</div>
                </div>
                <Badge type={d.statut === 'recu' ? 'vert' : d.statut === 'commande' ? 'bleu' : d.priorite === 'urgent' ? 'rouge' : 'or'}>
                  {d.statut === 'recu' ? '✅ Reçu' : d.statut === 'commande' ? '📦 Commandé' : d.priorite === 'urgent' ? '🔴 Urgent' : '⏳ En attente'}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
