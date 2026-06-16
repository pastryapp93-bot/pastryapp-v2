'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { D } from '@/lib/design'
import { AppHeader, BottomNav, Card, Badge, SectionLabel, Loader, Avatar, ProgressBar, BtnPrimary } from '@/app/components/ui'
import type { User } from '@/lib/supabase'

type ShowToast = (msg: string, type?: string) => void

const NAV = [
  { id: 'commandes',   icon: '📋', label: 'Commandes' },
  { id: 'fabrication', icon: '🔥', label: 'Fabrication' },
  { id: 'pret',        icon: '✅', label: 'Prêt' },
  { id: 'rajouts',     icon: '➕', label: 'Rajouts' },
  { id: 'stock',       icon: '📦', label: 'Stock' },
]

// ═══════════════════════════════════════════════
// PÂTISSIER APP
// ═══════════════════════════════════════════════
export default function PatissierApp({ user, onLogout, showToast }: {
  user: User, onLogout: () => void, showToast: ShowToast
}) {
  const [tab, setTab]             = useState('commandes')
  const [commandes, setCommandes] = useState<any[]>([])
  const [familles, setFamilles]   = useState<any[]>([])
  const [produits, setProduits]   = useState<any[]>([])
  const [prodStatuts, setProdStatuts] = useState<Record<string, string>>({})
  const [matieres, setMatieres]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const today = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    const [{ data: cmds }, { data: fams }, { data: prods }, { data: pstats }, { data: mats }] = await Promise.all([
      supabase.from('commandes')
        .select('*, users!commandes_client_id_fkey(id, nom, couleur, role), commande_lignes(*, produits(nom, familles(nom)))')
        .eq('statut', 'validee')
        .order('created_at', { ascending: false }),
      supabase.from('familles').select('*').eq('type', 'patisserie').order('ordre'),
      supabase.from('produits').select('*').eq('type', 'patisserie').eq('actif', true).order('ordre'),
      supabase.from('production_statuts').select('*').eq('date_prod', today),
      supabase.from('matieres').select('*').eq('profil', 'patissier').eq('actif', true).order('ordre'),
    ])
    setCommandes(cmds || [])
    setFamilles(fams || [])
    setProduits(prods || [])
    setMatieres(mats || [])
    const map: Record<string, string> = {}
    ;(pstats || []).forEach((s: any) => { map[s.produit_id] = s.statut })
    setProdStatuts(map)
    setLoading(false)
  }, [today])

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
    await supabase.from('commandes').update({
      vue_patissier_at: new Date().toISOString()
    }).eq('id', cmdId)
    setCommandes(prev => prev.map(c => c.id === cmdId ? { ...c, vue_patissier_at: new Date().toISOString() } : c))
    showToast('Pris en compte ✓')
  }

  const marquerFabrication = async (cmdId: string) => {
    await supabase.from('commandes').update({
      fabrication_at: new Date().toISOString()
    }).eq('id', cmdId)
    setCommandes(prev => prev.map(c => c.id === cmdId ? { ...c, fabrication_at: new Date().toISOString() } : c))
    showToast('Fabrication démarrée 🔥')
  }

  const marquerPret = async (cmdId: string, clientNom: string) => {
    await supabase.from('commandes').update({
      pret_at: new Date().toISOString()
    }).eq('id', cmdId)
    // Notifier La Framboise
    await supabase.from('notifications').insert({
      destinataire: commandes.find(c => c.id === cmdId)?.client_id,
      type: 'commande_prete',
      titre: 'Votre commande est prête !',
      message: 'Vous pouvez venir récupérer votre commande.',
    })
    setCommandes(prev => prev.map(c => c.id === cmdId ? { ...c, pret_at: new Date().toISOString() } : c))
    showToast('Commande prête ✅')
  }

  const marquerRemis = async (cmdId: string) => {
    await supabase.from('commandes').update({
      remis_at: new Date().toISOString()
    }).eq('id', cmdId)
    setCommandes(prev => prev.map(c => c.id === cmdId ? { ...c, remis_at: new Date().toISOString() } : c))
    showToast('Remis au client ✓')
  }

  // Agréger les produits à fabriquer
  const byProduit: Record<string, { total: number, clients: { nom: string, color: string, qty: number }[], familleId: string }> = {}
  commandes.forEach(cmd => {
    const clientNom = cmd.users?.nom || '?'
    const clientColor = cmd.users?.couleur || D.or
    ;(cmd.commande_lignes || []).forEach((ligne: any) => {
      const key = ligne.produit_id
      if (!byProduit[key]) byProduit[key] = { total: 0, clients: [], familleId: '' }
      byProduit[key].total += ligne.quantite
      byProduit[key].clients.push({ nom: clientNom, color: clientColor, qty: ligne.quantite })
    })
  })

  const totalProds = Object.keys(byProduit).length
  const termines   = Object.values(prodStatuts).filter(s => s === 'termine').length
  const enCours    = Object.values(prodStatuts).filter(s => s === 'en_cours').length
  const ruptures   = Object.values(prodStatuts).filter(s => s === 'rupture').length
  const nbNouvelles = commandes.filter(c => !c.vue_patissier_at).length

  const navItems = NAV.map(n => ({
    ...n,
    badge: n.id === 'commandes'   ? nbNouvelles
         : n.id === 'fabrication' ? enCours
         : n.id === 'pret'        ? termines
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
      <AppHeader user={user} onLogout={onLogout} badge={ruptures} />
      {totalProds > 0 && <ProgressBar value={termines} total={totalProds} />}
      <div className="tabs-container" style={{ display: 'flex', background: 'white', borderBottom: `1.5px solid ${D.craieDark}`, overflowX: 'auto' }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} style={{
            flex: 1, padding: '11px 8px', background: 'none', border: 'none',
            borderBottom: `2px solid ${tab === item.id ? D.or : 'transparent'}`,
            fontSize: 11, fontWeight: tab === item.id ? 600 : 400,
            color: tab === item.id ? D.or : D.grisClair,
            cursor: 'pointer', whiteSpace: 'nowrap', position: 'relative',
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
        {tab === 'commandes'   && <PatissierCommandes commandes={commandes} marquerVue={marquerVue} marquerFabrication={marquerFabrication} />}
        {tab === 'fabrication' && <PatissierFabrication familles={familles} produits={produits} byProduit={byProduit} prodStatuts={prodStatuts} saveProdStatut={saveProdStatut} />}
        {tab === 'pret'        && <PatissierPret commandes={commandes} prodStatuts={prodStatuts} byProduit={byProduit} produits={produits} marquerPret={marquerPret} marquerRemis={marquerRemis} />}
        {tab === 'rajouts'     && <PatissierRajouts commandes={commandes} produits={produits} familles={familles} showToast={showToast} load={load} />}
        {tab === 'stock'       && <PatissierStock user={user} matieres={matieres} showToast={showToast} load={load} />}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// COMMANDES
// ═══════════════════════════════════════════════
function PatissierCommandes({ commandes, marquerVue, marquerFabrication }: {
  commandes: any[], marquerVue: (id: string) => void, marquerFabrication: (id: string) => void
}) {
  if (commandes.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center', color: D.gris }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
      <div style={{ fontSize: 14 }}>Aucune commande validée</div>
      <div style={{ fontSize: 12, marginTop: 6, color: D.grisClair }}>En attente de validation du gérant</div>
    </div>
  )

  return (
    <div style={{ padding: 14 }}>
      <div style={{ fontSize: 12, color: D.gris, marginBottom: 12 }}>
        {commandes.length} commande{commandes.length > 1 ? 's' : ''} aujourd'hui
      </div>
      {commandes.map((cmd: any) => {
        const isVue = !!cmd.vue_patissier_at
        const isFab = !!cmd.fabrication_at
        const color = cmd.users?.couleur || D.or
        const tot = (cmd.commande_lignes || []).reduce((s: number, l: any) => s + l.quantite, 0)

        return (
          <Card key={cmd.id} borderColor={isFab ? D.or : isVue ? D.vert : color}>
            <div style={{ padding: '12px 14px' }}>
              {/* En-tête */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar nom={cmd.users?.nom || '?'} couleur={color} size={36} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: D.ardoise }}>{cmd.users?.nom || '?'}</div>
                    <div style={{ fontSize: 11, color: D.gris, marginTop: 1 }}>{tot} pièces</div>
                  </div>
                </div>
                <Badge type={isFab ? 'or' : isVue ? 'vert' : 'gris'}>
                  {isFab ? '🔥 En fab.' : isVue ? '✓ Vu' : 'Nouveau'}
                </Badge>
              </div>

              {/* Horodatages */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                {cmd.vue_patissier_at && (
                  <div style={{ fontSize: 10, color: D.vert }}>
                    ✓ Pris en compte {new Date(cmd.vue_patissier_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                )}
                {cmd.fabrication_at && (
                  <div style={{ fontSize: 10, color: D.or }}>
                    🔥 Fab. démarrée {new Date(cmd.fabrication_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                )}
              </div>

              {/* Produits */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                {(cmd.commande_lignes || []).map((ligne: any) => (
                  <span key={ligne.id} style={{
                    background: `${color}12`, color: color,
                    borderRadius: 6, padding: '3px 8px', fontSize: 11,
                  }}>
                    {ligne.nom_produit} ×{ligne.quantite}
                  </span>
                ))}
              </div>

              {/* Notes client */}
              {(cmd.commande_lignes || []).some((l: any) => l.note) && (
                <div style={{ background: `${D.or}08`, borderRadius: 8, padding: '7px 10px', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: D.or, fontWeight: 600, marginBottom: 4 }}>📝 Notes client</div>
                  {(cmd.commande_lignes || []).filter((l: any) => l.note).map((l: any) => (
                    <div key={l.id} style={{ fontSize: 11, color: D.ardoise }}>
                      <strong>{l.nom_produit}</strong> — {l.note}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              {!isVue && (
                <button onClick={() => marquerVue(cmd.id)} className="press" style={{
                  width: '100%', padding: 11, background: D.ardoise, color: 'white',
                  border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>Pris en compte ✓</button>
              )}
              {isVue && !isFab && (
                <button onClick={() => marquerFabrication(cmd.id)} className="press" style={{
                  width: '100%', padding: 11, background: D.or, color: 'white',
                  border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>🔥 Démarrer la fabrication</button>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════
// FABRICATION
// ═══════════════════════════════════════════════
function PatissierFabrication({ familles, produits, byProduit, prodStatuts, saveProdStatut }: {
  familles: any[], produits: any[], byProduit: any,
  prodStatuts: Record<string, string>, saveProdStatut: (id: string, statut: string, nom: string) => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const prodsAFaire = produits.filter(p => byProduit[p.id])
  if (prodsAFaire.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center', color: D.gris }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>👨‍🍳</div>
      <div style={{ fontSize: 14 }}>Aucune production pour aujourd'hui</div>
    </div>
  )

  const getFamilyStatut = (famProds: any[]) => {
    if (famProds.length === 0) return null
    if (famProds.every(p => prodStatuts[p.id] === 'termine')) return 'termine'
    if (famProds.some(p => prodStatuts[p.id] === 'en_cours')) return 'en_cours'
    if (famProds.some(p => prodStatuts[p.id] === 'rupture')) return 'rupture'
    return 'a_faire'
  }

  const setFamilyStatut = (famProds: any[], statut: string) => {
    famProds.forEach(p => saveProdStatut(p.id, statut, p.nom))
  }

  return (
    <div style={{ padding: 14, paddingBottom: 20 }}>
      {familles.map(famille => {
        const famProds = produits.filter(p => p.famille_id === famille.id && byProduit[p.id])
        if (famProds.length === 0) return null

        const famStatut = getFamilyStatut(famProds)
        const isExp = expanded[famille.id]
        const totalFam = famProds.reduce((s, p) => s + (byProduit[p.id]?.total || 0), 0)
        const terminesFam = famProds.filter(p => prodStatuts[p.id] === 'termine').length
        const rupsFam = famProds.filter(p => prodStatuts[p.id] === 'rupture').length
        const borderColor = famStatut === 'termine' ? D.vert : famStatut === 'en_cours' ? D.or : famStatut === 'rupture' ? D.rouge : D.craieDark

        return (
          <div key={famille.id} style={{
            background: 'white', borderRadius: 16, border: `1px solid ${D.craieDark}`,
            marginBottom: 10, overflow: 'hidden', position: 'relative',
            opacity: famStatut === 'termine' ? .75 : 1,
          }}>
            {/* Barre latérale colorée — signature */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: borderColor, transition: 'background .3s' }} />

            <div style={{ padding: '14px 14px 14px 18px' }}>
              {/* En-tête famille */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: famStatut !== 'termine' ? 12 : 0 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: famStatut === 'termine' ? D.vertBg : famStatut === 'en_cours' ? D.orangeBg : famStatut === 'rupture' ? D.rougeBg : D.craieMid,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                }}>
                  {famStatut === 'termine' ? '✅' : famStatut === 'en_cours' ? '🔥' : famStatut === 'rupture' ? '🔴' : '⬜'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: famStatut === 'termine' ? D.vert : famStatut === 'en_cours' ? D.orange : famStatut === 'rupture' ? D.rouge : D.ardoise }}>
                    {famille.nom}
                  </div>
                  <div style={{ fontSize: 11, color: D.gris, marginTop: 2, display: 'flex', gap: 8 }}>
                    <span>{terminesFam}/{famProds.length} terminés</span>
                    {rupsFam > 0 && <span style={{ color: D.rouge }}>· {rupsFam} rupture{rupsFam > 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <div style={{
                  background: famStatut === 'termine' ? D.vert : famStatut === 'en_cours' ? D.or : D.ardoise,
                  color: 'white', borderRadius: 12, padding: '6px 14px', textAlign: 'center', minWidth: 60,
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{totalFam}</div>
                  <div style={{ fontSize: 9, opacity: .8 }}>pcs</div>
                </div>
              </div>

              {/* Actions famille */}
              {famStatut !== 'termine' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {famStatut === 'a_faire' && (
                    <button onClick={() => setFamilyStatut(famProds, 'en_cours')} className="press" style={{ flex: 1, padding: 11, background: D.ardoise, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      🔥 Commencer
                    </button>
                  )}
                  {famStatut === 'en_cours' && (
                    <button onClick={() => setFamilyStatut(famProds, 'termine')} className="press" style={{ flex: 1, padding: 11, background: D.vert, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      ✅ Famille terminée !
                    </button>
                  )}
                  <button onClick={() => setExpanded(e => ({ ...e, [famille.id]: !e[famille.id] }))} style={{ padding: '11px 12px', background: D.craieMid, border: `1px solid ${D.craieDark}`, borderRadius: 10, color: D.gris, fontSize: 12, cursor: 'pointer' }}>
                    {isExp ? '▲' : '▼'}
                  </button>
                </div>
              )}
              {famStatut === 'termine' && (
                <button onClick={() => setFamilyStatut(famProds, 'en_cours')} style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${D.craieDark}`, borderRadius: 8, color: D.gris, fontSize: 11, cursor: 'pointer' }}>
                  ↩ Rouvrir
                </button>
              )}
            </div>

            {/* Détail produits */}
            {(isExp || famStatut === 'en_cours') && (
              <div style={{ borderTop: `1px solid ${D.craieDark}`, background: D.craie }}>
                {famProds.map((prod: any) => {
                  const statut = prodStatuts[prod.id] || 'a_faire'
                  const data = byProduit[prod.id]
                  const isRup = statut === 'rupture'
                  return (
                    <div key={prod.id} style={{ padding: '10px 14px 10px 18px', borderBottom: `1px solid ${D.craieDark}`, display: 'flex', alignItems: 'center', gap: 8, opacity: isRup ? .5 : 1 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: statut === 'termine' ? D.vert : isRup ? D.rouge : D.ardoise }}>
                          {statut === 'termine' ? '✅ ' : isRup ? '🔴 ' : ''}{prod.nom}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                          {data.clients.map((c: any, i: number) => (
                            <span key={i} style={{ background: `${c.color}12`, color: c.color, borderRadius: 5, padding: '1px 6px', fontSize: 10 }}>
                              {c.nom} ×{c.qty}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: statut === 'termine' ? D.vert : isRup ? D.rouge : D.or, minWidth: 36, textAlign: 'center' }}>{data.total}</div>
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
function PatissierPret({ commandes, prodStatuts, byProduit, produits, marquerPret, marquerRemis }: {
  commandes: any[], prodStatuts: Record<string, string>, byProduit: any,
  produits: any[], marquerPret: (id: string, nom: string) => void, marquerRemis: (id: string) => void
}) {
  const termines = Object.entries(byProduit).filter(([id]) => prodStatuts[id] === 'termine')
  const totalPcs = termines.reduce((s, [, d]) => s + (d as any).total, 0)

  if (termines.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center', color: D.gris }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
      <div style={{ fontSize: 14 }}>Rien de prêt pour l'instant</div>
      <div style={{ fontSize: 12, marginTop: 6, color: D.grisClair }}>Les produits terminés apparaîtront ici</div>
    </div>
  )

  return (
    <div style={{ padding: 14 }}>
      {/* Résumé */}
      <div style={{ background: D.vertBg, border: `1px solid ${D.vert}30`, borderRadius: 14, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 36 }}>✅</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: D.vert }}>{termines.length} références prêtes</div>
          <div style={{ fontSize: 12, color: D.gris, marginTop: 2 }}>{totalPcs} pièces au total</div>
        </div>
      </div>

      {/* Par client */}
      {commandes.map(cmd => {
        const color = cmd.users?.couleur || D.or
        const isPret = !!cmd.pret_at
        const isRemis = !!cmd.remis_at
        const lignesPrets = (cmd.commande_lignes || []).filter((l: any) => prodStatuts[l.produit_id] === 'termine')
        if (lignesPrets.length === 0) return null

        return (
          <Card key={cmd.id} borderColor={isRemis ? D.gris : isPret ? D.vert : color}>
            <div style={{ padding: '10px 14px', background: D.craieMid, borderBottom: `1px solid ${D.craieDark}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar nom={cmd.users?.nom || '?'} couleur={color} size={28} />
                <div style={{ fontSize: 13, fontWeight: 700, color: isRemis ? D.gris : color }}>{cmd.users?.nom}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: D.ardoise }}>
                {lignesPrets.reduce((s: number, l: any) => s + l.quantite, 0)} pcs
              </div>
            </div>
            {/* Produits prêts */}
            <div style={{ padding: '8px 14px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: isRemis ? 0 : 10 }}>
                {lignesPrets.map((l: any) => (
                  <span key={l.id} style={{ background: `${color}12`, color, borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                    {l.nom_produit} ×{l.quantite}
                  </span>
                ))}
              </div>
              {/* Horodatages */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: isRemis ? 0 : 8 }}>
                {cmd.pret_at && <div style={{ fontSize: 10, color: D.vert }}>✅ Prêt {new Date(cmd.pret_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>}
                {cmd.remis_at && <div style={{ fontSize: 10, color: D.gris }}>🤝 Remis {new Date(cmd.remis_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>}
              </div>
              {/* Actions */}
              {!isPret && !isRemis && (
                <button onClick={() => marquerPret(cmd.id, cmd.users?.nom || '?')} className="press" style={{ width: '100%', padding: 11, background: D.vert, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ✅ Marquer prêt
                </button>
              )}
              {isPret && !isRemis && (
                <button onClick={() => marquerRemis(cmd.id)} className="press" style={{ width: '100%', padding: 11, background: D.ardoise, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  🤝 Remis au client
                </button>
              )}
              {isRemis && (
                <div style={{ textAlign: 'center', fontSize: 12, color: D.gris }}>✓ Commande remise</div>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════
// RAJOUTS (La Framboise uniquement)
// ═══════════════════════════════════════════════
function PatissierRajouts({ commandes, produits, familles, showToast, load }: {
  commandes: any[], produits: any[], familles: any[], showToast: ShowToast, load: () => void
}) {
  const [qties, setQties]     = useState<Record<string, number>>({})
  const [notes, setNotes]     = useState<Record<string, string>>({})
  const [cmdId, setCmdId]     = useState<string>('')
  const [editing, setEditing] = useState<any>(null)
  const [editVal, setEditVal] = useState('0')
  const [saving, setSaving]   = useState(false)

  // Commandes La Framboise uniquement
  const framboiseCmd = commandes.find(c => c.users?.role === 'framboise')

  const total = Object.values(qties).reduce((s, v) => s + v, 0)
  const totalHT = produits.reduce((s, p) => s + (p.prix_base * (qties[p.id] || 0)), 0)

  const pad = (v: string) => setEditVal(prev => prev === '0' ? v : prev + v)
  const confirm = () => {
    if (editing) {
      const v = parseInt(editVal) || 0
      setQties(prev => ({ ...prev, [editing.id]: Math.max(0, v) }))
    }
    setEditing(null)
  }

  const valider = async () => {
    if (total === 0) { showToast('Sélectionner des produits', 'err'); return }
    setSaving(true)
    const inserts = produits
      .filter(p => (qties[p.id] || 0) > 0)
      .map(p => ({
        commande_id: framboiseCmd?.id || null,
        produit_id: p.id,
        nom_produit: p.nom,
        quantite: qties[p.id],
        prix_unit: p.prix_base,
        note: notes[p.id] || null,
      }))
    await supabase.from('rajouts').insert(inserts)
    showToast(`Rajout confirmé — ${total} pièces ✓`)
    setSaving(false)
    setQties({})
    setNotes({})
    load()
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: '10px 14px 6px', background: D.craieMid, borderBottom: `1px solid ${D.craieDark}` }}>
        <div style={{ fontSize: 12, color: D.gris }}>Rajouts La Framboise — produits supplémentaires hors commande initiale</div>
      </div>

      {familles.map(famille => {
        const famProds = produits.filter(p => p.famille_id === famille.id)
        if (famProds.length === 0) return null
        return (
          <div key={famille.id}>
            <SectionLabel>{famille.nom}</SectionLabel>
            {famProds.map(prod => {
              const q = qties[prod.id] || 0
              return (
                <div key={prod.id} style={{ borderBottom: `1px solid ${D.craieDark}`, background: q > 0 ? `${D.or}06` : 'white', borderLeft: q > 0 ? `3px solid ${D.or}` : '3px solid transparent' }}>
                  <div onClick={() => { setEditing(prod); setEditVal(String(q || 0)) }}
                    style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: q > 0 ? D.orange : D.ardoise, fontWeight: q > 0 ? 600 : 400 }}>{prod.nom}</div>
                      <div style={{ fontSize: 10, color: D.grisClair, marginTop: 1 }}>{Number(prod.prix_base).toFixed(2)} € HT</div>
                    </div>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: q > 0 ? D.ardoise : D.craieMid, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {q > 0 ? <span style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{q}</span> : <span style={{ fontSize: 22, color: D.grisClair }}>+</span>}
                    </div>
                  </div>
                  {q > 0 && (
                    <div style={{ padding: '0 14px 10px' }} onClick={e => e.stopPropagation()}>
                      <input
                        value={notes[prod.id] || ''}
                        onChange={e => setNotes(prev => ({ ...prev, [prod.id]: e.target.value }))}
                        placeholder="Note / exigence client..."
                        style={{ width: '100%', padding: '7px 10px', background: D.craieMid, border: `1px solid ${D.craieDark}`, borderRadius: 8, fontSize: 11, color: D.ardoise, outline: 'none' }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Pavé numérique */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,.65)', zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setEditing(null)}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '20px 16px 32px' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: D.ardoise }}>{editing.nom}</div>
              <div style={{ fontSize: 11, color: D.grisClair, marginTop: 2 }}>Rajout supplémentaire</div>
            </div>
            <div style={{ background: D.craieMid, borderRadius: 14, padding: '14px 20px', marginBottom: 14, textAlign: 'center', border: `2px solid ${D.or}` }}>
              <div className="serif" style={{ fontSize: 52, fontWeight: 300, color: D.ardoise, lineHeight: 1 }}>{editVal || '0'}</div>
              <div style={{ fontSize: 12, color: D.gris, marginTop: 4 }}>pièces</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              {['1','2','3','4','5','6','7','8','9'].map(n => (
                <button key={n} onClick={() => pad(n)} style={{ height: 58, borderRadius: 12, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.ardoise, fontSize: 22, fontWeight: 400, cursor: 'pointer' }}>{n}</button>
              ))}
              <button onClick={() => setEditVal('0')} style={{ height: 58, borderRadius: 12, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.gris, fontSize: 12, cursor: 'pointer' }}>Effacer</button>
              <button onClick={() => pad('0')} style={{ height: 58, borderRadius: 12, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.ardoise, fontSize: 22, cursor: 'pointer' }}>0</button>
              <button onClick={() => setEditVal(v => v.length <= 1 ? '0' : v.slice(0, -1))} style={{ height: 58, borderRadius: 12, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.ardoise, fontSize: 20, cursor: 'pointer' }}>⌫</button>
            </div>
            <button onClick={confirm} className="press" style={{ width: '100%', padding: 14, background: D.ardoise, color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Confirmer — {editVal || 0} pcs ✓
            </button>
          </div>
        </div>
      )}

      {/* Bouton valider */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '12px 16px 28px', background: `linear-gradient(to top, ${D.craie} 70%, transparent)` }}>
        <button disabled={total === 0 || saving} onClick={valider} className="press" style={{
          width: '100%', padding: 14, background: total === 0 ? D.craieDark : D.or,
          color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600,
          cursor: total === 0 ? 'not-allowed' : 'pointer', opacity: total === 0 ? .4 : 1,
        }}>
          {saving ? 'Enregistrement...' : total === 0 ? 'Sélectionner des produits' : `Valider le rajout — ${total} pièce${total > 1 ? 's' : ''} · ${totalHT.toFixed(2)} € HT ✓`}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// STOCK PÂTISSIER
// ═══════════════════════════════════════════════
function PatissierStock({ user, matieres, showToast, load }: {
  user: User, matieres: any[], showToast: ShowToast, load: () => void
}) {
  const [view, setView]           = useState<'signaler' | 'demandes'>('signaler')
  const [selections, setSelections] = useState<Record<string, { qty: string, unite: string, prio: string }>>({})
  const [demandes, setDemandes]   = useState<any[]>([])
  const [search, setSearch]       = useState('')
  const [sending, setSending]     = useState(false)

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
    showToast(hasUrgent ? '🔴 Urgent envoyé à la direction ✓' : `${nbSel} demande${nbSel > 1 ? 's' : ''} envoyée${nbSel > 1 ? 's' : ''} ✓`)
    setSending(false)
    setSelections({})
    setView('demandes')
    // Rafraîchir demandes
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
              style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${D.craieDark}`, borderRadius: 10, fontSize: 13, color: D.ardoise, outline: 'none', background: 'white' }} />
          </div>
          {nbSel > 0 && (
            <div style={{ margin: '8px 14px', background: `${D.or}10`, border: `1px solid ${D.or}40`, borderRadius: 10, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: D.orTexte, fontWeight: 600 }}>{nbSel} produit{nbSel > 1 ? 's' : ''} sélectionné{nbSel > 1 ? 's' : ''}</span>
              <button onClick={() => setSelections({})} style={{ background: 'transparent', border: 'none', color: D.gris, fontSize: 12, cursor: 'pointer' }}>Tout effacer</button>
            </div>
          )}
          {(search.length > 1 ? [{ cat: 'Résultats', prods: filtered }] : cats.map(cat => ({ cat, prods: matieres.filter(m => m.categorie === cat) }))).map(({ cat, prods }) => (
            <div key={cat}>
              <SectionLabel>{cat}</SectionLabel>
              {(prods as any[]).map(m => {
                const sel = selections[m.id]
                const isSelected = !!sel
                return (
                  <div key={m.id}>
                    <div onClick={() => toggle(m)} style={{ padding: '13px 16px', borderBottom: `1px solid ${D.craieDark}`, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: isSelected ? `${D.or}06` : 'white' }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isSelected ? D.or : D.craieDark}`, background: isSelected ? D.or : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                        {isSelected && <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: isSelected ? D.orange : D.ardoise }}>{m.nom}</div>
                        {m.fournisseur && <div style={{ fontSize: 10, color: D.grisClair, marginTop: 1 }}>{m.fournisseur}</div>}
                      </div>
                    </div>
                    {isSelected && (
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
              {sending ? 'Envoi...' : nbSel === 0 ? 'Cocher les produits manquants' : hasUrgent ? `🔴 Envoyer URGENT — ${nbSel} produit${nbSel > 1 ? 's' : ''}` : `📦 Envoyer la demande — ${nbSel} produit${nbSel > 1 ? 's' : ''}`}
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
          ) : demandes.map(d => (
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
