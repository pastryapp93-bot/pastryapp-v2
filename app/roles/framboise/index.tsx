'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { D } from '@/lib/design'
import { AppHeader, Card, Badge, SectionLabel, Loader } from '@/app/components/ui'
import type { User } from '@/lib/supabase'

type ShowToast = (msg: string, type?: string) => void

const COULEUR = '#C17F24' // or La Framboise

// ═══════════════════════════════════════════════
// LA FRAMBOISE APP
// ═══════════════════════════════════════════════
export default function FramboiseApp({ user, onLogout, showToast }: {
  user: User, onLogout: () => void, showToast: ShowToast
}) {
  const [tab, setTab] = useState('commander')

  const NAV = [
    { id: 'commander',  icon: '🧁', label: 'Commander' },
    { id: 'historique', icon: '📋', label: 'Historique' },
    { id: 'factures',   icon: '💶', label: 'Mes factures' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppHeader user={user} onLogout={onLogout} />
      <div style={{ display: 'flex', background: 'white', borderBottom: `1.5px solid ${D.craieDark}` }}>
        {NAV.map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} style={{
            flex: 1, padding: '11px 6px', background: 'none', border: 'none',
            borderBottom: `2px solid ${tab === item.id ? COULEUR : 'transparent'}`,
            fontSize: 11, fontWeight: tab === item.id ? 600 : 400,
            color: tab === item.id ? COULEUR : D.grisClair, cursor: 'pointer',
          }}>
            {item.icon} {item.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', background: D.craie, paddingBottom: 20 }}>
        {tab === 'commander'  && <FramboiseCommander user={user} showToast={showToast} />}
        {tab === 'historique' && <FramboiseHistorique user={user} />}
        {tab === 'factures'   && <FramboiseFactures user={user} />}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// COMMANDER
// ═══════════════════════════════════════════════
function FramboiseCommander({ user, showToast }: { user: User, showToast: ShowToast }) {
  const [familles, setFamilles]     = useState<any[]>([])
  const [produits, setProduits]     = useState<any[]>([])
  const [prixClient, setPrixClient] = useState<Record<string, number>>({})
  const [qties, setQties]           = useState<Record<string, number>>({})
  const [notes, setNotes]           = useState<Record<string, string>>({})
  const [activeCat, setActiveCat]   = useState('')
  const [editing, setEditing]       = useState<any>(null)
  const [editVal, setEditVal]       = useState('0')
  const [sent, setSent]             = useState(false)
  const [sending, setSending]       = useState(false)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('familles').select('*').eq('type', 'patisserie').order('ordre'),
      supabase.from('produits').select('*').eq('type', 'patisserie').eq('actif', true).order('ordre'),
      supabase.from('prix_client').select('*').eq('client_id', user.id),
    ]).then(([{ data: f }, { data: p }, { data: pc }]) => {
      setFamilles(f || [])
      setProduits(p || [])
      const prixMap: Record<string, number> = {}
      ;(pc || []).forEach((px: any) => { prixMap[px.produit_id] = px.prix })
      setPrixClient(prixMap)
      if (f && f.length > 0) setActiveCat(f[0].id)
      setLoading(false)
    })
  }, [user.id])

  const getPrix = (prod: any) => prixClient[prod.id] ?? prod.prix_base
  const catProds = produits.filter(p => p.famille_id === activeCat)
  const total = Object.values(qties).reduce((s, v) => s + v, 0)
  const totalHT = produits.reduce((s, p) => s + (getPrix(p) * (qties[p.id] || 0)), 0)

  const pad = (v: string) => setEditVal(prev => prev === '0' ? v : prev + v)
  const confirm = () => {
    if (editing) setQties(prev => ({ ...prev, [editing.id]: Math.max(0, parseInt(editVal) || 0) }))
    setEditing(null)
  }

  const envoyer = async () => {
    if (total === 0) return
    setSending(true)

    const lignes = produits
      .filter(p => (qties[p.id] || 0) > 0)
      .map(p => ({
        produit_id: p.id, nom_produit: p.nom,
        quantite: qties[p.id], prix_unit: getPrix(p),
        note: notes[p.id] || null,
      }))

    const totalHTFinal = lignes.reduce((s, l) => s + l.quantite * l.prix_unit, 0)

    const { data: cmd } = await supabase.from('commandes').insert({
      client_id: user.id, statut: 'en_attente', total_ht: totalHTFinal,
    }).select().single()

    if (cmd) {
      await supabase.from('commande_lignes').insert(
        lignes.map(l => ({ ...l, commande_id: cmd.id }))
      )
      // Notifier la direction
      const { data: gerant } = await supabase.from('users').select('id').eq('role', 'gerant').single()
      if (gerant) {
        await supabase.from('notifications').insert({
          destinataire: gerant.id,
          type: 'nouvelle_commande',
          titre: `Nouvelle commande — La Framboise`,
          message: `${total} pièces · ${totalHTFinal.toFixed(2)} € HT`,
        })
      }
    }

    setSending(false); setSent(true)
    showToast('Commande envoyée ✓')
  }

  if (loading) return <Loader />

  if (sent) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', minHeight: 400 }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: `${COULEUR}15`, border: `2px solid ${COULEUR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 20px' }}>✓</div>
      <div className="serif" style={{ fontSize: 26, fontWeight: 300, color: D.ardoise, marginBottom: 8 }}>Commande envoyée !</div>
      <div style={{ color: D.gris, fontSize: 13, marginBottom: 6 }}>En attente de validation</div>
      <div style={{ fontSize: 12, color: D.grisClair, marginBottom: 6 }}>{total} pièces · {totalHT.toFixed(2)} € HT</div>
      <div style={{ fontSize: 11, color: D.grisClair, marginBottom: 28 }}>Vous recevrez une notification dès validation</div>
      <button onClick={() => { setSent(false); setQties({}); setNotes({}) }} style={{ padding: '10px 24px', background: 'transparent', border: `1.5px solid ${D.craieDark}`, color: D.ardoise, borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
        Nouvelle commande
      </button>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* En-tête avec total */}
      <div style={{ background: 'white', padding: '10px 14px', borderBottom: `1px solid ${D.craieDark}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="serif" style={{ fontSize: 15, fontWeight: 300, color: COULEUR }}>La Framboise</div>
          <div style={{ fontSize: 10, color: D.grisClair, marginTop: 1 }}>Pâtisserie uniquement</div>
        </div>
        {total > 0 && (
          <div style={{ background: `${COULEUR}12`, border: `1.5px solid ${COULEUR}30`, borderRadius: 12, padding: '6px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: COULEUR }}>{total}</div>
            <div style={{ fontSize: 9, color: D.gris }}>{totalHT.toFixed(2)} € HT</div>
          </div>
        )}
      </div>

      {/* Onglets familles */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${D.craieDark}`, scrollbarWidth: 'none', background: 'white' }}>
        {familles.map(f => {
          const catTot = produits.filter(p => p.famille_id === f.id).reduce((s, p) => s + (qties[p.id] || 0), 0)
          return (
            <button key={f.id} onClick={() => setActiveCat(f.id)} style={{
              flexShrink: 0, padding: '10px 14px', background: 'none', border: 'none',
              borderBottom: `2px solid ${activeCat === f.id ? COULEUR : 'transparent'}`,
              fontSize: 11, cursor: 'pointer',
              color: activeCat === f.id ? COULEUR : D.gris,
              fontWeight: activeCat === f.id ? 600 : 400, whiteSpace: 'nowrap',
            }}>
              {f.nom}
              {catTot > 0 && (
                <span style={{ marginLeft: 5, background: `${COULEUR}15`, color: COULEUR, borderRadius: 10, padding: '1px 6px', fontSize: 9, fontWeight: 700 }}>{catTot}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Produits */}
      <div style={{ paddingBottom: 100 }}>
        {catProds.map(prod => {
          const q = qties[prod.id] || 0
          const px = getPrix(prod)
          const hasPrixSpecial = prixClient[prod.id] !== undefined && prixClient[prod.id] !== prod.prix_base

          return (
            <div key={prod.id} style={{
              borderBottom: `1px solid ${D.craieDark}`,
              background: q > 0 ? `${COULEUR}06` : 'white',
              borderLeft: q > 0 ? `3px solid ${COULEUR}` : '3px solid transparent',
            }}>
              <div onClick={() => { setEditing(prod); setEditVal(String(q || 0)) }}
                style={{ padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: q > 0 ? COULEUR : D.ardoise, fontWeight: q > 0 ? 600 : 400 }}>{prod.nom}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: hasPrixSpecial ? COULEUR : D.grisClair, fontWeight: hasPrixSpecial ? 600 : 400 }}>
                      {px.toFixed(2)} € HT
                    </span>
                    {hasPrixSpecial && (
                      <span style={{ fontSize: 9, background: `${COULEUR}15`, color: COULEUR, borderRadius: 6, padding: '1px 5px' }}>Tarif perso</span>
                    )}
                  </div>
                </div>
                <div style={{
                  width: 50, height: 50, borderRadius: 14,
                  background: q > 0 ? COULEUR : D.craieMid,
                  border: `1.5px solid ${q > 0 ? COULEUR : D.craieDark}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {q > 0 ? <span style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>{q}</span> : <span style={{ fontSize: 24, color: D.grisClair }}>+</span>}
                </div>
              </div>

              {/* Note client */}
              {q > 0 && (
                <div style={{ padding: '0 14px 12px' }} onClick={e => e.stopPropagation()}>
                  <input
                    value={notes[prod.id] || ''}
                    onChange={e => setNotes(prev => ({ ...prev, [prod.id]: e.target.value }))}
                    placeholder="Exigence client (ex: Joyeux anniversaire Bernard, allergie noix...)"
                    style={{ width: '100%', padding: '8px 12px', background: `${COULEUR}06`, border: `1.5px solid ${COULEUR}30`, borderRadius: 9, fontSize: 12, color: D.ardoise, outline: 'none', fontFamily: 'inherit' }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pavé numérique */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,.65)', zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setEditing(null)}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '20px 16px 32px' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: D.ardoise }}>{editing.nom}</div>
              <div style={{ fontSize: 11, color: D.grisClair, marginTop: 2 }}>{getPrix(editing).toFixed(2)} € HT / {editing.unite}</div>
            </div>
            <div style={{ background: D.craieMid, borderRadius: 14, padding: '14px 20px', marginBottom: 14, textAlign: 'center', border: `2px solid ${COULEUR}` }}>
              <div className="serif" style={{ fontSize: 56, fontWeight: 300, color: D.ardoise, lineHeight: 1 }}>{editVal || '0'}</div>
              <div style={{ fontSize: 12, color: D.gris, marginTop: 4 }}>pièces</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              {['1','2','3','4','5','6','7','8','9'].map(n => (
                <button key={n} onClick={() => pad(n)} style={{ height: 60, borderRadius: 12, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.ardoise, fontSize: 24, cursor: 'pointer' }}>{n}</button>
              ))}
              <button onClick={() => setEditVal('0')} style={{ height: 60, borderRadius: 12, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.gris, fontSize: 13, cursor: 'pointer' }}>Effacer</button>
              <button onClick={() => pad('0')} style={{ height: 60, borderRadius: 12, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.ardoise, fontSize: 24, cursor: 'pointer' }}>0</button>
              <button onClick={() => setEditVal(v => v.length <= 1 ? '0' : v.slice(0, -1))} style={{ height: 60, borderRadius: 12, background: D.craieMid, border: `1px solid ${D.craieDark}`, color: D.ardoise, fontSize: 20, cursor: 'pointer' }}>⌫</button>
            </div>
            <button onClick={confirm} className="press" style={{ width: '100%', padding: 14, background: COULEUR, color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Confirmer — {editVal || 0} pcs ✓
            </button>
          </div>
        </div>
      )}

      {/* Bouton envoyer */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '12px 16px 28px', background: `linear-gradient(to top, ${D.craie} 70%, transparent)` }}>
        <button disabled={total === 0 || sending} onClick={envoyer} className="press" style={{
          width: '100%', padding: 14,
          background: total === 0 ? D.craieDark : COULEUR,
          color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600,
          cursor: total === 0 ? 'not-allowed' : 'pointer', opacity: total === 0 ? .4 : 1,
        }}>
          {sending ? 'Envoi...' : total === 0 ? 'Sélectionner des produits' : `Envoyer · ${total} pièce${total > 1 ? 's' : ''} · ${totalHT.toFixed(2)} € HT →`}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// HISTORIQUE
// ═══════════════════════════════════════════════
function FramboiseHistorique({ user }: { user: User }) {
  const [commandes, setCommandes] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    supabase.from('commandes')
      .select('*, commande_lignes(nom_produit, quantite, note, prix_unit), rajouts(nom_produit, quantite, note, prix_unit)')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => { setCommandes(data || []); setLoading(false) })
  }, [user.id])

  const STATUT_LABEL: Record<string, string> = {
    en_attente: '⏳ En attente de validation',
    validee:    '✓ Validée — en production',
    refusee:    '✕ Refusée',
  }
  const STATUT_TYPE: Record<string, any> = {
    en_attente: 'or', validee: 'vert', refusee: 'rouge',
  }

  if (loading) return <Loader />

  if (commandes.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center', color: D.gris }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
      <div style={{ fontSize: 14 }}>Aucune commande pour l'instant</div>
    </div>
  )

  return (
    <div style={{ padding: 14 }}>
      {commandes.map((cmd: any) => {
        const lignes = cmd.commande_lignes || []
        const rajouts = cmd.rajouts || []
        const tot = lignes.reduce((s: number, l: any) => s + l.quantite, 0)
        const totRaj = rajouts.reduce((s: number, r: any) => s + r.quantite, 0)
        const totalHT = lignes.reduce((s: number, l: any) => s + l.quantite * l.prix_unit, 0)
          + rajouts.reduce((s: number, r: any) => s + r.quantite * r.prix_unit, 0)

        return (
          <Card key={cmd.id} borderColor={COULEUR}>
            <div style={{ padding: '12px 14px' }}>
              {/* En-tête */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: D.ardoise }}>
                    {new Date(cmd.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <div style={{ fontSize: 11, color: D.gris, marginTop: 2 }}>
                    {new Date(cmd.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}{tot + totRaj} pcs · {totalHT.toFixed(2)} € HT
                  </div>
                </div>
                <Badge type={STATUT_TYPE[cmd.statut] || 'gris'}>
                  {STATUT_LABEL[cmd.statut] || cmd.statut}
                </Badge>
              </div>

              {/* Suivi production */}
              {cmd.statut === 'validee' && (
                <div style={{ background: D.craieMid, borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {[
                      { label: 'Validée', at: cmd.validee_at, icon: '✓' },
                      { label: 'En labo', at: cmd.fabrication_at, icon: '🔥' },
                      { label: 'Prête', at: cmd.pret_at, icon: '✅' },
                      { label: 'Remise', at: cmd.remis_at, icon: '🤝' },
                    ].map(step => (
                      <div key={step.label} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 16, marginBottom: 2, opacity: step.at ? 1 : .3 }}>{step.icon}</div>
                        <div style={{ fontSize: 9, color: step.at ? D.vert : D.grisClair, fontWeight: step.at ? 600 : 400 }}>{step.label}</div>
                        {step.at && <div style={{ fontSize: 8, color: D.grisClair, marginTop: 1 }}>{new Date(step.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Produits commandés */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: rajouts.length > 0 ? 6 : 0 }}>
                {lignes.map((l: any, i: number) => (
                  <div key={i}>
                    <span style={{ background: `${COULEUR}10`, color: COULEUR, borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                      {l.nom_produit} ×{l.quantite}
                    </span>
                    {l.note && (
                      <div style={{ fontSize: 10, color: D.gris, marginTop: 2, marginLeft: 4, fontStyle: 'italic' }}>
                        📝 {l.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Rajouts */}
              {rajouts.length > 0 && (
                <div style={{ marginTop: 6, padding: '6px 10px', background: `${D.or}08`, borderRadius: 8, border: `1px solid ${D.or}20` }}>
                  <div style={{ fontSize: 10, color: D.or, fontWeight: 600, marginBottom: 4 }}>➕ Rajouts</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {rajouts.map((r: any, i: number) => (
                      <span key={i} style={{ background: `${D.or}15`, color: D.or, borderRadius: 6, padding: '2px 7px', fontSize: 10 }}>
                        {r.nom_produit} ×{r.quantite}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════
// FACTURES (max 12 — nettoyage auto)
// ═══════════════════════════════════════════════
function FramboiseFactures({ user }: { user: User }) {
  const [factures, setFactures] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [openId, setOpenId]     = useState<string | null>(null)

  useEffect(() => {
    supabase.from('factures')
      .select('*, facture_lignes(*)')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => { setFactures(data || []); setLoading(false) })
  }, [user.id])

  if (loading) return <Loader />

  if (factures.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center', color: D.gris }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>💶</div>
      <div style={{ fontSize: 14 }}>Aucune facture pour l'instant</div>
      <div style={{ fontSize: 12, marginTop: 6, color: D.grisClair }}>Vos factures mensuelles apparaîtront ici</div>
    </div>
  )

  return (
    <div style={{ padding: 14 }}>
      <div style={{ background: `${COULEUR}08`, border: `1px solid ${COULEUR}20`, borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: COULEUR }}>
          📋 {factures.length}/12 factures conservées · Nettoyage automatique au-delà de 12
        </div>
      </div>

      {factures.map((f: any) => (
        <Card key={f.id}>
          {/* En-tête cliquable */}
          <div onClick={() => setOpenId(openId === f.id ? null : f.id)}
            style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: openId === f.id ? D.craieMid : 'white' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: D.ardoise }}>{f.numero}</div>
              <div style={{ fontSize: 11, color: D.gris, marginTop: 2 }}>
                {f.periode ? (() => {
                  const [y, m] = f.periode.split('-')
                  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                })() : new Date(f.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="serif" style={{ fontSize: 20, fontWeight: 300, color: D.ardoise }}>{Number(f.total_ttc).toFixed(2)} €</div>
              <div style={{ marginTop: 3 }}>
                <Badge type={f.statut === 'payee' ? 'vert' : f.statut === 'envoyee' ? 'bleu' : 'gris'}>
                  {f.statut === 'payee' ? '✅ Payée' : f.statut === 'envoyee' ? '📨 Envoyée' : 'Brouillon'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Détail lignes */}
          {openId === f.id && (
            <div style={{ borderTop: `1px solid ${D.craieDark}` }}>
              {(f.facture_lignes || []).map((l: any, i: number) => (
                <div key={i} style={{ padding: '8px 14px', borderBottom: `1px solid ${D.craieDark}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: D.ardoise }}>{l.description}</div>
                    <div style={{ fontSize: 10, color: D.gris, marginTop: 1 }}>{l.quantite} × {Number(l.prix_unit).toFixed(2)} € HT</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COULEUR }}>{Number(l.total).toFixed(2)} €</div>
                </div>
              ))}
              {/* Totaux */}
              <div style={{ padding: '10px 14px', background: D.craieMid }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: D.gris, marginBottom: 3 }}>
                  <span>Sous-total HT</span><span>{Number(f.total_ht).toFixed(2)} €</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: D.gris, marginBottom: 8 }}>
                  <span>TVA {Number(f.tva_pct)}%</span>
                  <span>{(Number(f.total_ht) * Number(f.tva_pct) / 100).toFixed(2)} €</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: D.ardoise }}>
                  <span>Total TTC</span><span>{Number(f.total_ttc).toFixed(2)} €</span>
                </div>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
