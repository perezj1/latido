import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { C, PP } from '../lib/theme'
import Publicar from './Publicar'
import PublicarEmpleo from './PublicarEmpleo'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHARED_PUBLICATION_KINDS = new Set(['ad', 'job'])

function StatusScreen({ icon, title, text }) {
  return (
    <main style={{ minHeight:'100dvh', display:'grid', placeItems:'center', padding:24, background:'#F7FAFF' }}>
      <section style={{ width:'min(460px, 100%)', padding:'34px 24px', border:`1px solid ${C.border}`, borderRadius:24, background:'#fff', textAlign:'center', boxShadow:'0 24px 70px -38px rgba(15,23,42,.42)' }}>
        <span aria-hidden="true" style={{ display:'block', fontSize:48, marginBottom:15 }}>{icon}</span>
        <h1 style={{ margin:'0 0 9px', fontFamily:PP, fontSize:21, color:C.text }}>{title}</h1>
        <p style={{ margin:0, fontFamily:PP, fontSize:12, lineHeight:1.65, color:C.mid }}>{text}</p>
      </section>
    </main>
  )
}

export default function PuntoHispanoPublicar() {
  const { linkToken = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [state, setState] = useState({ loading:true, valid:false, publisherName:'Punto Hispano' })
  const [publicationKind, setPublicationKind] = useState(() => {
    const historyKind = window.history.state?.usr?.puntoHispanoPublicationKind
    return SHARED_PUBLICATION_KINDS.has(historyKind) ? historyKind : ''
  })

  useEffect(() => {
    const historyKind = location.state?.puntoHispanoPublicationKind
    setPublicationKind(SHARED_PUBLICATION_KINDS.has(historyKind) ? historyKind : '')
    window.scrollTo({ top:0, left:0, behavior:'instant' })
  }, [location.key, location.state])

  const openPublication = kind => {
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      state:{ ...location.state, puntoHispanoPublicationKind:kind },
    })
    setPublicationKind(kind)
  }

  const returnToSelector = () => {
    if (SHARED_PUBLICATION_KINDS.has(location.state?.puntoHispanoPublicationKind)) {
      navigate(-1)
      return
    }
    setPublicationKind('')
    window.scrollTo({ top:0, left:0, behavior:'instant' })
  }

  useEffect(() => {
    const previousTitle = document.title
    const robots = document.querySelector('meta[name="robots"]')
    const previousRobots = robots?.getAttribute('content')
    const meta = robots || document.createElement('meta')
    if (!robots) {
      meta.setAttribute('name', 'robots')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', 'noindex,nofollow,noarchive')
    document.title = 'Publicar para Punto Hispano · Latido'

    return () => {
      document.title = previousTitle
      if (!robots) meta.remove()
      else if (previousRobots) robots.setAttribute('content', previousRobots)
      else robots.removeAttribute('content')
    }
  }, [])

  useEffect(() => {
    let active = true
    const validate = async () => {
      if (!UUID_PATTERN.test(linkToken)) {
        if (active) setState({ loading:false, valid:false, publisherName:'Punto Hispano' })
        return
      }

      const { data, error } = await supabase.rpc('get_punto_hispano_publish_link', {
        p_link_token:linkToken,
      })
      if (!active) return
      if (error) {
        console.error('Punto Hispano shared publishing link validation failed:', error)
        setState({ loading:false, valid:false, publisherName:'Punto Hispano', unavailable:true })
        return
      }
      setState({
        loading:false,
        valid:data?.valid === true,
        publisherName:data?.publisher_name || 'Punto Hispano',
      })
    }
    validate()
    return () => { active = false }
  }, [linkToken])

  if (state.loading) {
    return <StatusScreen icon="⏳" title="Comprobando la URL" text="Estamos preparando el formulario seguro de Punto Hispano." />
  }

  if (!state.valid) {
    return (
      <StatusScreen
        icon="🔒"
        title={state.unavailable ? 'Formulario no disponible' : 'Esta URL ya no es válida'}
        text={state.unavailable
          ? 'No pudimos comprobar el enlace en este momento. Inténtalo de nuevo más tarde.'
          : 'El enlace pudo eliminarse o reemplazarse. Solicita una URL nueva al administrador de Latido.'}
      />
    )
  }

  return (
    <div style={{ minHeight:'100dvh', background:'#fff' }}>
      <header style={{ borderBottom:`1px solid ${C.border}`, background:'rgba(255,255,255,.96)' }}>
        <div style={{ width:'min(760px, 100%)', boxSizing:'border-box', margin:'0 auto', padding:'13px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <img src="/partners/punto-hispano/logo.webp" alt="Punto Hispano" style={{ width:38, height:38, objectFit:'contain', borderRadius:10 }} />
            <div>
              <strong style={{ display:'block', fontFamily:PP, fontSize:13, color:C.text }}>Punto Hispano</strong>
              <span style={{ display:'block', fontFamily:PP, fontSize:9.5, color:C.light }}>Publicación autorizada</span>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, color:C.light, fontFamily:PP, fontSize:10 }}>
            <span>con</span>
            <img src="/favicon.svg" alt="" style={{ width:20, height:20 }} />
            <strong style={{ color:C.primary }}>Latido</strong>
          </div>
        </div>
      </header>
      {!publicationKind && (
        <main style={{ width:'min(700px, 100%)', boxSizing:'border-box', margin:'0 auto', padding:'38px 20px 80px' }}>
          <div style={{ marginBottom:24 }}>
            <p style={{ margin:'0 0 6px', fontFamily:PP, fontSize:11, fontWeight:700, letterSpacing:.7, color:C.primary, textTransform:'uppercase' }}>Publicar como {state.publisherName}</p>
            <h1 style={{ margin:'0 0 8px', fontFamily:PP, fontSize:25, lineHeight:1.25, color:C.text }}>¿Qué quieres publicar?</h1>
            <p style={{ margin:0, fontFamily:PP, fontSize:12, lineHeight:1.6, color:C.mid }}>Elige el tipo de publicación. Todo quedará asociado automáticamente a la cuenta de Punto Hispano.</p>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
            {[
              { id:'ad', icon:'📣', title:'Anuncio', text:'Vivienda, servicios, cuidados, compraventa o trámites' },
              { id:'job', icon:'💼', title:'Empleo', text:'Publicar una oferta de empleo' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => openPublication(item.id)}
                style={{ width:'100%', minHeight:92, padding:'16px 18px', display:'flex', alignItems:'center', gap:17, background:'#F7F9FD', border:'1px solid #DCE5F2', borderRadius:20, cursor:'pointer', textAlign:'left', color:C.text }}
              >
                <span aria-hidden="true" style={{ width:54, height:54, flex:'0 0 54px', display:'grid', placeItems:'center', borderRadius:16, background:'#EEF4FC', fontSize:27 }}>{item.icon}</span>
                <span style={{ minWidth:0, flex:1 }}>
                  <strong style={{ display:'block', marginBottom:5, fontFamily:PP, fontSize:17, color:C.text }}>{item.title}</strong>
                  <span style={{ display:'block', fontFamily:PP, fontSize:12, lineHeight:1.45, color:C.mid }}>{item.text}</span>
                </span>
                <span aria-hidden="true" style={{ fontFamily:PP, fontSize:22, color:C.mid }}>›</span>
              </button>
            ))}
          </div>
        </main>
      )}
      {publicationKind === 'ad' && (
        <Publicar sharedPublishToken={linkToken} sharedPublisherName={state.publisherName} onSharedExit={returnToSelector} />
      )}
      {publicationKind === 'job' && (
        <PublicarEmpleo sharedPublishToken={linkToken} sharedPublisherName={state.publisherName} onSharedExit={returnToSelector} />
      )}
    </div>
  )
}
