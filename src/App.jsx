import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { lazy, Suspense, useEffect } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { usePWA } from './hooks/usePWA'
import { C, PP } from './lib/theme'

import Footer from './components/Footer'
import BottomNav from './components/BottomNav'

const Landing = lazy(() => import('./pages/Landing'))
const Home = lazy(() => import('./pages/Home'))
const Tablon = lazy(() => import('./pages/Tablon'))
const Publicar = lazy(() => import('./pages/Publicar'))
const Comunidades = lazy(() => import('./pages/Comunidades'))
const Guias = lazy(() => import('./pages/Guias'))
const Perfil = lazy(() => import('./pages/Perfil'))
const Auth = lazy(() => import('./pages/Auth'))
const PublicarEvento = lazy(() => import('./pages/PublicarEvento'))
const RegistrarNegocio = lazy(() => import('./pages/RegistrarNegocio'))
const RegistrarComunidad = lazy(() => import('./pages/RegistrarComunidad'))
const PublicarEmpleo = lazy(() => import('./pages/PublicarEmpleo'))
const Legal = lazy(() => import('./pages/Legal'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function AppLoading() {
  return (
    <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:`linear-gradient(180deg, ${C.bg} 0%, #fff 100%)`, padding:'24px' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:68, height:68, margin:'0 auto 16px', borderRadius:20, background:`linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`, color:'#fff', display:'grid', placeItems:'center', fontSize:30, boxShadow:'0 12px 30px rgba(37,99,235,0.22)' }}>
          🌎
        </div>
        <p style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, margin:'0 0 6px', letterSpacing:-0.5 }}>Cargando tu espacio</p>
        <p style={{ fontFamily:PP, fontSize:12, color:C.light, margin:0 }}>Restaurando sesión y preparando la app.</p>
      </div>
    </div>
  )
}

function AuthRoute() {
  const { isLoggedIn, loading } = useAuth()

  if (loading) return <AppLoading />
  if (isLoggedIn) return <Navigate to="/" replace />

  return (
    <Suspense fallback={<AppLoading />}>
      <Auth />
    </Suspense>
  )
}

function ProtectedRoute({ children }) {
  const { isLoggedIn, loading } = useAuth()

  if (loading) return <AppLoading />
  if (!isLoggedIn) return <Navigate to="/auth" replace />

  return children
}

function AppShell() {
  const { pathname } = useLocation()
  const { isPWA, canInstall, promptInstall } = usePWA()
  const { isLoggedIn } = useAuth()

  const isRoot = pathname === '/'
  const showLanding = isRoot && !isPWA && !isLoggedIn

  if (showLanding) {
    return (
      <>
        <nav style={{ position:'sticky', top:0, zIndex:50, background:'rgba(255,255,255,0.95)', backdropFilter:'blur(10px)', borderBottom:`1px solid ${C.border}`, padding:'12px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <img src="/favicon.svg" alt="Latido" style={{ width:32, height:32 }} />
            <span style={{ fontFamily:PP, fontWeight:800, fontSize:17, color:C.primary, letterSpacing:-0.5 }}>Latido</span>
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
          <Suspense fallback={<AppLoading />}>
            <Landing onInstall={promptInstall || (() => alert('Para instalar: en el menú de tu navegador busca "Instalar app" o "Añadir a pantalla de inicio"'))} />
          </Suspense>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <main style={{ minHeight:'100vh', paddingBottom:80 }}>
        <Suspense fallback={<AppLoading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tablon" element={<Tablon />} />
            <Route path="/publicar" element={<ProtectedRoute><Publicar /></ProtectedRoute>} />
            <Route path="/comunidades" element={<Comunidades />} />
            <Route path="/guias" element={<Guias />} />
            <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/publicar-evento" element={<ProtectedRoute><PublicarEvento /></ProtectedRoute>} />
            <Route path="/registrar-negocio" element={<ProtectedRoute><RegistrarNegocio /></ProtectedRoute>} />
            <Route path="/registrar-comunidad" element={<ProtectedRoute><RegistrarComunidad /></ProtectedRoute>} />
            <Route path="/publicar-empleo" element={<ProtectedRoute><PublicarEmpleo /></ProtectedRoute>} />
            <Route path="/impressum"  element={<Legal />} />
            <Route path="/privacidad" element={<Legal />} />
            <Route path="/terminos"   element={<Legal />} />
            <Route path="/descargo"   element={<Legal />} />
            <Route path="/documentos" element={<Navigate to="/guias" replace />} />
            <Route path="/empleos" element={<Navigate to="/tablon?cat=empleo" replace />} />
            <Route path="*" element={
              <div style={{ textAlign:'center', padding:'100px 24px' }}>
                <div style={{ fontSize:64, marginBottom:16 }}>🌎</div>
                <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, marginBottom:10 }}>Página no encontrada</h1>
                <a href="/" style={{ fontFamily:PP, fontWeight:700, fontSize:14, background:C.primary, color:'#fff', textDecoration:'none', padding:'14px 28px', borderRadius:14, display:'inline-flex' }}>← Volver al inicio</a>
              </div>
            } />
          </Routes>
        </Suspense>
      </main>
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
        <Routes>
          <Route path="/*" element={<AppShell />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
