import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { C, PP, CAT_COLORS } from '../lib/theme'
import { MOCK_ADS, MOCK_JOBS, AD_CATS, AD_TYPES, CANTONS } from '../lib/constants'
import { Tag, PrivacyTag, Avatar, Sheet, Btn, PillFilters } from '../components/UI'
import toast from 'react-hot-toast'

function JobCard({ job }) {
  return (
    <div style={{ background:'#fff', borderRadius:14, border:`1px solid ${C.border}`, padding:'15px 17px', display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ width:52, height:52, background:C.primaryLight, borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>{job.emoji || '💼'}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
          <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, margin:0 }}>{job.title}</h3>
          <Tag bg={job.type==='Full-time'?C.primaryLight:'#D1FAE5'} color={job.type==='Full-time'?C.primary:'#065F46'}>{job.type}</Tag>
        </div>
        <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:'0 0 2px' }}>{job.company} · 📍 {job.city || job.canton}</p>
        {job.lang && <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>🗣️ {job.lang}</p>}
        <p style={{ fontFamily:PP, fontSize:13, fontWeight:700, color:'#059669', margin:'4px 0 0' }}>{job.salary}</p>
      </div>
      {job.contact
        ? <a href={`mailto:${job.contact}`} style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:11, padding:'9px 14px', flexShrink:0 }}>Aplicar →</a>
        : <span style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.primary, flexShrink:0 }}>Ver →</span>
      }
    </div>
  )
}

function AdFull({ ad, user, onReveal, revealed }) {
  const cat = AD_CATS.find(c => c.id === ad.cat)
  const cc  = CAT_COLORS[ad.cat] || { bg:C.primaryLight, tc:C.primary }
  const isPrivate = ad.privacy === 'private'
  const canSee = !isPrivate || revealed

  return (
    <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${C.border}`, overflow:'hidden', marginBottom:10 }}>
      {(ad.img_url || ad.img) && <img src={ad.img_url || ad.img} alt={ad.title} style={{ width:'100%', height:180, objectFit:'cover' }}/>}
      <div style={{ padding:'13px 15px' }}>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:8 }}>
          <Tag bg={cc.bg} color={cc.tc}>{cat?.emoji} {cat?.label}</Tag>
          {ad.sub && <Tag bg={C.bg} color={C.mid}>{ad.sub}</Tag>}
          <PrivacyTag privacy={ad.privacy}/>
          {ad.verified && <Tag bg="#D1FAE5" color="#065F46">✓ Verificado</Tag>}
        </div>
        <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:C.text, lineHeight:1.35, marginBottom:5 }}>{ad.title}</h3>
        <p style={{ fontFamily:PP, fontSize:12, color:C.mid, lineHeight:1.65, marginBottom:10 }}>{ad.desc}</p>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={{ display:'flex', gap:7, alignItems:'center' }}>
            <Avatar name={ad.user_name || ad.user} size={22}/>
            <span style={{ fontFamily:PP, fontSize:10, color:C.light }}>{ad.user_name || ad.user || 'Usuario'} · 📍 {ad.canton} {ad.plz} · {ad.ts || (ad.created_at ? new Date(ad.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'}) : '')}</span>
          </div>
          <span style={{ fontFamily:PP, fontSize:13, fontWeight:800, color:C.primary }}>{ad.price}</span>
        </div>
        {isPrivate && !canSee ? (
          <div style={{ background:C.warnLight, border:`1px solid ${C.warnMid}`, borderRadius:12, padding:'11px 13px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:18 }}>🔒</span>
              <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:'#92400E', margin:0 }}>Contacto privado</p>
            </div>
            <p style={{ fontFamily:PP, fontSize:11, color:'#A16207', lineHeight:1.5, marginBottom:10 }}>
              {user ? 'Haz click para desbloquear el contacto de este anuncio.' : 'Solo los usuarios registrados pueden ver los contactos privados. Crea una cuenta gratis.'}
            </p>
            <Btn onClick={onReveal} variant={user ? 'primary' : 'dark'} size="sm">
              {user ? '👁️ Ver contacto' : '🔐 Crear cuenta para ver'}
            </Btn>
          </div>
        ) : isPrivate && canSee ? (
          <div style={{ background:C.successLight, border:`1px solid ${C.successMid}`, borderRadius:12, padding:'11px 13px' }}>
            <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.success, marginBottom:6 }}>✅ Contacto desbloqueado</p>
            {ad.whatsapp && <a href={`https://wa.me/${ad.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{ fontFamily:PP, fontSize:12, color:'#065F46', marginBottom:4, textDecoration:'none', display:'block', fontWeight:600 }}>📱 {ad.whatsapp}</a>}
            {ad.email_contact && <a href={`mailto:${ad.email_contact}`} style={{ fontFamily:PP, fontSize:12, color:'#065F46', textDecoration:'none', display:'block', fontWeight:600 }}>📧 {ad.email_contact}</a>}
            {!ad.whatsapp && !ad.email_contact && <p style={{ fontFamily:PP, fontSize:12, color:'#065F46', margin:0 }}>Sin datos de contacto indicados</p>}
          </div>
        ) : (
          <div style={{ display:'flex', gap:8 }}>
            {ad.whatsapp && <a href={`https://wa.me/${ad.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{ flex:1, fontFamily:PP, fontWeight:700, fontSize:12, background:'#25D366', color:'#fff', textDecoration:'none', borderRadius:12, padding:'11px 0', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>💬 WhatsApp</a>}
            {ad.email_contact && <a href={`mailto:${ad.email_contact}`} style={{ flex:1, fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:12, padding:'11px 0', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>✉️ Email</a>}
            {!ad.whatsapp && !ad.email_contact && <p style={{ fontFamily:PP, fontSize:11, color:C.light, margin:0 }}>Sin contacto público</p>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Tablon() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { isLoggedIn, user } = useAuth()
  const [ads, setAds] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [revealed, setRevealed] = useState({})

  const cat     = searchParams.get('cat') || ''
  const type    = searchParams.get('type') || ''
  const canton  = searchParams.get('canton') || ''
  const plz     = searchParams.get('plz') || ''
  const privacy = searchParams.get('privacy') || ''
  const jobType = searchParams.get('jobType') || ''

  const isEmpleos = cat === 'empleo'

  const setFilter = (k, v) => {
    const p = new URLSearchParams(searchParams)
    v ? p.set(k, v) : p.delete(k)
    setSearchParams(p)
  }
  const clearFilters = () => setSearchParams({})
  const activeCount = [cat,type,canton,plz,privacy].filter(Boolean).length

  useEffect(() => {
    if (!user?.id) return
    supabase.from('contact_reveals').select('ad_id').eq('user_id', user.id)
      .then(({ data }) => {
        if (data?.length) setRevealed(data.reduce((acc, r) => ({ ...acc, [r.ad_id]: true }), {}))
      }).catch(() => {})
  }, [user?.id])

  useEffect(() => {
    setLoading(true)
    if (isEmpleos) {
      supabase.from('jobs').select('*').eq('active', true).order('created_at', { ascending:false })
        .then(({ data, error }) => { setJobs(error || !data?.length ? MOCK_JOBS : data) })
        .catch(() => setJobs(MOCK_JOBS))
        .finally(() => setLoading(false))
    } else {
      async function load() {
        try {
          let q = supabase.from('ads').select('*').eq('active', true).order('created_at', { ascending:false })
          if (cat)    q = q.eq('cat', cat)
          if (type)   q = q.eq('type', type)
          if (canton) q = q.eq('canton', canton)
          if (plz)    q = q.ilike('plz', `${plz}%`)
          const { data, error } = await q
          if (error) throw error
          setAds(data?.length ? data : filterMock())
        } catch { setAds(filterMock()) }
        finally { setLoading(false) }
      }
      load()
    }
  }, [cat, type, canton, plz, isEmpleos])

  function filterMock() {
    return MOCK_ADS.filter(a =>
      (!cat || a.cat===cat) && (!type || a.type===type) &&
      (!canton || a.canton===canton) && (!plz || a.plz.startsWith(plz)) &&
      (!privacy || a.privacy===privacy)
    )
  }

  const filteredAds = ads.filter(a =>
    (!privacy || a.privacy===privacy) &&
    (!search || a.title.toLowerCase().includes(search.toLowerCase()) || a.desc?.toLowerCase().includes(search.toLowerCase()))
  )

  const filteredJobs = jobs.filter(j =>
    (!jobType || j.type===jobType) &&
    (!search || j.title.toLowerCase().includes(search.toLowerCase()) || j.company?.toLowerCase().includes(search.toLowerCase()))
  )

  const handleReveal = async (adId) => {
    if (!isLoggedIn) { window.location.href = '/auth'; return }
    try {
      await supabase.from('contact_reveals').upsert({ user_id: user.id, ad_id: adId }, { onConflict: 'user_id,ad_id' })
    } catch {}
    setRevealed(r => ({ ...r, [adId]: true }))
    toast.success('Contacto desbloqueado')
  }

  const catOptions  = [{ id:'', label:'Todos' }, ...AD_CATS.map(c => ({ id:c.id, label:`${c.emoji} ${c.label}` }))]
  const typeOptions = [{ id:'', label:'Todos' }, ...AD_TYPES.map(t => ({ id:t.id, label:`${t.emoji} ${t.label}` }))]
  const privOptions = [{ id:'', label:'Todos' }, { id:'public', label:'🌐 Públicos' }, { id:'private', label:'🔒 Privados' }]
  const jobTypeOpts = [{ id:'', label:'Todos' }, { id:'Full-time', label:'Full-time' }, { id:'Part-time', label:'Part-time' }]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 20px 100px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, letterSpacing:-0.5, marginBottom:4 }}>
            {isEmpleos ? '💼 Empleos para latinos' : '📌 Tablón de anuncios'}
          </h1>
          <p style={{ fontFamily:PP, fontSize:12, color:C.light }}>
            {loading ? 'Cargando...' : isEmpleos ? `${filteredJobs.length} ofertas encontradas` : `${filteredAds.length} anuncios encontrados`}
            {canton && ` · 📍 Cantón ${canton}`}
          </p>
        </div>
        <a href="/publicar" style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:13, padding:'10px 16px', flexShrink:0 }}>+ Publicar</a>
      </div>

      {/* Search */}
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <div style={{ flex:1, position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:14, color:C.light }}>🔍</span>
          <input
            style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:13, padding:'10px 12px 10px 34px', fontSize:12, fontFamily:PP, outline:'none', background:'#fff', color:C.text, boxSizing:'border-box' }}
            placeholder={isEmpleos ? 'Buscar empleo o empresa...' : 'Buscar en el tablón...'}
            value={search} onChange={e=>setSearch(e.target.value)}
          />
        </div>
        {!isEmpleos && (
          <button onClick={()=>setShowFilters(true)} style={{ position:'relative', background: activeCount>0?C.primary:C.bg, border:`1.5px solid ${activeCount>0?C.primary:C.border}`, borderRadius:13, padding:'0 16px', cursor:'pointer', fontFamily:PP, fontSize:11, fontWeight:700, color: activeCount>0?'#fff':C.mid, display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            ⚙️ Filtros
            {activeCount > 0 && <span style={{ background:'#fff', color:C.primary, borderRadius:'50%', width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800 }}>{activeCount}</span>}
          </button>
        )}
      </div>

      {/* Category pills */}
      <div className="no-scroll" style={{ display:'flex', gap:6, overflowX:'auto', marginBottom: activeCount>0?8:16, paddingBottom:2 }}>
        {catOptions.map(o => (
          <button key={o.id} onClick={()=>setFilter('cat', cat===o.id?'':o.id)} style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'5px 12px', borderRadius:20, border:`1.5px solid ${cat===o.id?C.primary:C.border}`, background:cat===o.id?C.primary:'#fff', color:cat===o.id?'#fff':C.mid, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
            {o.label}
          </button>
        ))}
      </div>

      {/* Job type pills (only when empleo selected) */}
      {isEmpleos && (
        <div style={{ marginBottom:16 }}>
          <PillFilters options={jobTypeOpts} value={jobType} onChange={v=>setFilter('jobType',v)} />
        </div>
      )}

      {/* Active filter strip */}
      {activeCount > 0 && !isEmpleos && (
        <div style={{ background:C.primaryLight, borderRadius:10, padding:'6px 12px', display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:14 }}>
          {canton  && <Tag bg={C.primaryMid} color={C.primaryDark}>📍 Cantón {canton}</Tag>}
          {plz     && <Tag bg={C.primaryMid} color={C.primaryDark}>📮 PLZ {plz}</Tag>}
          {type    && <Tag bg={C.primaryMid} color={C.primaryDark}>{AD_TYPES.find(t=>t.id===type)?.emoji} {AD_TYPES.find(t=>t.id===type)?.label}</Tag>}
          {privacy && <Tag bg={C.primaryMid} color={C.primaryDark}>{privacy==='public'?'🌐 Público':'🔒 Privado'}</Tag>}
          <button onClick={clearFilters} style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.primary, background:'none', border:'none', cursor:'pointer', marginLeft:'auto' }}>✕ Limpiar</button>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:isEmpleos?90:160, borderRadius:16 }}/>)}
        </div>
      ) : isEmpleos ? (
        filteredJobs.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ fontSize:52, marginBottom:14 }}>📭</div>
            <h3 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, marginBottom:8 }}>Sin ofertas ahora</h3>
            <p style={{ fontFamily:PP, fontSize:12, color:C.light }}>Vuelve pronto — se actualizan frecuentemente</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filteredJobs.map(j => <JobCard key={j.id} job={j} />)}
            <div style={{ marginTop:16, border:`2px dashed ${C.border}`, borderRadius:16, padding:'18px 20px', textAlign:'center', background:C.primaryLight }}>
              <h3 style={{ fontFamily:PP, fontWeight:700, fontSize:15, color:C.text, marginBottom:6 }}>¿Tienes una oferta de trabajo?</h3>
              <p style={{ fontFamily:PP, fontSize:12, color:C.mid, marginBottom:12 }}>Publica gratis y llega a miles de latinos en Suiza.</p>
              <a href="mailto:hola@latido.ch?subject=Publicar oferta de empleo" style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', padding:'10px 22px', borderRadius:13, display:'inline-flex' }}>Publicar empleo gratis</a>
            </div>
          </div>
        )
      ) : filteredAds.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px' }}>
          <div style={{ fontSize:52, marginBottom:14 }}>📭</div>
          <h3 style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.text, marginBottom:8 }}>Sin resultados</h3>
          <p style={{ fontFamily:PP, fontSize:12, color:C.light, marginBottom:16 }}>Prueba otros filtros o sé el primero en publicar</p>
          <a href="/publicar" style={{ fontFamily:PP, fontWeight:700, fontSize:13, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:13, padding:'11px 22px', display:'inline-flex', alignItems:'center', gap:6 }}>Publicar anuncio</a>
        </div>
      ) : (
        <div>
          {filteredAds.map(ad => (
            <AdFull key={ad.id} ad={ad} user={isLoggedIn} revealed={!!revealed[ad.id]} onReveal={() => handleReveal(ad.id)} />
          ))}
        </div>
      )}

      {/* Filters sheet (ads only) */}
      <Sheet show={showFilters} onClose={()=>setShowFilters(false)} title="⚙️ Filtros">
        <div style={{ marginBottom:14 }}>
          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:8 }}>TIPO DE ANUNCIO</p>
          <PillFilters options={typeOptions} value={type} onChange={v=>setFilter('type',v)} />
        </div>
        <div style={{ marginBottom:14 }}>
          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:8 }}>VISIBILIDAD</p>
          <PillFilters options={privOptions} value={privacy} onChange={v=>setFilter('privacy',v)} />
        </div>
        <div style={{ marginBottom:14 }}>
          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:8 }}>CANTÓN</p>
          <div className="no-scroll" style={{ display:'flex', gap:5, flexWrap:'wrap', maxHeight:120, overflowY:'auto' }}>
            {CANTONS.map(c => (
              <button key={c.code} onClick={()=>setFilter('canton', canton===c.code?'':c.code)} style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'4px 10px', borderRadius:16, border:`1.5px solid ${canton===c.code?C.primary:C.border}`, background:canton===c.code?C.primary:'#fff', color:canton===c.code?'#fff':C.mid, cursor:'pointer', flexShrink:0 }}>
                {c.code}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:20 }}>
          <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:8 }}>PLZ (código postal)</p>
          <input
            style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:12, padding:'10px 13px', fontSize:13, fontFamily:PP, outline:'none', background:'#fff', color:C.text, boxSizing:'border-box' }}
            placeholder="Ej: 8001, 3000, 1200..." value={plz} onChange={e=>setFilter('plz',e.target.value)} maxLength={4}
          />
        </div>
        <Btn onClick={()=>setShowFilters(false)}>Aplicar filtros</Btn>
        {activeCount > 0 && (
          <button onClick={()=>{clearFilters();setShowFilters(false);}} style={{ fontFamily:PP, fontWeight:600, fontSize:12, color:C.mid, background:'none', border:'none', cursor:'pointer', width:'100%', marginTop:10, padding:'6px 0' }}>
            Limpiar todos los filtros
          </button>
        )}
      </Sheet>
    </div>
  )
}
