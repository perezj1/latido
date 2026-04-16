import { Link } from 'react-router-dom'
import { C, PP } from '../lib/theme'
export default function NotFound() {
  return (
    <div style={{ textAlign:'center', padding:'100px 24px' }}>
      <div style={{ fontSize:64, marginBottom:16 }}>🌎</div>
      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:26, color:C.text, marginBottom:10 }}>Página no encontrada</h1>
      <p style={{ fontFamily:PP, fontSize:14, color:C.mid, marginBottom:24 }}>Esta sección aún no existe o la URL no es correcta.</p>
      <Link to="/" style={{ fontFamily:PP, fontWeight:700, fontSize:14, background:C.primary, color:'#fff', textDecoration:'none', padding:'14px 28px', borderRadius:14, display:'inline-flex', alignItems:'center', gap:6 }}>← Volver al inicio</Link>
    </div>
  )
}
