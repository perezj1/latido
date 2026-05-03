import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { lazy, Suspense, useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { usePWA } from './hooks/usePWA'
import { loadPushSettings, syncExistingPushRegistration } from './lib/pushNotifications'
import { C, PP } from './lib/theme'

import Footer from './components/Footer'
import BottomNav from './components/BottomNav'
import Header from './components/Header'
import GlobalSearch from './components/GlobalSearch'

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
const Mensajes = lazy(() => import('./pages/Mensajes'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
const isAndroid = /Android/.test(navigator.userAgent)

function PWAInstallBanner({ canInstall, promptInstall, isPWA }) {
  const { isLoggedIn } = useAuth()
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('latido_pwa_dismissed') === '1')
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (isLoggedIn) {
      sessionStorage.removeItem('latido_pwa_dismissed')
      setDismissed(false)
    }
  }, [isLoggedIn])

  const dismiss = () => {
    sessionStorage.setItem('latido_pwa_dismissed', '1')
    setDismissed(true)
  }

  const handleInstall = async () => {
    const accepted = await promptInstall()
    if (!accepted) return

    setInstalled(true)
  }

  if (!isLoggedIn || isPWA || dismissed || installed) return null
  if (!canInstall && !isIOS) return null

  return (
    <div style={{ position:'fixed', bottom:72, left:0, right:0, zIndex:200, padding:'0 12px', pointerEvents:'none' }}>
      <div style={{ background:`linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`, borderRadius:18, padding:'14px 16px', boxShadow:'0 8px 32px rgba(37,99,235,0.35)', display:'flex', gap:12, alignItems:'flex-start', pointerEvents:'all', maxWidth:480, margin:'0 auto' }}>
        <div style={{ fontSize:28, flexShrink:0, marginTop:2 }}>📲</div>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:'#fff', margin:'0 0 2px' }}>Instala Latido en tu móvil</p>
          {isIOS ? (
            <p style={{ fontFamily:PP, fontSize:11, color:'rgba(255,255,255,0.65)', margin:'0 0 10px', lineHeight:1.5 }}>
              Toca <strong style={{ color:'#fff' }}>Compartir 📤</strong> y luego <strong style={{ color:'#fff' }}>"Añadir a pantalla de inicio"</strong> para instalar la app.
            </p>
          ) : (
            <p style={{ fontFamily:PP, fontSize:11, color:'rgba(255,255,255,0.65)', margin:'0 0 10px', lineHeight:1.5 }}>
                    Añade Latido a tu pantalla de inicio gratis y accede a tu comunidad en segundos estés donde estés.
            </p>
          )}
          <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:4 }}>
            {!isIOS && canInstall && (
              <button onClick={handleInstall} style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', border:'none', borderRadius:10, padding:'9px 20px', cursor:'pointer', flex:1 }}>
                Instalar
              </button>
            )}
            <button onClick={dismiss} style={{ fontFamily:PP, fontWeight:600, fontSize:12, background:'rgba(255,255,255,0.18)', color:'#fff', border:'1px solid rgba(255,255,255,0.25)', borderRadius:10, padding:'9px 20px', cursor:'pointer', flex:1 }}>
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PushRegistrationSync() {
  const { user, isLoggedIn, userCanton } = useAuth()

  useEffect(() => {
    if (!isLoggedIn || !user?.id) return
    syncExistingPushRegistration({
      user,
      settings: loadPushSettings(),
      userCanton,
    }).catch(err => console.warn('Could not sync push registration:', err))
  }, [isLoggedIn, user?.id, userCanton])

  return null
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
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

const CAT_LINKS = [
  { emoji:'🏠', label:'Vivienda',    to:'/tablon?cat=vivienda' },
  { emoji:'💼', label:'Empleo',      to:'/tablon?cat=empleo' },
  { emoji:'🛍️', label:'Mercado',     to:'/tablon?cat=venta' },
  { emoji:'🔧', label:'Servicios',   to:'/tablon?cat=servicios' },
  { emoji:'🤝', label:'Comunidad',   to:'/comunidades' },
  { emoji:'🎉', label:'Eventos',     to:'/comunidades?view=eventos' },
  { emoji:'📚', label:'Guías',       to:'/guias' },
]

function CategoryBar() {
  const { pathname, search } = useLocation()
  const full = pathname + search
  const isLanding = pathname === '/'
  if (isLanding) return null
  return (
    <div className="cat-bar no-scroll show-md" style={{ background:'#fff', borderBottom:`1px solid ${C.border}`, overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
      <div style={{ display:'flex', gap:4, padding:'8px 16px', width:'max-content' }}>
        {CAT_LINKS.map(cat => {
          const active = full === cat.to || full.startsWith(cat.to + '&') || full.startsWith(cat.to.split('?')[0] + '?cat=' + cat.to.split('cat=')[1])
          return (
            <Link
              key={cat.label}
              to={cat.to}
              style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:999, fontFamily:PP, fontWeight:600, fontSize:12, textDecoration:'none', whiteSpace:'nowrap', background: active ? C.primary : C.bg, color: active ? '#fff' : C.mid, border:`1.5px solid ${active ? C.primary : C.border}`, transition:'all .15s' }}
            >
              <span style={{ fontSize:14 }}>{cat.emoji}</span>
              {cat.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function AppShell() {
  const { pathname } = useLocation()
  const { isPWA, canInstall, promptInstall } = usePWA()
  const { isLoggedIn } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPage, setMenuPage] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)

  const isRoot = pathname === '/'
  const showLanding = isRoot && !isPWA && !isLoggedIn

  if (showLanding) {
    const MENU_ITEMS = [
      { id:'sobre',    label:'Sobre Latido' },
      { id:'faq',      label:'Preguntas frecuentes' },
      { id:'partners', label:'Para empresas y partners' },
      { id:'contacto', label:'Contacto' },
    ]
    const openPage = (id) => { setMenuPage(id); setMenuOpen(false) }
    return (
      <>
        <nav style={{ position:'sticky', top:0, zIndex:100, background:'rgba(255,255,255,0.97)', backdropFilter:'blur(10px)', borderBottom:`1px solid ${C.border}`, padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <img src="/favicon.svg" alt="Latido" style={{ width:30, height:30 }} />
            <span style={{ fontFamily:PP, fontWeight:800, fontSize:17, color:C.primary, letterSpacing:-0.5 }}>Latido</span>
          </div>
          {/* Right side */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button
              onClick={() => { setSearchOpen(o => !o); setMenuOpen(false) }}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', width:36, height:36, borderRadius:10, background: searchOpen ? C.primary : C.bg, border:'none', cursor:'pointer', fontSize:16, transition:'background .15s' }}
              aria-label="Buscar"
            >
              {searchOpen ? <span style={{ color:'#fff', fontSize:14, fontWeight:700 }}>✕</span> : '🔍'}
            </button>
            <a href="/auth" style={{ fontFamily:PP, fontWeight:700, fontSize:12, background:C.primary, color:'#fff', textDecoration:'none', borderRadius:11, padding:'8px 14px' }}>Entrar →</a>
            <button
              onClick={() => { setMenuOpen(o => !o); setSearchOpen(false); if (menuPage) setMenuPage(null) }}
              style={{ display:'flex', flexDirection:'column', gap:4, background:'none', border:'none', cursor:'pointer', padding:'6px', borderRadius:8 }}
              aria-label="Menú"
            >
              <span style={{ display:'block', width:20, height:2, background:C.text, borderRadius:2, transition:'all .2s', transform: menuOpen ? 'rotate(45deg) translate(4px,4px)' : 'none' }} />
              <span style={{ display:'block', width:20, height:2, background:C.text, borderRadius:2, opacity: menuOpen ? 0 : 1, transition:'all .2s' }} />
              <span style={{ display:'block', width:20, height:2, background:C.text, borderRadius:2, transition:'all .2s', transform: menuOpen ? 'rotate(-45deg) translate(4px,-4px)' : 'none' }} />
            </button>
          </div>
        </nav>
        {/* Search overlay */}
        {searchOpen && (
          <>
            <div
              onClick={() => setSearchOpen(false)}
              style={{ position:'fixed', inset:0, top:57, zIndex:96, background:'rgba(15,23,42,0.35)', backdropFilter:'blur(2px)' }}
            />
            <div style={{ position:'fixed', top:57, left:0, right:0, zIndex:97, background:'#fff', borderBottom:`1px solid ${C.border}`, padding:'14px 16px', boxShadow:'0 8px 32px rgba(15,23,42,0.12)' }}>
              <GlobalSearch size="lg" onClose={() => setSearchOpen(false)} />
            </div>
          </>
        )}
        {/* Hamburger dropdown */}
        {menuOpen && (
          <div style={{ position:'fixed', top:57, left:0, right:0, zIndex:99, background:'#fff', borderBottom:`1px solid ${C.border}`, boxShadow:'0 8px 24px rgba(0,0,0,0.08)', padding:'8px 0' }}>
            {MENU_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => openPage(item.id)}
                style={{ display:'block', width:'100%', background:'none', border:'none', borderBottom:`1px solid ${C.borderLight}`, fontFamily:PP, fontWeight:600, fontSize:14, color:C.text, padding:'13px 24px', textAlign:'left', cursor:'pointer' }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        <main style={{ background:'#fff' }}>
          <Suspense fallback={<AppLoading />}>
            <Landing
              onInstall={promptInstall || (() => alert('Para instalar: en el menú de tu navegador busca "Instalar app" o "Añadir a pantalla de inicio"'))}
              menuPage={menuPage}
              setMenuPage={setMenuPage}
            />
          </Suspense>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />
      <PushRegistrationSync />
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
            <Route path="/mensajes" element={<ProtectedRoute><Mensajes /></ProtectedRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />
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
      <PWAInstallBanner canInstall={canInstall} promptInstall={promptInstall} isPWA={isPWA} />
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
