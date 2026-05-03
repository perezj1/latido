import { Link } from 'react-router-dom'
import { C, PP } from '../lib/theme'

export default function Footer() {
  const links = [
    { label:'Tablón', href:'/tablon' },
    { label:'Comunidad', href:'/comunidades' },
    { label:'Guías', href:'/guias' },
    { label:'Empleos', href:'/tablon?cat=empleo' },
    { label:'Publicar', href:'/publicar' },
  ]

  return (
    <footer className="pb-20 md:pb-0" style={{ background:'#0F172A', color:'#64748B' }}>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'64px 24px 0' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:36, marginBottom:40 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <img src="/favicon.svg" alt="Latido" style={{ width:32, height:32 }} />
              <span style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.primary }}>Latido</span>
            </div>
            <p style={{ fontFamily:PP, fontSize:12, lineHeight:1.7, marginBottom:0 }}>
              La plataforma para Hispanohablantes en Suiza. Anuncios, grupos, eventos, guías y empleos — todo en español.
            </p>
            {/* <div style={{ display:'flex', gap:8 }}>
              {['📸 Instagram', '💬 WhatsApp'].map(label => (
                <span key={label} style={{ fontFamily:PP, fontSize:10, fontWeight:600, background:'#1E293B', color:'#94A3B8', padding:'5px 10px', borderRadius:8, cursor:'pointer' }}>{label}</span>
              ))}
            </div> */}
          </div>

          {/* <div>
            <h4 style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:'#fff', marginBottom:12, letterSpacing:2, textTransform:'uppercase' }}>Plataforma</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {links.map(link => (
                <Link key={link.href} to={link.href} style={{ fontFamily:PP, fontSize:12, color:'#64748B', textDecoration:'none' }}>{link.label}</Link>
              ))}
            </div>
          </div> */}

          {/* <div>
            <h4 style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:'#fff', marginBottom:12, letterSpacing:2, textTransform:'uppercase' }}>Instalar app</h4>
            <p style={{ fontFamily:PP, fontSize:11, lineHeight:1.7, marginBottom:10 }}>
              Añade Latido a tu pantalla de inicio como app nativa.
            </p>
            {['🍎 iPhone: Compartir → Añadir a inicio', '🤖 Android: Menú → Instalar app', '💻 PC: Icono en la barra de URL'].map(text => (
              <p key={text} style={{ fontFamily:PP, fontSize:10, color:'#475569', marginBottom:4 }}>{text}</p>
            ))}
          </div> */}

          <div>
            <h4 style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:'#fff', marginBottom:12, letterSpacing:2, textTransform:'uppercase' }}>Contacto</h4>
            <p style={{ fontFamily:PP, fontSize:12, marginBottom:4 }}>📧 latidoch@gmail.com</p>
            <p style={{ fontFamily:PP, fontSize:12, marginBottom:4 }}>📍 Luzern, Suiza</p>
            <div style={{ marginTop:14, background:'#1E293B', borderRadius:12, padding:'12px 14px' }}>
              <p style={{ fontFamily:PP, fontSize:11, color:'#64748B', margin:0 }}>
                ¿Buscas trabajo en Suiza?{' '}
                <Link to="/tablon?cat=empleo" style={{ color:C.primary, fontWeight:700 }}>Ver empleos →</Link>
              </p>
            </div>
          </div>
        </div>

        <div style={{ borderTop:'1px solid #1E293B', paddingTop:20, paddingBottom:24, display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'center', gap:10 }}>
          <p style={{ fontFamily:PP, fontSize:11, margin:0 }}>© 2026 Latido.ch — Hecho con 💙 para la comunidad hispanohablante</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:16 }}>
            {[
              { label:'Impressum',   to:'/impressum' },
              { label:'Privacidad',  to:'/privacidad' },
              { label:'Términos',    to:'/terminos' },
              { label:'Descargo',    to:'/descargo' },
            ].map(({ label, to }) => (
              <Link key={to} to={to} style={{ fontFamily:PP, fontSize:11, color:'#475569', textDecoration:'none' }}>{label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
