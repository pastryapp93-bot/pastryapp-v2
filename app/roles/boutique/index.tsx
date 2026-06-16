'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { D } from '@/lib/design'
import { AppHeader, Card, Badge, SectionLabel, Loader } from '@/app/components/ui'
import type { User } from '@/lib/supabase'

type ShowToast = (msg: string, type?: string) => void

// ═══════════════════════════════════════════════
// BOUTIQUE APP — QG Livry + Atelier des Saveurs
// ═══════════════════════════════════════════════
export default function BoutiqueApp({ user, onLogout, showToast }: {
  user: User, onLogout: () => void, showToast: ShowToast
}) {
  const [tab, setTab] = useState('patisserie')

  const boulangerRole = user.role === 'boutique_livry' ? 'boulanger_livry' : 'boulanger_villemomble'
  const couleur = user.couleur || D.bleu

  const NAV = [
    { id: 'patisserie', icon: '🧁', label: 'Pâtisserie' },
    { id: 'pain',       icon: '🍞', label: 'Pain' },
    { id: 'historique', icon: '📋', label: 'Historique' },
    { id: 'stock',      icon: '📦', label: 'Stock' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppHeader user={user} onLogout={onLogout} />
      <div style={{ display: 'flex', background: 'white', borderBottom: `1.5px solid ${D.craieDark}` }}>
        {NAV.map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} style={{
            flex: 1, padding: '11px 6px', background: 'none', border: 'none',
            borderBottom: `2px solid ${tab === item.id ? couleur : 'transparent'}`,
            fontSize: 11, fontWeight: tab === item.id ? 600 : 400,
            color: tab === item.id ? couleur : D.grisClair, cursor: 'pointer',
          }}>
            {item.icon} {item.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', background: D.craie, paddingBottom: 20 }}>
        {tab === 'patisserie' && <BoutiqueCommander user={user} showToast={showToast} couleur={couleur} />}
        {tab === 'pain'       && <BoutiqueCommanderPain user={user} boulangerRole={boulangerRole} showToast={showToast} couleur={couleur} />}
        {tab === 'historique' && <BoutiqueHistorique user={user} couleur={couleur} />}
        {tab === 'stock'      && <BoutiqueStock user={user} showToast={showToast} />}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// COMMANDER PÂTISSERIE
// ═══════════════════════════════════════════════
function BoutiqueCommander({ user, showToast, couleur }: {
  user: User, showToast: ShowToast, couleur: string
}) {
  const [familles, setFamilles]   = useState<any[]>([])
  const [produits, setProduits]   = useState<any[]>([])
  const [prixClient, setPrixClient] = useState<Record<string, number>>({})
  const [qties, setQties]         = useState<Record<string, number>>({})
  const [notes, setNotes]         = useState<Record<string, string>>({})
  const [activeCat, setActiveCat] = useState('')
  const [editing, setEditing]     = useState<any>(null)
  const [editVal, setEditVal]     = useState('0')
  const [sent, setSent]           = useState(false)
  const [sending, setSending]     = useState(false)
  const [loading, setLoading]     = useState(true)

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
    if (editing) {
      const v = parseInt(editVal) || 0
      setQties(prev => ({ ...prev, [editing.id]: Math.max(0, v) }))
    }
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
      await supabase.from('notifications').insert({
        destinataire: (await supabase.from('users').select('id').eq('role','gerant').single()).data?.id,
        type: 'nouvelle_commande', titre: `Nouvelle commande — ${user.nom}`,
        message: `${total} pièces · ${totalHTFinal.toFixed(2)} € HT`,
      })
    }
    setSending(false)
    setSent(true)
    showToast('Commande envoyée ✓')
  }

  if (loading) return <Loader />

  if (sent) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', minHeight: 400 }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: `${couleur}15`, border: `2px solid ${couleur}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 20px' }}>✓</div>
      <div className="serif" style={{ fontSize: 26, fontWeight: 300, color: D.ardoise, marginBottom: 8 }}>Commande envoyée !</div>
      <div style={{ color: D.gris, fontSize: 13, marginBottom: 6 }}>En attente de validation</div>
      <div style={{ fontSize: 12, color: D.grisClair, marginBottom: 28 }}>{total} pièces · {totalHT.toFixed(2)} € HT</div>
      <button onClick={() => { setSent(false); setQties({}); setNotes({}) }} style={{ padding: '10px 24px', background: 'transparent', border: `1.5px solid ${D.craieDark}`, color: D.ardoise, borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
        Nouvelle commande
      </button>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Résumé */}
      <div style={{ background: 'white', padding: '10px 14px', borderBottom: `1px solid ${D.craieDark}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="serif" style={{ fontSize: 15, fontWeight: 300, color: couleur }}>{user.nom}</div>
          <div style={{ fontSize: 10, color: D.grisClair, marginTop: 1 }}>Avant 20h · pour demain</div>
        </div>
        {total > 0 && (
          <div style={{ background: `${couleur}12`, border: `1.5px solid ${couleur}30`, borderRadius: 12, padding: '6px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: couleur }}>{total}</div>
            <div style={{ fontSize: 9, color: D.gris }}>{totalHT.toFixed(2)} €</div>
          </div>
        )}
      </div>

      {/* Onglets catégories */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${D.craieDark}`, scrollbarWidth: 'none', background: 'white' }}>
        {familles.map(f => {
          const catTot = produits.filter(p => p.famille_id === f.id).reduce((s, p) => s + (qties[p.id] || 0), 0)
          return (
            <button key={f.id} onClick={() => setActiveCat(f.id)} style={{
              flexShrink: 0, padding: '10px 14px', background: 'none', border: 'none',
              borderBottom: `2px solid ${activeCat === f.id ? couleur : 'transparent'}`,
              fontSize: 11, cursor: 'pointer', color: activeCat === f.id ? couleur : D.gris,
              fontWeight: activeCat === f.id ? 600 : 400, whiteSpace: 'nowrap',
            }}>
              {f.nom}
              {catTot > 0 && (
                <span style={{ marginLeft: 5, background: `${couleur}15`, color: couleur, borderRadius: 10, padding: '1px 6px', fontSize: 9, fontWeight: 700 }}>{catTot}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Liste produits */}
      <div style={{ paddingBottom: 100 }}>
        {catProds.map(prod => {
          const q = qties[prod.id] || 0
          const px = getPrix(prod)
          return (
            <div key={prod.id} style={{ borderBottom: `1px solid ${D.craieDark}`, background: q > 0 ? `${couleur}05` : 'white', borderLeft: q > 0 ? `3px solid ${couleur}` : '3px solid transparent' }}>
              <div onClick={() => { setEditing(prod); setEditVal(String(q || 0)) }}
                style={{ padding: '13px 14px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: q > 0 ? couleur : D.ardoise, fontWeight: q > 0 ? 600 : 400 }}>{prod.nom}</div>
                  <div style={{ fontSize: 11, color: D.grisClair, marginTop: 2 }}>{px.toFixed(2)} € HT / {prod.unite}</div>
                </div>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: q > 0 ? couleur : D.craieMid, border: `1.5px solid ${q > 0 ? couleur : D.craieDark}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {q > 0 ? <span style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>{q}</span> : <span style={{ fontSize: 24, color: D.grisClair }}>+</span>}
                </div>
              </div>
              {q > 0 && (
                <div style={{ padding: '0 14px 10px' }} onClick={e => e.stopPropagation()}>
                  <input value={notes[prod.id] || ''} onChange={e => setNotes(prev => ({ ...prev, [prod.id]: e.target.value }))}
                    placeholder="Note / exigence client (ex: prénom, allergie...)"
                    style={{ width: '100%', padding: '7px 10px', background: D.craieMid, border: `1px solid ${D.craieDark}`, borderRadius: 8, fontSize: 11, color: D.ardoise, outline: 'none' }} />
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
            <div style={{ background: D.craieMid, borderRadius: 14, padding: '14px 20px', marginBottom: 14, textAlign: 'center', border: `2px solid ${couleur}` }}>
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
            <button onClick={confirm} className="press" style={{ width: '100%', padding: 14, background: couleur, color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Confirmer — {editVal || 0} pcs ✓
            </button>
          </div>
        </div>
      )}

      {/* Bouton envoyer */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '12px 16px 28px', background: `linear-gradient(to top, ${D.craie} 70%, transparent)` }}>
        <button disabled={total === 0 || sending} onClick={envoyer} className="press" style={{
          width: '100%', padding: 14, background: total === 0 ? D.craieDark : couleur,
          color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600,
          cursor: total === 0 ? 'not-allowed' : 'pointer', opacity: total === 0 ? .4 : 1,
        }}>
          {sending ? 'Envoi en cours...' : total === 0 ? 'Sélectionner des produits' : `Envoyer · ${total} pièce${total > 1 ? 's' : ''} · ${totalHT.toFixed(2)} € HT →`}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// COMMANDER PAIN
// ═══════════════════════════════════════════════
function BoutiqueCommanderPain({ user, boulangerRole, showToast, couleur }: {
  user: User, boulangerRole: string, showToast: ShowToast, couleur: string
}) {
  const [familles, setFamilles] = useState<any[]>([])
  const [produits, setProduits] = useState<any[]>([])
  const [qties, setQties]       = useState<Record<string, number>>({})
  const [dateLiv, setDateLiv]   = useState('')
  const [sent, setSent]         = useState(false)
  const [sending, setSending]   = useState(false)
  const [loading, setLoading]   = useState(true)

  // Dates de livraison proposées (demain + 6 jours)
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i + 1)
    return { value: d.toISOString().split('T')[0], label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) }
  })

  useEffect(() => {
    Promise.all([
      supabase.from('familles').select('*').eq('type', 'pain').order('ordre'),
      supabase.from('produits').select('*').eq('type', 'pain').eq('actif', true).order('ordre'),
    ]).then(([{ data: f }, { data: p }]) => {
      setFamilles(f || [])
      setProduits(p || [])
      setLoading(false)
    })
    setDateLiv(dates[0]?.value || '')
  }, [])

  const total = Object.values(qties).reduce((s, v) => s + v, 0)

  const setQty = (id: string, val: number) => setQties(prev => ({ ...prev, [id]: Math.max(0, val) }))

  const envoyer = async () => {
    if (total === 0 || !dateLiv) return
    setSending(true)
    const { data: boulanger } = await supabase.from('users').select('id').eq('role', boulangerRole).single()
    const { data: cmd } = await supabase.from('commandes_pain').insert({
      boutique_id: user.id, boulanger_id: boulanger?.id,
      date_livraison: dateLiv, statut: 'en_attente',
    }).select().single()
    if (cmd) {
      const lignes = produits
        .filter(p => (qties[p.id] || 0) > 0)
        .map(p => ({ commande_id: cmd.id, produit_id: p.id, nom_produit: p.nom, quantite: qties[p.id] }))
      await supabase.from('commande_pain_lignes').insert(lignes)
      // Notifier le boulanger
      if (boulanger?.id) {
        await supabase.from('notifications').insert({
          destinataire: boulanger.id,
          type: 'nouvelle_commande_pain',
          titre: `Nouvelle commande pain — ${user.nom}`,
          message: `${total} pièces pour le ${new Date(dateLiv + 'T00:00:00').toLocaleDateString('fr-FR')}`,
        })
      }
    }
    setSending(false); setSent(true)
    showToast('Commande pain envoyée ✓')
  }

  if (loading) return <Loader />

  if (sent) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', minHeight: 400 }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: `${couleur}15`, border: `2px solid ${couleur}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 20px' }}>✓</div>
      <div className="serif" style={{ fontSize: 24, fontWeight: 300, color: D.ardoise, marginBottom: 8 }}>Commande pain envoyée !</div>
      <div style={{ color: D.gris, fontSize: 13, marginBottom: 28 }}>{total} pièces pour le {new Date(dateLiv + 'T00:00:00').toLocaleDateString('fr-FR')}</div>
      <button onClick={() => { setSent(false); setQties({}) }} style={{ padding: '10px 24px', background: 'transparent', border: `1.5px solid ${D.craieDark}`, color: D.ardoise, borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>Nouvelle commande</button>
    </div>
  )

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Sélection date */}
      <div style={{ padding: '10px 14px', background: 'white', borderBottom: `1px solid ${D.craieDark}` }}>
        <div style={{ fontSize: 11, color: D.gris, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>📅 Date de livraison souhaitée</div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {dates.map(d => (
            <button key={d.value} onClick={() => setDateLiv(d.value)} style={{
              flexShrink: 0, padding: '7px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500,
              background: dateLiv === d.value ? couleur : D.craieMid,
              color: dateLiv === d.value ? 'white' : D.gris,
              border: `1px solid ${dateLiv === d.value ? couleur : D.craieDark}`,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>{d.label}</button>
          ))}
        </div>
      </div>

      {/* Produits par famille */}
      {familles.map(famille => {
        const famProds = produits.filter(p => p.famille_id === famille.id)
        if (famProds.length === 0) return null
        return (
          <div key={famille.id}>
            <SectionLabel>{famille.nom}</SectionLabel>
            {famProds.map(prod => {
              const q = qties[prod.id] || 0
              return (
                <div key={prod.id} style={{ padding: '12px 14px', borderBottom: `1px solid ${D.craieDark}`, display: 'flex', alignItems: 'center', gap: 12, background: q > 0 ? `${couleur}05` : 'white', borderLeft: q > 0 ? `3px solid ${couleur}` : '3px solid transparent' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: q > 0 ? couleur : D.ardoise, fontWeight: q > 0 ? 600 : 400 }}>{prod.nom}</div>
                    <div style={{ fontSize: 10, color: D.grisClair, marginTop: 1 }}>{prod.unite}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setQty(prod.id, q - 1)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${D.craieDark}`, background: 'white', color: D.ardoise, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <div style={{ fontSize: 16, fontWeight: 700, color: q > 0 ? couleur : D.ardoise, minWidth: 28, textAlign: 'center' }}>{q}</div>
                    <button onClick={() => setQty(prod.id, q + 1)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: couleur, color: 'white', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>+</button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Bouton envoyer */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '12px 16px 28px', background: `linear-gradient(to top, ${D.craie} 70%, transparent)` }}>
        <button disabled={total === 0 || sending || !dateLiv} onClick={envoyer} className="press" style={{
          width: '100%', padding: 14, background: total === 0 ? D.craieDark : couleur,
          color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600,
          cursor: total === 0 ? 'not-allowed' : 'pointer', opacity: total === 0 ? .4 : 1,
        }}>
          {sending ? 'Envoi...' : total === 0 ? 'Sélectionner des pains' : `Envoyer commande pain · ${total} pièces →`}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// HISTORIQUE
// ═══════════════════════════════════════════════
function BoutiqueHistorique({ user, couleur }: { user: User, couleur: string }) {
  const [commandes, setCommandes]     = useState<any[]>([])
  const [commandesPain, setCommandesPain] = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [typeFilter, setTypeFilter]   = useState<'patisserie'|'pain'>('patisserie')

  useEffect(() => {
    Promise.all([
      supabase.from('commandes')
        .select('*, commande_lignes(nom_produit, quantite, note)')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('commandes_pain')
        .select('*, commande_pain_lignes(nom_produit, quantite)')
        .eq('boutique_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]).then(([{ data: c }, { data: cp }]) => {
      setCommandes(c || [])
      setCommandesPain(cp || [])
      setLoading(false)
    })
  }, [user.id])

  const STATUT_LABEL: Record<string, string> = {
    en_attente: 'En attente', validee: 'Validée', refusee: 'Refusée',
    pret: '✅ Prêt', en_production: '🔥 En production', vue: '✓ Vu'
  }
  const STATUT_TYPE: Record<string, any> = {
    en_attente: 'or', validee: 'vert', refusee: 'rouge', pret: 'vert', en_production: 'or', vue: 'vert'
  }

  if (loading) return <Loader />

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: 'white', borderBottom: `1px solid ${D.craieDark}` }}>
        {[{ id: 'patisserie', l: '🧁 Pâtisserie' }, { id: 'pain', l: '🍞 Pain' }].map(t => (
          <button key={t.id} onClick={() => setTypeFilter(t.id as any)} style={{
            flex: 1, padding: '9px', borderRadius: 10, cursor: 'pointer',
            background: typeFilter === t.id ? D.ardoise : 'transparent',
            border: `1.5px solid ${typeFilter === t.id ? D.ardoise : D.craieDark}`,
            color: typeFilter === t.id ? 'white' : D.gris, fontSize: 12, fontWeight: 600,
          }}>{t.l}</button>
        ))}
      </div>
      <div style={{ padding: 14 }}>
        {typeFilter === 'patisserie' && (
          commandes.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: D.gris }}><div style={{ fontSize: 36, marginBottom: 10 }}>📋</div><div>Aucune commande</div></div>
          ) : commandes.map((cmd: any) => (
            <Card key={cmd.id} borderColor={couleur}>
              <div style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: D.ardoise }}>{new Date(cmd.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    <div style={{ fontSize: 11, color: D.gris, marginTop: 1 }}>{(cmd.commande_lignes || []).reduce((s: number, l: any) => s + l.quantite, 0)} pcs · {Number(cmd.total_ht).toFixed(2)} € HT</div>
                  </div>
                  <Badge type={STATUT_TYPE[cmd.statut] || 'gris'}>{STATUT_LABEL[cmd.statut] || cmd.statut}</Badge>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(cmd.commande_lignes || []).map((l: any, i: number) => (
                    <span key={i} style={{ background: `${couleur}10`, color: couleur, borderRadius: 6, padding: '2px 7px', fontSize: 10 }}>{l.nom_produit} ×{l.quantite}</span>
                  ))}
                </div>
                {(cmd.commande_lignes || []).some((l: any) => l.note) && (
                  <div style={{ marginTop: 6, padding: '5px 8px', background: `${D.or}08`, borderRadius: 6 }}>
                    {(cmd.commande_lignes || []).filter((l: any) => l.note).map((l: any, i: number) => (
                      <div key={i} style={{ fontSize: 10, color: D.gris }}>📝 {l.nom_produit} — {l.note}</div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
        {typeFilter === 'pain' && (
          commandesPain.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: D.gris }}><div style={{ fontSize: 36, marginBottom: 10 }}>🍞</div><div>Aucune commande pain</div></div>
          ) : commandesPain.map((cmd: any) => (
            <Card key={cmd.id} borderColor={couleur}>
              <div style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: D.ardoise }}>
                      Livraison {new Date(cmd.date_livraison + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <div style={{ fontSize: 11, color: D.gris, marginTop: 1 }}>
                      {(cmd.commande_pain_lignes || []).reduce((s: number, l: any) => s + l.quantite, 0)} pcs
                    </div>
                  </div>
                  <Badge type={STATUT_TYPE[cmd.statut] || 'gris'}>{STATUT_LABEL[cmd.statut] || cmd.statut}</Badge>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(cmd.commande_pain_lignes || []).map((l: any, i: number) => (
                    <span key={i} style={{ background: `${couleur}10`, color: couleur, borderRadius: 6, padding: '2px 7px', fontSize: 10 }}>{l.nom_produit} ×{l.quantite}</span>
                  ))}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// STOCK BOUTIQUE
// ═══════════════════════════════════════════════
function BoutiqueStock({ user, showToast }: { user: User, showToast: ShowToast }) {
  const [matieres, setMatieres]     = useState<any[]>([])
  const [selections, setSelections] = useState<Record<string, { qty: string, unite: string, prio: string }>>({})
  const [demandes, setDemandes]     = useState<any[]>([])
  const [view, setView]             = useState<'signaler'|'demandes'>('signaler')
  const [sending, setSending]       = useState(false)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('matieres').select('*').eq('profil', 'boutique').eq('actif', true).order('ordre'),
      supabase.from('demandes_stock').select('*, matieres(nom, categorie)').eq('demandeur_id', user.id).order('created_at', { ascending: false }).limit(20),
    ]).then(([{ data: m }, { data: d }]) => {
      setMatieres(m || [])
      setDemandes(d || [])
      setLoading(false)
    })
  }, [user.id])

  const cats = [...new Set(matieres.map(m => m.categorie))] as string[]
  const nbSel = Object.keys(selections).length
  const hasUrgent = Object.values(selections).some(s => s.prio === 'urgent')
  const couleur = user.couleur || D.bleu

  const toggle = (m: any) => {
    setSelections(prev => {
      if (prev[m.id]) { const n = { ...prev }; delete n[m.id]; return n }
      return { ...prev, [m.id]: { qty: '1', unite: m.unite || 'unité', prio: 'normal' } }
    })
  }

  const envoyer = async () => {
    if (nbSel === 0) return
    setSending(true)
    for (const [matId, sel] of Object.entries(selections)) {
      await supabase.from('demandes_stock').insert({
        matiere_id: matId, demandeur_id: user.id,
        quantite: parseFloat(sel.qty) || 1, unite: sel.unite,
        priorite: sel.prio, statut: 'en_attente',
      })
    }
    showToast(hasUrgent ? '🔴 Urgent envoyé ✓' : `${nbSel} demande${nbSel > 1 ? 's' : ''} envoyée${nbSel > 1 ? 's' : ''} ✓`)
    setSending(false); setSelections({}); setView('demandes')
    const { data } = await supabase.from('demandes_stock').select('*, matieres(nom, categorie)').eq('demandeur_id', user.id).order('created_at', { ascending: false }).limit(20)
    setDemandes(data || [])
  }

  if (loading) return <Loader />

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
          {cats.map(cat => (
            <div key={cat}>
              <SectionLabel>{cat}</SectionLabel>
              {matieres.filter(m => m.categorie === cat).map(m => {
                const sel = selections[m.id]; const isSel = !!sel
                return (
                  <div key={m.id}>
                    <div onClick={() => toggle(m)} style={{ padding: '13px 16px', borderBottom: `1px solid ${D.craieDark}`, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: isSel ? `${couleur}06` : 'white' }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isSel ? couleur : D.craieDark}`, background: isSel ? couleur : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isSel && <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>✓</span>}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: isSel ? 600 : 400, color: isSel ? couleur : D.ardoise, flex: 1 }}>{m.nom}</div>
                    </div>
                    {isSel && (
                      <div style={{ padding: '8px 16px 10px 50px', borderBottom: `1px solid ${D.craieDark}`, background: `${couleur}04`, display: 'flex', gap: 8, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'white', border: `1.5px solid ${couleur}`, borderRadius: 8, padding: '4px 6px' }}>
                          <button onClick={() => setSelections(prev => ({ ...prev, [m.id]: { ...prev[m.id], qty: String(Math.max(1, parseFloat(prev[m.id].qty) - 1)) } }))} style={{ width: 28, height: 28, border: 'none', background: 'transparent', color: D.ardoise, fontSize: 16, cursor: 'pointer' }}>−</button>
                          <input type="number" value={sel.qty} onChange={e => setSelections(prev => ({ ...prev, [m.id]: { ...prev[m.id], qty: e.target.value } }))} style={{ width: 36, textAlign: 'center', border: 'none', outline: 'none', fontSize: 15, fontWeight: 700, color: couleur, background: 'transparent' }} />
                          <button onClick={() => setSelections(prev => ({ ...prev, [m.id]: { ...prev[m.id], qty: String(parseFloat(prev[m.id].qty) + 1) } }))} style={{ width: 28, height: 28, border: 'none', background: couleur, borderRadius: 5, color: 'white', fontSize: 16, cursor: 'pointer', fontWeight: 700 }}>+</button>
                        </div>
                        <select value={sel.unite} onChange={e => setSelections(prev => ({ ...prev, [m.id]: { ...prev[m.id], unite: e.target.value } }))} style={{ padding: '6px 8px', background: 'white', border: `1px solid ${D.craieDark}`, borderRadius: 8, color: D.ardoise, fontSize: 12, outline: 'none' }}>
                          {['unité','lot','kg','g','L'].map(u => <option key={u} value={u}>{u}</option>)}
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
            <div style={{ padding: 40, textAlign: 'center', color: D.gris }}><div style={{ fontSize: 36, marginBottom: 10 }}>✅</div><div>Aucune demande</div></div>
          ) : demandes.map((d: any) => (
            <Card key={d.id} borderColor={d.priorite === 'urgent' ? D.rouge : couleur}>
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
