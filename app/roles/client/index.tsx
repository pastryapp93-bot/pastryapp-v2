'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { D, ROLE_COLORS, C } from '@/lib/design'
import { AppHeader, TabBar, Card, Badge, SectionLabel, Loader, EmptyState, BtnPrimary, PaveNumerique, SendBar, SuccessScreen } from '@/app/components/ui'
import type { User } from '@/lib/supabase'

type ShowToast = (msg: string, type?: string) => void

// ═══════════════════════════════════════════════
// CLIENT APP — Boutiques + La Framboise
// ═══════════════════════════════════════════════
export default function ClientApp({ user, onLogout, showToast }: {
  user: User, onLogout: () => void, showToast: ShowToast
}) {
  const isFramboise = user.role === 'framboise'
  const isBoutique  = user.role === 'boutique_livry' || user.role === 'boutique_villemomble'
  const couleur     = ROLE_COLORS[user.role] || D.or

  const TABS = [
    { id: 'commander',  icon: '🛍️', label: 'Commander' },
    { id: 'suivi',      icon: '📦', label: 'Mes commandes' },
    ...(isFramboise ? [{ id: 'factures', icon: '💶', label: 'Factures' }] : []),
    ...(isBoutique  ? [{ id: 'stock',    icon: '📋', label: 'Stock' }] : []),
  ]

  const [tab, setTab] = useState('commander')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppHeader user={user} onLogout={onLogout} />
      <TabBar tabs={TABS} active={tab} onChange={setTab} color={couleur} />
      <div style={{ flex: 1, overflowY: 'auto', background: D.craie, paddingBottom: 24 }}>
        {tab === 'commander' && <ClientCommander user={user} showToast={showToast} couleur={couleur} isBoutique={isBoutique} isFramboise={isFramboise} />}
        {tab === 'suivi'     && <ClientSuivi user={user} couleur={couleur} />}
        {tab === 'factures'  && <ClientFactures user={user} />}
        {tab === 'stock'     && <ClientStock user={user} showToast={showToast} couleur={couleur} />}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// COMMANDER — Pâtisserie + Pain (boutiques)
// ═══════════════════════════════════════════════
function ClientCommander({ user, showToast, couleur, isBoutique, isFramboise }: any) {
  const [typeCmd, setTypeCmd]       = useState<'patisserie'|'pain'>('patisserie')
  const [familles, setFamilles]     = useState<any[]>([])
  const [produits, setProduits]     = useState<any[]>([])
  const [famPain, setFamPain]       = useState<any[]>([])
  const [prodsPain, setProdsPain]   = useState<any[]>([])
  const [prixClient, setPrixClient] = useState<Record<string, number>>({})
  const [qties, setQties]           = useState<Record<string, number>>({})
  const [notes, setNotes]           = useState<Record<string, string>>({})
  const [activeCat, setActiveCat]   = useState('')
  const [dateLiv, setDateLiv]       = useState('')
  const [editing, setEditing]       = useState<any>(null)
  const [editVal, setEditVal]       = useState('0')
  const [sent, setSent]             = useState(false)
  const [sending, setSending]       = useState(false)
  const [loading, setLoading]       = useState(true)
  const [lastCmd, setLastCmd]       = useState<any>(null)

  // Dates pour la commande pain
  const dates = Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()+i+1)
    return { value: d.toISOString().split('T')[0], label: d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}) }
  })

  useEffect(() => {
    Promise.all([
      supabase.from('familles').select('*').eq('type','patisserie').order('ordre'),
      supabase.from('produits').select('*').eq('type','patisserie').eq('actif',true).order('ordre'),
      supabase.from('familles').select('*').eq('type','pain').order('ordre'),
      supabase.from('produits').select('*').eq('type','pain').eq('actif',true).order('ordre'),
      supabase.from('prix_client').select('*').eq('client_id', user.id),
      // Dernière commande pour "recommander la même chose"
      supabase.from('commandes').select('*, commande_lignes(produit_id, quantite, note, nom_produit)')
        .eq('client_id', user.id).order('created_at',{ascending:false}).limit(1),
    ]).then(([{data:f},{data:p},{data:fp},{data:pp},{data:pc},{data:lc}]) => {
      setFamilles(f||[])
      setProduits(p||[])
      setFamPain(fp||[])
      setProdsPain(pp||[])
      const prixMap: Record<string,number> = {}
      ;(pc||[]).forEach((px:any) => { prixMap[px.produit_id] = px.prix })
      setPrixClient(prixMap)
      if (f && f.length > 0) setActiveCat(f[0].id)
      if (lc && lc.length > 0) setLastCmd(lc[0])
      setDateLiv(dates[0]?.value || '')
      setLoading(false)
    })
  }, [user.id])

  const getPrix = (prod: any) => prixClient[prod.id] ?? prod.prix_base
  const currentFam  = typeCmd === 'patisserie' ? familles  : famPain
  const currentProds = typeCmd === 'patisserie' ? produits  : prodsPain
  const catProds    = currentProds.filter(p => p.famille_id === activeCat)
  const total       = Object.values(qties).reduce((s,v) => s+v, 0)
  const totalHT     = currentProds.reduce((s,p) => s + (getPrix(p) * (qties[p.id]||0)), 0)

  const recommander = () => {
    if (!lastCmd) return
    const newQties: Record<string,number> = {}
    const newNotes: Record<string,string>  = {}
    ;(lastCmd.commande_lignes || []).forEach((l: any) => {
      newQties[l.produit_id] = l.quantite
      if (l.note) newNotes[l.produit_id] = l.note
    })
    setQties(newQties)
    setNotes(newNotes)
    showToast('Dernière commande rechargée ✓')
  }

  const envoyer = async () => {
    if (!total) return
    setSending(true)

    if (typeCmd === 'patisserie') {
      const lignes = currentProds.filter(p => (qties[p.id]||0) > 0).map(p => ({
        produit_id: p.id, nom_produit: p.nom, quantite: qties[p.id],
        prix_unit: getPrix(p), note: notes[p.id] || null,
      }))
      const ht = lignes.reduce((s,l) => s + l.quantite * l.prix_unit, 0)
      const {data: cmd} = await supabase.from('commandes').insert({ client_id: user.id, statut: 'en_attente', total_ht: ht }).select().single()
      if (cmd) {
        await supabase.from('commande_lignes').insert(lignes.map(l => ({...l, commande_id: cmd.id})))
        const {data: gerant} = await supabase.from('users').select('id').eq('role','gerant').single()
        if (gerant) await supabase.from('notifications').insert({ destinataire: gerant.id, type: 'nouvelle_commande', titre: `Nouvelle commande — ${user.nom}`, message: `${total} pièces · ${ht.toFixed(2)} € HT` })
      }
    } else {
      // Commande pain
      const boutiqueRole = user.role === 'boutique_livry' ? 'boulanger_livry' : 'boulanger_villemomble'
      const {data: boulanger} = await supabase.from('users').select('id').eq('role', boutiqueRole).single()
      const {data: cmd} = await supabase.from('commandes_pain').insert({ boutique_id: user.id, boulanger_id: boulanger?.id, date_livraison: dateLiv, statut: 'en_attente' }).select().single()
      if (cmd) {
        const lignes = currentProds.filter(p => (qties[p.id]||0) > 0).map(p => ({ commande_id: cmd.id, produit_id: p.id, nom_produit: p.nom, quantite: qties[p.id] }))
        await supabase.from('commande_pain_lignes').insert(lignes)
        if (boulanger?.id) await supabase.from('notifications').insert({ destinataire: boulanger.id, type: 'nouvelle_commande_pain', titre: `Commande pain — ${user.nom}`, message: `${total} pièces pour le ${new Date(dateLiv+'T00:00:00').toLocaleDateString('fr-FR')}` })
      }
    }
    setSending(false); setSent(true)
    showToast('Commande envoyée ✓')
  }

  if (loading) return <Loader />

  if (sent) return (
    <SuccessScreen
      title="Commande envoyée !"
      subtitle={typeCmd === 'patisserie' ? 'En attente de validation' : `Pain pour le ${new Date(dateLiv+'T00:00:00').toLocaleDateString('fr-FR')}`}
      info={`${total} pièces${typeCmd === 'patisserie' ? ` · ${totalHT.toFixed(2)} € HT` : ''}`}
      onReset={() => { setSent(false); setQties({}); setNotes({}) }}
    />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Filtre Pâtisserie / Pain */}
      {isBoutique && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: D.blanc, borderBottom: `1px solid ${D.craieDark}` }}>
          {[{id:'patisserie',l:'🧁 Pâtisserie'},{id:'pain',l:'🍞 Pain'}].map(t => (
            <button key={t.id} onClick={() => { setTypeCmd(t.id as any); setQties({}); setNotes({}); if(t.id==='patisserie'&&familles.length) setActiveCat(familles[0].id); else if(famPain.length) setActiveCat(famPain[0].id) }} style={{ flex:1, padding:'9px', borderRadius:10, background:typeCmd===t.id?couleur:'transparent', border:`1.5px solid ${typeCmd===t.id?couleur:D.craieDark}`, color:typeCmd===t.id?'white':D.gris, fontSize:12, fontWeight:600, cursor:'pointer' }}>{t.l}</button>
          ))}
        </div>
      )}

      {/* Résumé + recommander */}
      <div style={{ background: D.blanc, padding: '10px 14px', borderBottom: `1px solid ${D.craieDark}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="serif" style={{ fontSize: 14, fontWeight: 300, color: couleur }}>{user.nom}</div>
          <div style={{ fontSize: 10, color: D.grisClair, marginTop: 1 }}>
            {typeCmd === 'pain' ? `Livraison le ${dateLiv ? new Date(dateLiv+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}) : ''}` : 'Avant 20h · pour demain'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastCmd && typeCmd === 'patisserie' && (
            <button onClick={recommander} style={{ padding: '5px 10px', background: `${couleur}12`, border: `1px solid ${couleur}30`, color: couleur, borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
              🔄 Recommander
            </button>
          )}
          {total > 0 && (
            <div style={{ background: `${couleur}12`, border: `1.5px solid ${couleur}30`, borderRadius: 12, padding: '5px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: couleur, lineHeight: 1 }}>{total}</div>
              {typeCmd === 'patisserie' && <div style={{ fontSize: 9, color: D.gris }}>{totalHT.toFixed(2)} €</div>}
            </div>
          )}
        </div>
      </div>

      {/* Sélecteur date (pain) */}
      {typeCmd === 'pain' && (
        <div style={{ padding: '8px 14px', background: D.blanc, borderBottom: `1px solid ${D.craieDark}` }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {dates.map(d => (
              <button key={d.value} onClick={() => setDateLiv(d.value)} style={{ flexShrink:0, padding:'6px 12px', borderRadius:20, fontSize:11, fontWeight:500, background:dateLiv===d.value?couleur:D.craieMid, color:dateLiv===d.value?'white':D.gris, border:`1px solid ${dateLiv===d.value?couleur:D.craieDark}`, cursor:'pointer', whiteSpace:'nowrap' }}>{d.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Onglets familles */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${D.craieDark}`, scrollbarWidth: 'none', background: D.blanc }}>
        {currentFam.map(f => {
          const catTot = currentProds.filter(p => p.famille_id === f.id).reduce((s,p) => s+(qties[p.id]||0), 0)
          return (
            <button key={f.id} onClick={() => setActiveCat(f.id)} style={{ flexShrink:0, padding:'9px 14px', background:'none', border:'none', borderBottom:`2px solid ${activeCat===f.id?couleur:'transparent'}`, fontSize:11, cursor:'pointer', color:activeCat===f.id?couleur:D.gris, fontWeight:activeCat===f.id?600:400, whiteSpace:'nowrap' }}>
              {f.nom}
              {catTot > 0 && <span style={{ marginLeft:4, background:`${couleur}15`, color:couleur, borderRadius:10, padding:'1px 5px', fontSize:9, fontWeight:700 }}>{catTot}</span>}
            </button>
          )
        })}
      </div>

      {/* Produits */}
      <div style={{ paddingBottom: 100 }}>
        {catProds.length === 0 && <EmptyState icon="📦" title="Aucun produit" subtitle="Contactez la direction pour ajouter des produits" />}
        {catProds.map(prod => {
          const q = qties[prod.id] || 0
          const px = getPrix(prod)
          const hasPxSpecial = prixClient[prod.id] !== undefined && prixClient[prod.id] !== prod.prix_base

          if (typeCmd === 'pain') {
            // Vue +/- pour le pain
            return (
              <div key={prod.id} style={{ padding:'12px 14px', borderBottom:`1px solid ${D.craieDark}`, display:'flex', alignItems:'center', gap:12, background:q>0?`${couleur}05`:D.blanc, borderLeft:q>0?`3px solid ${couleur}`:'3px solid transparent' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:q>0?couleur:D.ardoise, fontWeight:q>0?600:400 }}>{prod.nom}</div>
                  <div style={{ fontSize:10, color:D.grisClair, marginTop:1 }}>{prod.unite}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <button onClick={() => setQties(prev=>({...prev,[prod.id]:Math.max(0,(prev[prod.id]||0)-1)}))} style={{ width:30, height:30, borderRadius:8, border:`1px solid ${D.craieDark}`, background:D.blanc, color:D.ardoise, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                  <div style={{ fontSize:16, fontWeight:700, color:q>0?couleur:D.ardoise, minWidth:28, textAlign:'center' }}>{q}</div>
                  <button onClick={() => setQties(prev=>({...prev,[prod.id]:(prev[prod.id]||0)+1}))} style={{ width:30, height:30, borderRadius:8, border:'none', background:couleur, color:'white', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>+</button>
                </div>
              </div>
            )
          }

          // Vue pavé numérique pour pâtisserie
          return (
            <div key={prod.id} style={{ borderBottom:`1px solid ${D.craieDark}`, background:q>0?`${couleur}06`:D.blanc, borderLeft:q>0?`3px solid ${couleur}`:'3px solid transparent' }}>
              <div onClick={() => { setEditing(prod); setEditVal(String(q||0)) }} style={{ padding:'12px 14px', display:'flex', alignItems:'center', cursor:'pointer' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, color:q>0?couleur:D.ardoise, fontWeight:q>0?600:400 }}>{prod.nom}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                    <span style={{ fontSize:11, color:hasPxSpecial?couleur:D.grisClair, fontWeight:hasPxSpecial?600:400 }}>{px.toFixed(2)} € HT</span>
                    {hasPxSpecial && <span style={{ fontSize:9, background:`${couleur}15`, color:couleur, borderRadius:6, padding:'1px 5px' }}>Tarif perso</span>}
                  </div>
                </div>
                <div style={{ width:48, height:48, borderRadius:13, background:q>0?couleur:D.craieMid, border:`1.5px solid ${q>0?couleur:D.craieDark}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {q > 0 ? <span style={{ fontSize:19, fontWeight:700, color:'white' }}>{q}</span> : <span style={{ fontSize:22, color:D.grisClair }}>+</span>}
                </div>
              </div>
              {q > 0 && (
                <div style={{ padding:'0 14px 10px' }} onClick={e=>e.stopPropagation()}>
                  <input value={notes[prod.id]||''} onChange={e => setNotes(prev=>({...prev,[prod.id]:e.target.value}))}
                    placeholder={isFramboise ? "Exigence client (ex: Joyeux anniversaire Bernard, allergie...)" : "Note / exigence client..."}
                    style={{ width:'100%', padding:'8px 11px', background:`${couleur}06`, border:`1.5px solid ${couleur}25`, borderRadius:9, fontSize:12, color:D.ardoise, outline:'none', fontFamily:'inherit' }} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pavé numérique */}
      {editing && (
        <PaveNumerique
          value={editVal} onChange={setEditVal}
          onConfirm={() => { setQties(prev => ({...prev,[editing.id]:Math.max(0,parseInt(editVal)||0)})); setEditing(null) }}
          onClose={() => setEditing(null)}
          title={editing.nom}
          subtitle={`${getPrix(editing).toFixed(2)} € HT / ${editing.unite}`}
          color={couleur}
        />
      )}

      {/* Bouton envoyer */}
      <SendBar>
        <BtnPrimary disabled={!total||sending} onClick={envoyer} color={!total?undefined:couleur} loading={sending}>
          {sending ? 'Envoi...' : !total ? 'Sélectionner des produits' : typeCmd === 'pain' ? `Envoyer · ${total} pièces →` : `Envoyer · ${total} pièce${total>1?'s':''} · ${totalHT.toFixed(2)} € HT →`}
        </BtnPrimary>
      </SendBar>
    </div>
  )
}

// ═══════════════════════════════════════════════
// SUIVI COMMANDES — Timeline visuelle
// ═══════════════════════════════════════════════
function ClientSuivi({ user, couleur }: { user: User, couleur: string }) {
  const [commandes, setCommandes]   = useState<any[]>([])
  const [cmdsPain, setCmdsPain]     = useState<any[]>([])
  const [type, setType]             = useState<'patisserie'|'pain'>('patisserie')
  const [loading, setLoading]       = useState(true)
  const isBoutique = user.role === 'boutique_livry' || user.role === 'boutique_villemomble'

  useEffect(() => {
    Promise.all([
      supabase.from('commandes').select('*, commande_lignes(nom_produit,quantite,note,prix_unit), rajouts(nom_produit,quantite,note,prix_unit)')
        .eq('client_id',user.id).order('created_at',{ascending:false}).limit(30),
      isBoutique
        ? supabase.from('commandes_pain').select('*, commande_pain_lignes(nom_produit,quantite)').eq('boutique_id',user.id).order('created_at',{ascending:false}).limit(20)
        : Promise.resolve({data:[]}),
    ]).then(([{data:c},{data:cp}]) => { setCommandes(c||[]); setCmdsPain(cp||[]); setLoading(false) })
  }, [user.id, isBoutique])

  // Supabase Realtime
  useEffect(() => {
    const ch = supabase.channel('client-suivi')
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'commandes'}, () => {
        supabase.from('commandes').select('*, commande_lignes(nom_produit,quantite,note,prix_unit), rajouts(nom_produit,quantite,note,prix_unit)').eq('client_id',user.id).order('created_at',{ascending:false}).limit(30).then(({data})=>setCommandes(data||[]))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user.id])

  if (loading) return <Loader />

  const ETAPES_PAT = [
    { label: 'Envoyée',    key: 'created_at',       icon: '📤', color: C.bleu },
    { label: 'Validée',    key: 'validee_at',        icon: '✓',  color: C.vert },
    { label: 'En labo',    key: 'fabrication_at',    icon: '🔥', color: C.orange },
    { label: 'Prête',      key: 'pret_at',           icon: '✅', color: C.vert },
    { label: 'Remise',     key: 'remis_at',          icon: '🤝', color: '#6B6560' },
  ]

  return (
    <div>
      {isBoutique && (
        <div style={{ display:'flex', gap:8, padding:'10px 14px', background:D.blanc, borderBottom:`1px solid ${D.craieDark}` }}>
          {[{id:'patisserie',l:'🧁 Pâtisserie'},{id:'pain',l:'🍞 Pain'}].map(t => (
            <button key={t.id} onClick={() => setType(t.id as any)} style={{ flex:1, padding:'9px', borderRadius:10, background:type===t.id?D.ardoise:'transparent', border:`1.5px solid ${type===t.id?D.ardoise:D.craieDark}`, color:type===t.id?'white':D.gris, fontSize:12, fontWeight:600, cursor:'pointer' }}>{t.l}</button>
          ))}
        </div>
      )}

      <div style={{ padding:14 }}>
        {type === 'patisserie' && (
          commandes.length === 0
            ? <EmptyState icon="📦" title="Aucune commande" subtitle="Vos commandes apparaîtront ici" />
            : commandes.map((cmd: any) => {
                const lignes = cmd.commande_lignes || []
                const rajouts = cmd.rajouts || []
                const tot = lignes.reduce((s: number, l: any) => s+l.quantite, 0)
                const ht = lignes.reduce((s: number, l: any) => s+l.quantite*l.prix_unit, 0)
                const etapeActive = ETAPES_PAT.filter(e => cmd[e.key]).length - 1

                return (
                  <Card key={cmd.id} accent={couleur}>
                    <div style={{ padding:'12px 14px' }}>
                      {/* En-tête */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:D.ardoise }}>{new Date(cmd.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}</div>
                          <div style={{ fontSize:11, color:D.gris, marginTop:1 }}>{tot} pcs · {ht.toFixed(2)} € HT</div>
                        </div>
                        <Badge variant={cmd.statut==='refusee'?'rouge':cmd.remis_at?'gris':cmd.pret_at?'vert':cmd.fabrication_at?'or':cmd.validee_at?'vert':'or'}>
                          {cmd.statut==='refusee'?'✕ Refusée':cmd.remis_at?'✓ Remise':cmd.pret_at?'✅ Prête':cmd.fabrication_at?'🔥 En labo':cmd.validee_at?'✓ Validée':'⏳ En attente'}
                        </Badge>
                      </div>

                      {/* Timeline visuelle */}
                      {cmd.statut !== 'refusee' && (
                        <div style={{ display:'flex', alignItems:'center', marginBottom:12, overflowX:'auto' }}>
                          {ETAPES_PAT.map((etape, i) => {
                            const done = !!cmd[etape.key]
                            const isActive = i === etapeActive
                            return (
                              <div key={etape.key} style={{ display:'flex', alignItems:'center', flex: i < ETAPES_PAT.length - 1 ? '1 1 0' : undefined }}>
                                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:40 }}>
                                  <div style={{ width:28, height:28, borderRadius:'50%', background:done?etape.color:`${D.craieDark}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, border:isActive?`2px solid ${etape.color}`:'none', transition:'background .3s' }}>
                                    {done ? <span style={{ color:'white', fontSize:11 }}>{etape.icon}</span> : <span style={{ color:D.grisClair, fontSize:10 }}>○</span>}
                                  </div>
                                  <div style={{ fontSize:8, color:done?etape.color:D.grisClair, marginTop:2, textAlign:'center', fontWeight:done?600:400, whiteSpace:'nowrap' }}>{etape.label}</div>
                                  {done && cmd[etape.key] !== cmd.created_at && <div style={{ fontSize:7, color:D.grisClair }}>{new Date(cmd[etape.key]).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>}
                                </div>
                                {i < ETAPES_PAT.length - 1 && (
                                  <div style={{ flex:1, height:2, background:done&&!!cmd[ETAPES_PAT[i+1].key]?etape.color:D.craieDark, margin:'0 2px', marginBottom:18, transition:'background .3s' }} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Produits */}
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:rajouts.length>0?6:0 }}>
                        {lignes.map((l: any, i: number) => (
                          <div key={i}>
                            <span style={{ background:`${couleur}10`, color:couleur, borderRadius:6, padding:'2px 7px', fontSize:10 }}>{l.nom_produit} ×{l.quantite}</span>
                            {l.note && <div style={{ fontSize:9, color:D.gris, marginTop:1, marginLeft:4, fontStyle:'italic' }}>📝 {l.note}</div>}
                          </div>
                        ))}
                      </div>

                      {rajouts.length > 0 && (
                        <div style={{ marginTop:6, padding:'5px 8px', background:`${C.or}08`, borderRadius:7, border:`1px solid ${C.or}20` }}>
                          <div style={{ fontSize:9, color:C.or, fontWeight:700, marginBottom:3 }}>➕ Rajouts</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                            {rajouts.map((r: any, i: number) => <span key={i} style={{ background:`${C.or}12`, color:C.or, borderRadius:5, padding:'1px 6px', fontSize:9 }}>{r.nom_produit} ×{r.quantite}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })
        )}

        {type === 'pain' && (
          cmdsPain.length === 0
            ? <EmptyState icon="🍞" title="Aucune commande pain" />
            : cmdsPain.map((cmd: any) => {
                const tot = (cmd.commande_pain_lignes||[]).reduce((s:number,l:any)=>s+l.quantite,0)
                const STATUT: Record<string,string> = {en_attente:'⏳ En attente',vue:'✓ Vu',en_production:'🔥 En production',pret:'✅ Prêt'}
                const STATUT_V: Record<string,any> = {en_attente:'or',vue:'vert',en_production:'or',pret:'vert'}
                return (
                  <Card key={cmd.id} accent={couleur}>
                    <div style={{ padding:'12px 14px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:D.ardoise }}>
                            Livraison {new Date(cmd.date_livraison+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}
                          </div>
                          <div style={{ fontSize:11, color:D.gris, marginTop:1 }}>{tot} pièces</div>
                        </div>
                        <Badge variant={STATUT_V[cmd.statut]||'gris'}>{STATUT[cmd.statut]||cmd.statut}</Badge>
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {(cmd.commande_pain_lignes||[]).map((l:any,i:number) => <span key={i} style={{ background:`${couleur}10`, color:couleur, borderRadius:6, padding:'2px 7px', fontSize:10 }}>{l.nom_produit} ×{l.quantite}</span>)}
                      </div>
                    </div>
                  </Card>
                )
              })
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// FACTURES — La Framboise
// ═══════════════════════════════════════════════
function ClientFactures({ user }: { user: User }) {
  const [factures, setFactures] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [openId, setOpenId]     = useState<string|null>(null)

  useEffect(() => {
    supabase.from('factures').select('*, facture_lignes(*)').eq('client_id',user.id).order('created_at',{ascending:false}).limit(12)
      .then(({data}) => { setFactures(data||[]); setLoading(false) })
  }, [user.id])

  if (loading) return <Loader />
  if (!factures.length) return <EmptyState icon="💶" title="Aucune facture" subtitle="Vos relevés mensuels apparaîtront ici" />

  return (
    <div style={{ padding:14 }}>
      <div style={{ background:`${C.or}08`, border:`1px solid ${C.or}20`, borderRadius:10, padding:'8px 12px', marginBottom:14 }}>
        <div style={{ fontSize:11, color:C.or }}>{factures.length}/12 factures · Nettoyage automatique</div>
      </div>
      {factures.map((f:any) => (
        <Card key={f.id}>
          <div onClick={() => setOpenId(openId===f.id?null:f.id)} style={{ padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', background:openId===f.id?D.craieMid:D.blanc }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:D.ardoise }}>{f.numero}</div>
              <div style={{ fontSize:11, color:D.gris, marginTop:2 }}>{f.periode}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div className="serif" style={{ fontSize:20, fontWeight:300, color:D.ardoise }}>{Number(f.total_ttc).toFixed(2)} €</div>
              <Badge variant={f.statut==='payee'?'vert':f.statut==='envoyee'?'bleu':'gris'}>{f.statut==='payee'?'✅ Payée':f.statut==='envoyee'?'📨 Envoyée':'Brouillon'}</Badge>
            </div>
          </div>
          {openId===f.id && (
            <div style={{ borderTop:`1px solid ${D.craieDark}` }}>
              {(f.facture_lignes||[]).map((l:any,i:number) => (
                <div key={i} style={{ padding:'8px 14px', borderBottom:`1px solid ${D.craieDark}`, display:'flex', justifyContent:'space-between' }}>
                  <div><div style={{ fontSize:12, color:D.ardoise }}>{l.description}</div><div style={{ fontSize:10, color:D.gris }}>{l.quantite} × {Number(l.prix_unit).toFixed(2)} €</div></div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.or }}>{Number(l.total).toFixed(2)} €</div>
                </div>
              ))}
              <div style={{ padding:'10px 14px', background:D.craieMid }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:D.gris, marginBottom:3 }}><span>HT</span><span>{Number(f.total_ht).toFixed(2)} €</span></div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:D.gris, marginBottom:8 }}><span>TVA {Number(f.tva_pct)}%</span><span>{(Number(f.total_ht)*Number(f.tva_pct)/100).toFixed(2)} €</span></div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:16, fontWeight:700, color:D.ardoise }}><span>TTC</span><span>{Number(f.total_ttc).toFixed(2)} €</span></div>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════
// STOCK BOUTIQUE
// ═══════════════════════════════════════════════
function ClientStock({ user, showToast, couleur }: any) {
  const [matieres, setMatieres]     = useState<any[]>([])
  const [selections, setSelections] = useState<Record<string, { qty: string, unite: string, prio: string }>>({})
  const [demandes, setDemandes]     = useState<any[]>([])
  const [view, setView]             = useState<'signaler'|'demandes'>('signaler')
  const [sending, setSending]       = useState(false)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('matieres').select('*').eq('profil','boutique').eq('actif',true).order('ordre'),
      supabase.from('demandes_stock').select('*, matieres(nom,categorie)').eq('demandeur_id',user.id).order('created_at',{ascending:false}).limit(20),
    ]).then(([{data:m},{data:d}]) => { setMatieres(m||[]); setDemandes(d||[]); setLoading(false) })
  }, [user.id])

  const cats = [...new Set(matieres.map(m => m.categorie))] as string[]
  const nbSel = Object.keys(selections).length
  const hasUrgent = Object.values(selections).some((s: any) => s.prio === 'urgent')

  const toggle = (m: any) => setSelections(prev => {
    if (prev[m.id]) { const n={...prev}; delete n[m.id]; return n }
    return {...prev,[m.id]:{qty:'1',unite:m.unite||'unité',prio:'normal'}}
  })

  const envoyer = async () => {
    if (!nbSel) return
    setSending(true)
    for (const [matId, sel] of Object.entries(selections)) {
      await supabase.from('demandes_stock').insert({ matiere_id:matId, demandeur_id:user.id, quantite:parseFloat((sel as any).qty)||1, unite:(sel as any).unite, priorite:(sel as any).prio, statut:'en_attente' })
    }
    showToast(hasUrgent?'🔴 Urgent envoyé ✓':`${nbSel} demande${nbSel>1?'s':''} envoyée${nbSel>1?'s':''} ✓`)
    setSending(false); setSelections({}); setView('demandes')
    const {data} = await supabase.from('demandes_stock').select('*, matieres(nom,categorie)').eq('demandeur_id',user.id).order('created_at',{ascending:false}).limit(20)
    setDemandes(data||[])
  }

  if (loading) return <Loader />

  return (
    <div>
      <div style={{ display:'flex', gap:8, padding:'10px 14px', background:D.blanc, borderBottom:`1px solid ${D.craieDark}` }}>
        {[{id:'signaler',l:'➕ Signaler'},{id:'demandes',l:'📋 Mes demandes'}].map(v => (
          <button key={v.id} onClick={() => setView(v.id as any)} style={{ flex:1, padding:'9px', borderRadius:10, background:view===v.id?D.ardoise:'transparent', border:`1.5px solid ${view===v.id?D.ardoise:D.craieDark}`, color:view===v.id?'white':D.gris, fontSize:12, fontWeight:600, cursor:'pointer' }}>{v.l}</button>
        ))}
      </div>
      {view === 'signaler' && (
        <div style={{ paddingBottom:100 }}>
          {cats.map(cat => (
            <div key={cat}>
              <SectionLabel>{cat}</SectionLabel>
              {matieres.filter(m => m.categorie===cat).map((m:any) => {
                const sel=selections[m.id]; const isSel=!!sel
                return (
                  <div key={m.id}>
                    <div onClick={() => toggle(m)} style={{ padding:'13px 16px', borderBottom:`1px solid ${D.craieDark}`, display:'flex', alignItems:'center', gap:12, cursor:'pointer', background:isSel?`${couleur}06`:D.blanc }}>
                      <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${isSel?couleur:D.craieDark}`, background:isSel?couleur:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {isSel && <span style={{ color:'white', fontSize:13, fontWeight:700 }}>✓</span>}
                      </div>
                      <div style={{ fontSize:13, fontWeight:isSel?600:400, color:isSel?couleur:D.ardoise, flex:1 }}>{m.nom}</div>
                    </div>
                    {isSel && (
                      <div style={{ padding:'8px 16px 10px 50px', borderBottom:`1px solid ${D.craieDark}`, background:`${couleur}04`, display:'flex', gap:8, alignItems:'center' }} onClick={e=>e.stopPropagation()}>
                        <div style={{ display:'flex', alignItems:'center', gap:4, background:D.blanc, border:`1.5px solid ${couleur}`, borderRadius:8, padding:'4px 6px' }}>
                          <button onClick={() => setSelections(prev=>({...prev,[m.id]:{...prev[m.id],qty:String(Math.max(1,parseFloat((prev[m.id] as any).qty)-1))}}))} style={{ width:28,height:28,border:'none',background:'transparent',color:D.ardoise,fontSize:16,cursor:'pointer' }}>−</button>
                          <input type="number" value={(sel as any).qty} onChange={e => setSelections(prev=>({...prev,[m.id]:{...prev[m.id],qty:e.target.value}}))} style={{ width:36,textAlign:'center',border:'none',outline:'none',fontSize:15,fontWeight:700,color:couleur,background:'transparent' }} />
                           <button onClick={() => setSelections(prev => { const n = {...prev,[m.id]:{...prev[m.id],qty:String(parseFloat((prev[m.id] as any).qty)+1)}}; return n; })} style={{ width:28,height:28,border:"none",background:couleur,borderRadius:5,color:"white",fontSize:16,cursor:"pointer",fontWeight:700 }}>+</button>
                        </div>
                        <div style={{ display:'flex', gap:5, marginLeft:'auto' }}>
                          {[{id:'normal',l:'🟡'},{id:'urgent',l:'🔴'}].map(p=>(
                            <button key={p.id} onClick={() => setSelections(prev=>({...prev,[m.id]:{...prev[m.id],prio:p.id}}))} style={{ width:34,height:34,borderRadius:8,border:`2px solid ${(sel as any).prio===p.id?(p.id==='urgent'?C.rouge:C.or):D.craieDark}`,background:(sel as any).prio===p.id?(p.id==='urgent'?D.rougeBg:`${C.or}15`):D.blanc,fontSize:17,cursor:'pointer' }}>{p.l}</button>
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
              {sending?'Envoi..':!nbSel?'Cocher les produits manquants':hasUrgent?`🔴 URGENT — ${nbSel} produit${nbSel>1?'s':''}`:`📦 Envoyer — ${nbSel} produit${nbSel>1?'s':''}`}
            </BtnPrimary>
          </SendBar>
        </div>
      )}
      {view === 'demandes' && (
        <div style={{ padding:14 }}>
          {!demandes.length ? <EmptyState icon="✅" title="Aucune demande" /> : demandes.map((d:any) => (
            <Card key={d.id} accent={d.priorite==='urgent'?C.rouge:couleur}>
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
