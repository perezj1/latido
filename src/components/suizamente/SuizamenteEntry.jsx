import { Link } from 'react-router-dom'

export default function SuizamenteEntry({ surface='home' }) {
  return <section aria-label="Suizamente" style={{ padding:22, border:'1px solid #E4E8EF', borderRadius:22, background:'#fff', fontFamily:'Poppins, sans-serif' }}>
    <Link to="/suizamente" style={{ display:'flex', gap:14, alignItems:'center', color:'#0F1A2B', textDecoration:'none' }}>
      <img src="/favicon.svg" alt="Latido" width="64" height="64" />
      <div>
        <h2 style={{ margin:0, fontSize:26, fontWeight:900, letterSpacing:'-.035em', lineHeight:1.2 }}><span style={{ color:'#FA2F35' }}>Suiza</span><span style={{ color:'#4A76EF' }}>mente</span></h2>
        <p style={{ margin:'5px 0 0', fontSize:14, color:'#5A6577' }}>{surface === 'profile' ? 'Sigue aprendiendo sobre Suiza' : 'Un juego de Latido'}</p>
      </div>
    </Link>
    <p style={{ margin:'16px 0', fontSize:16, lineHeight:1.5, color:'#5A6577' }}>Elige, mira qué eligió la comunidad y aprende algo de Suiza en cada pregunta.</p>
    <p style={{ margin:'0 0 16px', fontSize:14, color:'#5A6577' }}>100 preguntas · ¿Qué prefieres? · Preguntas y respuestas · Mix</p>
    <Link to="/suizamente" style={{ display:'flex', justifyContent:'center', padding:'14px 20px', borderRadius:999, background:'#FA2F35', color:'#fff', fontWeight:800, fontSize:17, textDecoration:'none' }}>Jugar a Suizamente</Link>
  </section>
}
