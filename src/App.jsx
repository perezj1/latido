import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { AuthProvider } from './hooks/useAuth'
import { usePWA } from './hooks/usePWA'
import { C, PP } from './lib/theme'

// Layout
import Header from './components/Header'
import Footer from './components/Footer'
import BottomNav from './components/BottomNav'

// Pages
import Landing   from './pages/Landing'
import Home      from './pages/Home'
import Tablon    from './pages/Tablon'
import Publicar  from './pages/Publicar'
import Comunidades from './pages/Comunidades'
import Documentos  from './pages/Documentos'
import Familias    from './pages/Familias'
import Foro        from './pages/Foro'
import Empleos     from './pages/Empleos'
import Directorio  from './pages/Directorio'
import Perfil      from './pages/Perfil'
import Auth        from './pages/Auth'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function AppShell() {
  const { pathname } = useLocation()
  const { isPWA, canInstall, promptInstall } = usePWA()

  // Landing page: shown when visiting "/" without PWA AND not logged in
  // If isPWA=true, always show the Home app view
  const isRoot = pathname === '/'
  const showLanding = isRoot && !isPWA

  if (showLanding) return (
    <>
      {/* Minimal header for landing */}
      <nav style={{ position:'sticky', top:0, zIndex:50, background:'rgba(255,255,255,0.95)', backdropFilter:'blur(10px)', borderBottom:`1px solid ${C.border}`, padding:'12px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:18 }}>🌎</span>
          <span style={{ fontFamily:PP, fontWeight:800, fontSize:17, color:C.primary, letterSpacing:-0.5 }}>
            Latino<span style={{ color:C.text }}>Suiza</span>
            <span style={{ fontSize:9, background:C.primary, color:'#fff', padding:'2px 5px', borderRadius:5, marginLeft:4 }}>.ch</span>
          </span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {canInstall && (
            <button onClick={promptInstall} style={{ fontFamily:PP, fontWeight:600, fontSize:11, background:C.bg, color:C.primary, border:`1.5px solid ${C.primaryMid}`, borderRadius:10, padding:'7px 12px', cursor:'pointer' }}>
              📲 Instalar
            </button>
          )}
          <a href="/auth" style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:11, padding:'8px 14px' }}>
            Entrar →
          </a>
        </div>
      </nav>
      <main>
        <Landing onInstall={promptInstall || (() => alert('Para instalar: en el menú de tu navegador busca "Instalar app" o "Añadir a pantalla de inicio"'))} />
      </main>
      <Footer />
    </>
  )

  // App shell: for installed PWA or any inner page
  return (
    <>
      <Header transparent={false} />
      <main style={{ minHeight:'100vh', paddingBottom: 80 }}>
        <Routes>
          <Route path="/"            element={<Home />} />
          <Route path="/tablon"      element={<Tablon />} />
          <Route path="/publicar"    element={<Publicar />} />
          <Route path="/comunidades" element={<Comunidades />} />
          <Route path="/documentos"  element={<Documentos />} />
          <Route path="/familias"    element={<Familias />} />
          <Route path="/foro"        element={<Foro />} />
          <Route path="/empleos"     element={<Empleos />} />
          <Route path="/directorio"  element={<Directorio />} />
          <Route path="/perfil"      element={<Perfil />} />
          <Route path="/auth"        element={<Auth />} />
          <Route path="*"            element={
            <div style={{ textAlign:'center', padding:'100px 24px' }}>
              <div style={{ fontSize:64, marginBottom:16 }}>🌎</div>
              <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, marginBottom:10 }}>Página no encontrada</h1>
              <a href="/" style={{ fontFamily:PP, fontWeight:700, fontSize:14, background:C.primary, color:'#fff', textDecoration:'none', padding:'14px 28px', borderRadius:14, display:'inline-flex' }}>← Volver al inicio</a>
            </div>
          } />
        </Routes>
      </main>
      <Footer />
      <BottomNav />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Toaster
          position="top-center"
          toastOptions={{
            style: { fontFamily:PP, borderRadius:14, fontSize:13, boxShadow:'0 8px 32px rgba(0,0,0,0.12)' },
            success: { iconTheme: { primary:C.primary, secondary:'#fff' } },
          }}
        />
        {/* Route-level split: landing "/" vs app shell */}
        <Routes>
          <Route path="/*" element={<AppShell />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
