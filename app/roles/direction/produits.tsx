'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { D } from '@/lib/design'
import { Card, SectionLabel, Loader, Badge } from '@/app/components/ui'

type ShowToast = (msg: string, type?: string) => void

const FAMILLES_PATISSERIE = [
  'Pâte à choux','Tartelettes','Entremets','Trompe-l\'œil',
  'Tarte à découper','Grands gâteaux','Viennoiseries',
  'Gourmandises','Gâteaux secs','Divers'
]
const FAMILLES_PAIN = ['Baguettes','Pains courants','Pains spéciaux','Viennoiseries pain']

// ═══════════════════════════════════════════════
// PRODUITS — Onglet Direction
// ═══════════════════════════════════════════════
export default function DirectionProduits({ showToast, clients }: {
  showToast: ShowToast, clients: any[]
}) {
  const [familles, setFamilles]   = useState<any[]>([])
  const [produits, setProduits]   = useState<any[]>([])
  const [prixClient, setPrixClient] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState<'catalogue'|'prix'>('catalogue')
  const [typeFilter, setTypeFilter] = useState<'patisserie'|'pain'>('patisserie')
  const [mode, setMode]           = useState<'list'|'form'|'prix_form'>('list')
  const [editProd, setEditProd]   = useState<any>(null)
  const [selClient, setSelClient] = useState('')

  // Form produit
  const [fNom, setFNom]           = useState('')
  const [fFamilleId, setFFamilleId] = useState('')
  const [fPrix, setFPrix]         = useState('')
  const [fUnite, setFUnite]       = useState('pièce')
  const [fType, setFType]         = useState<'patisserie'|'pain'>('patisserie')
  const [fActif, setFActif]       = useState(true)

  const load = useCallback(async () => {
    const [{ data: f }, { data: p }, { data: pc }] = await Promise.all([
      supabase.from('familles').select('*').order('type').order('ordre'),
      supabase.from('produits').select('*, familles(nom, type)').order('ordre'),
      supabase.from('prix_client').select('*, users(nom, couleur), produits(nom)'),
    ])
    setFamilles(f || [])
    setProduits(p || [])
    setPrixClient(pc || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openForm = (prod?: any) => {
    setEditProd(prod || null)
    setFNom(prod?.nom || '')
    setFFamilleId(prod?.famille_id || '')
    setFPrix(prod?.prix_base?.toString() || '')
    setFUnite(prod?.unite || 'pièce')
    setFType(prod?.type || typeFilter)
    setFActif(prod?.actif !== false)
    setMode('form')
  }

  const saveProd = async () => {
    if (!fNom || !fFamilleId) { showToast('Nom et famille requis', 'err'); return }
    if (editProd) {
      await supabase.from('produits').update({
        nom: fNom, famille_id: fFamilleId,
        prix_base: parseFloat(fPrix) || 0,
        unite: fUnite, actif: fActif,
      }).eq('id', editProd.id)
      showToast('Produit modifié ✓')
    } else {
      const maxOrdre = Math.max(...produits.filter(p => p.famille_id === fFamilleId).map(p => p.ordre || 0), 0)
      await supabase.from('produits').insert({
        nom: fNom, famille_id: fFamilleId,
        prix_base: parseFloat(fPrix) || 0,
        type: fType, unite: fUnite,
        actif: fActif, ordre: maxOrdre + 1,
      })
      showToast('Produit ajouté ✓')
    }
    setMode('list'); load()
  }

  const toggleActif = async (id: string, actif: boolean) => {
    await supabase.from('produits').update({ actif: !actif }).eq('id', id)
    load()
  }

  const deleteProd = async (id: string, nom: string) => {
    await supabase.from('produits').delete().eq('id', id)
    showToast(`${nom} supprimé`)
    load()
  }

  const savePrixClient = async (produitId: string, clientId: string, prix: string) => {
    const val = parseFloat(prix)
    if (isNaN(val)) return
    await supabase.from('prix_client').upsert({
      client_id: clientId, produit_id: produitId, prix: val
    }, { onConflict: 'client_id,produit_id' })
    showToast('Prix mis à jour ✓')
    load()
  }

  const filteredFamilles = familles.filter(f => f.type === typeFilter)
  const clientsCommercial = clients.filter(c =>
    ['boutique_livry','boutique_villemomble','framboise'].includes(c.role)
  )

  // ── Formulaire produit ──
  if (mode === 'form') {
    const famillesFiltrees = familles.filter(f => f.type === fType)
    return (
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => setMode('list')} style={{ background: 'transparent', border: 'none', color: D.or, fontSize: 22, cursor: 'pointer' }}>←</button>
          <div style={{ fontSize: 15, fontWeight: 600, color: D.ardoise }}>{editProd ? 'Modifier le produit' : 'Nouveau produit'}</div>
        </div>

        {/* Type */}
        {!editProd && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['patisserie', 'pain'] as const).map(t => (
              <button key={t} onClick={() => { setFType(t); setFFamilleId('') }} style={{
                flex: 1, padding: '9px', borderRadius: 10, cursor: 'pointer',
                background: fType === t ? D.ardoise : 'transparent',
                border: `1.5px solid ${fType === t ? D.ardoise : D.craieDark}`,
                color: fType === t ? 'white' : D.gris, fontSize: 13, fontWeight: 600,
              }}>{t === 'patisserie' ? '🧁 Pâtisserie' : '🍞 Pain'}</button>
            ))}
          </div>
        )}

        {/* Nom */}
        <div style={{ fontSize: 11, color: D.gris, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>Nom *</div>
        <input value={fNom} onChange={e => setFNom(e.target.value)} placeholder="Ex: Éclair chocolat" style={inputStyle} />

        {/* Famille */}
        <div style={{ fontSize: 11, color: D.gris, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>Famille *</div>
        <select value={fFamilleId} onChange={e => setFFamilleId(e.target.value)} style={inputStyle}>
          <option value="">-- Sélectionner --</option>
          {famillesFiltrees.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
        </select>

        {/* Prix + Unité */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: D.gris, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>Prix base HT (€)</div>
            <input type="number" step="0.01" min="0" value={fPrix} onChange={e => setFPrix(e.target.value)} placeholder="0.00" style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: D.gris, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>Unité</div>
            <select value={fUnite} onChange={e => setFUnite(e.target.value)} style={inputStyle}>
              {['pièce', 'part', 'kg', 'portion', 'lot'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {/* Actif */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 16px', padding: '10px 14px', background: 'white', borderRadius: 10, border: `1px solid ${D.craieDark}` }}>
          <div style={{ flex: 1, fontSize: 13, color: D.ardoise }}>Produit actif</div>
          <button onClick={() => setFActif(!fActif)} style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: fActif ? D.vert : D.craieDark, position: 'relative', transition: 'background .2s',
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', background: 'white',
              position: 'absolute', top: 3, transition: 'left .2s',
              left: fActif ? 22 : 4,
            }} />
          </button>
        </div>

        <button onClick={saveProd} className="press" style={{
          width: '100%', padding: 14, background: D.ardoise, color: 'white',
          border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>
          {editProd ? 'Enregistrer ✓' : 'Ajouter le produit ✓'}
        </button>
      </div>
    )
  }

  if (loading) return <Loader />

  return (
    <div>
      {/* Vue selector */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', background: 'white', borderBottom: `1px solid ${D.craieDark}` }}>
        <button onClick={() => setView('catalogue')} style={{
          flex: 1, padding: '9px', borderRadius: 10, cursor: 'pointer',
          background: view === 'catalogue' ? D.ardoise : 'transparent',
          border: `1.5px solid ${view === 'catalogue' ? D.ardoise : D.craieDark}`,
          color: view === 'catalogue' ? 'white' : D.gris, fontSize: 12, fontWeight: 600,
        }}>📦 Catalogue</button>
        <button onClick={() => setView('prix')} style={{
          flex: 1, padding: '9px', borderRadius: 10, cursor: 'pointer',
          background: view === 'prix' ? D.ardoise : 'transparent',
          border: `1.5px solid ${view === 'prix' ? D.ardoise : D.craieDark}`,
          color: view === 'prix' ? 'white' : D.gris, fontSize: 12, fontWeight: 600,
        }}>💰 Prix par client</button>
      </div>

      {/* ── CATALOGUE ── */}
      {view === 'catalogue' && (
        <div>
          {/* Type filter */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px', background: 'white', borderBottom: `1px solid ${D.craieDark}` }}>
            {(['patisserie', 'pain'] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} style={{
                flex: 1, padding: '8px', borderRadius: 10, cursor: 'pointer',
                background: typeFilter === t ? (t === 'patisserie' ? D.or : D.orange) : 'transparent',
                border: `1.5px solid ${typeFilter === t ? (t === 'patisserie' ? D.or : D.orange) : D.craieDark}`,
                color: typeFilter === t ? 'white' : D.gris, fontSize: 12, fontWeight: 600,
              }}>{t === 'patisserie' ? '🧁 Pâtisserie' : '🍞 Pain'}</button>
            ))}
          </div>

          {/* Bouton ajouter */}
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${D.craieDark}` }}>
            <button onClick={() => openForm()} className="press" style={{
              width: '100%', padding: '10px', background: D.ardoise, color: 'white',
              border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>+ Ajouter un produit {typeFilter === 'patisserie' ? 'pâtisserie' : 'pain'}</button>
          </div>

          {/* Produits par famille */}
          {filteredFamilles.map(famille => {
            const famProds = produits.filter(p => p.famille_id === famille.id)
            if (famProds.length === 0) return null
            return (
              <div key={famille.id}>
                <SectionLabel>{famille.nom} <span style={{ color: D.or }}>({famProds.length})</span></SectionLabel>
                {famProds.map((prod: any) => (
                  <div key={prod.id} style={{
                    padding: '11px 16px', borderBottom: `1px solid ${D.craieDark}`,
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: prod.actif ? 'white' : `${D.craieMid}`,
                    opacity: prod.actif ? 1 : .6,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: D.ardoise, fontWeight: 500 }}>{prod.nom}</div>
                      <div style={{ fontSize: 11, color: D.or, marginTop: 2 }}>
                        {Number(prod.prix_base).toFixed(2)} € HT / {prod.unite}
                      </div>
                    </div>
                    {!prod.actif && <Badge type="gris">Inactif</Badge>}
                    <button onClick={() => openForm(prod)} style={{ width: 30, height: 30, background: D.craieMid, border: `1px solid ${D.craieDark}`, borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>✏️</button>
                    <button onClick={() => toggleActif(prod.id, prod.actif)} style={{ width: 30, height: 30, background: prod.actif ? D.vertBg : D.orangeBg, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 11, color: prod.actif ? D.vert : D.orange, fontWeight: 700 }}>
                      {prod.actif ? '✓' : '○'}
                    </button>
                    <button onClick={() => deleteProd(prod.id, prod.nom)} style={{ width: 30, height: 30, background: D.rougeBg, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: D.rouge }}>🗑️</button>
                  </div>
                ))}
              </div>
            )
          })}

          {/* Familles vides — invitation à ajouter */}
          {filteredFamilles.every(f => produits.filter(p => p.famille_id === f.id).length === 0) && (
            <div style={{ padding: 32, textAlign: 'center', color: D.gris }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: D.ardoise, marginBottom: 8 }}>Catalogue vide</div>
              <div style={{ fontSize: 12, color: D.gris, marginBottom: 16, lineHeight: 1.6 }}>
                Le catalogue est vide. Exécute le fichier <strong>produits_patisserie.sql</strong> dans Supabase SQL Editor,
                ou clique ci-dessous pour créer un produit manuellement.
              </div>
              <button onClick={openForm} className="press" style={{ padding: '10px 20px', background: D.ardoise, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + Ajouter un premier produit
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PRIX PAR CLIENT ── */}
      {view === 'prix' && (
        <div>
          {/* Sélection client */}
          <div style={{ padding: '10px 16px', background: 'white', borderBottom: `1px solid ${D.craieDark}` }}>
            <div style={{ fontSize: 11, color: D.gris, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>Sélectionner un client</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {clientsCommercial.map((c: any) => (
                <button key={c.id} onClick={() => setSelClient(c.id)} style={{
                  padding: '10px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                  border: `2px solid ${selClient === c.id ? c.couleur : D.craieDark}`,
                  background: selClient === c.id ? `${c.couleur}10` : 'white',
                  color: selClient === c.id ? c.couleur : D.ardoise,
                  fontSize: 13, fontWeight: selClient === c.id ? 600 : 400,
                }}>
                  {c.nom}
                </button>
              ))}
            </div>
          </div>

          {/* Prix par famille */}
          {selClient && (
            <div style={{ paddingBottom: 40 }}>
              <div style={{ padding: '8px 16px', background: D.craieMid, borderBottom: `1px solid ${D.craieDark}` }}>
                <div style={{ fontSize: 11, color: D.gris }}>
                  Prix en blanc = prix de base. Modifie pour appliquer un tarif spécial.
                </div>
              </div>
              {familles.map(famille => {
                const famProds = produits.filter(p => p.famille_id === famille.id && p.actif)
                if (famProds.length === 0) return null
                return (
                  <div key={famille.id}>
                    <SectionLabel>{famille.nom}</SectionLabel>
                    {famProds.map((prod: any) => {
                      const prixSpecial = prixClient.find(pc => pc.produit_id === prod.id && pc.client_id === selClient)
                      return (
                        <PrixRow
                          key={prod.id}
                          prod={prod}
                          prixSpecial={prixSpecial?.prix}
                          onSave={(prix) => savePrixClient(prod.id, selClient, prix)}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {!selClient && (
            <div style={{ padding: 40, textAlign: 'center', color: D.gris }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>💰</div>
              <div>Sélectionner un client pour gérer ses prix</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Ligne prix éditable ──────────────────────
function PrixRow({ prod, prixSpecial, onSave }: {
  prod: any, prixSpecial: number | undefined, onSave: (prix: string) => void
}) {
  const [val, setVal] = useState(prixSpecial?.toString() || '')
  const [editing, setEditing] = useState(false)
  const hasSpecial = prixSpecial !== undefined && prixSpecial !== prod.prix_base

  return (
    <div style={{
      padding: '10px 16px', borderBottom: `1px solid ${D.craieDark}`,
      display: 'flex', alignItems: 'center', gap: 10, background: hasSpecial ? `${D.or}05` : 'white',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: D.ardoise }}>{prod.nom}</div>
        <div style={{ fontSize: 10, color: D.gris, marginTop: 1 }}>
          Base : {Number(prod.prix_base).toFixed(2)} € HT
        </div>
      </div>
      {editing ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="number" step="0.01" min="0"
            value={val}
            onChange={e => setVal(e.target.value)}
            autoFocus
            style={{ width: 70, padding: '6px 8px', border: `1.5px solid ${D.or}`, borderRadius: 8, fontSize: 13, color: D.ardoise, outline: 'none', background: 'white' }}
          />
          <button onClick={() => { onSave(val); setEditing(false) }} style={{ padding: '6px 10px', background: D.vert, color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✓</button>
          <button onClick={() => { setVal(prixSpecial?.toString() || ''); setEditing(false) }} style={{ padding: '6px 8px', background: D.craieMid, color: D.gris, border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>✕</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} style={{
          padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: hasSpecial ? 700 : 400,
          background: hasSpecial ? `${D.or}15` : D.craieMid,
          color: hasSpecial ? D.or : D.gris,
          border: `1px solid ${hasSpecial ? D.or + '40' : D.craieDark}`,
        }}>
          {hasSpecial ? `${Number(prixSpecial).toFixed(2)} €` : 'Base'}
        </button>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  background: 'white', border: `1.5px solid ${D.craieDark}`,
  borderRadius: 10, fontSize: 13, color: D.ardoise,
  outline: 'none', marginBottom: 10,
}
