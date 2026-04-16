import { Link } from 'react-router-dom'
import { C, PP } from '../lib/theme'

export default function Footer() {
  const links = [
    { label:'Tablón', href:'/tablon' }, { label:'Comunidades', href:'/comunidades' },
    { label:'Trámites', href:'/documentos' }, { label:'Directorio', href:'/directorio' },
    { label:'Foro', href:'/foro' }, { label:'Publicar', href:'/publicar' },
  ]
  return (
    <footer className="pb-20 md:pb-0" style={{ background:'#0F172A', color:'#64748B', marginTop:64 }}>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'48px 24px 0' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:36, marginBottom:40 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <span style={{ fontSize:22 }}>🌎</span>
              <span style={{ fontFamily:PP, fontWeight:800, fontSize:18, color:C.primary }}>Latino<span style={{ color:'#fff' }}>Suiza</span></span>
            </div>
            <p style={{ fontFamily:PP, fontSize:12, lineHeight:1.7, marginBottom:16 }}>
              La plataforma integral para latinos en Suiza. Tablón de anuncios, comunidades, trámites y directorio de eventos — todo en español.
            </p>
            <div style={{ display:'flex', gap:8 }}>
              {['📸 Instagram','💬 WhatsApp'].map(s => (
                <span key={s} style={{ fontFamily:PP, fontSize:10, fontWeight:600, background:'#1E293B', color:'#94A3B8', padding:'5px 10px', borderRadius:8, cursor:'pointer' }}>{s}</span>
              ))}
            </div>
          </div>
          <div>
            <h4 style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:'#fff', marginBottom:12, letterSpacing:2, textTransform:'uppercase' }}>Plataforma</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {links.map(l => (
                <Link key={l.href} to={l.href} style={{ fontFamily:PP, fontSize:12, color:'#64748B', textDecoration:'none' }}>{l.label}</Link>
              ))}
            </div>
          </div>
          <div>
            <h4 style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:'#fff', marginBottom:12, letterSpacing:2, textTransform:'uppercase' }}>Instalar app</h4>
            <p style={{ fontFamily:PP, fontSize:11, lineHeight:1.7, marginBottom:10 }}>
              Añade LatinoSuiza a tu pantalla de inicio como app nativa.
            </p>
            {['🍎 iPhone: Compartir → Añadir a inicio','🤖 Android: Menú → Instalar app','💻 PC: Icono en la barra de URL'].map(t => (
              <p key={t} style={{ fontFamily:PP, fontSize:10, color:'#475569', marginBottom:4 }}>{t}</p>
            ))}
          </div>
          <div>
            <h4 style={{ fontFamily:PP, fontWeight:700, fontSize:11, color:'#fff', marginBottom:12, letterSpacing:2, textTransform:'uppercase' }}>Contacto</h4>
            <p style={{ fontFamily:PP, fontSize:12, marginBottom:4 }}>📧 hola@latinosuiza.ch</p>
            <p style={{ fontFamily:PP, fontSize:12, marginBottom:4 }}>📍 Zürich, Suiza</p>
            <div style={{ marginTop:14, background:'#1E293B', borderRadius:12, padding:'12px 14px' }}>
              <p style={{ fontFamily:PP, fontSize:11, color:'#64748B', margin:0 }}>
                ¿Proveedor de eventos?{' '}
                <Link to="/directorio/registro" style={{ color:C.primary, fontWeight:700 }}>Únete gratis →</Link>
              </p>
            </div>
          </div>
        </div>
        <div style={{ borderTop:'1px solid #1E293B', paddingTop:20, paddingBottom:24, display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'center', gap:10 }}>
          <p style={{ fontFamily:PP, fontSize:11, margin:0 }}>© 2025 LatinoSuiza.ch — Hecho con 💙 para la comunidad latina</p>
          <div style={{ display:'flex', gap:16 }}>
            {['Privacidad','Términos'].map(l => (
              <Link key={l} to={`/${l.toLowerCase()}`} style={{ fontFamily:PP, fontSize:11, color:'#475569', textDecoration:'none' }}>{l}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
