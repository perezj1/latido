import React,{lazy,Suspense} from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter,Navigate,Route,Routes,useLocation,useSearchParams} from 'react-router-dom'
import {Toaster} from 'react-hot-toast'
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/poppins/latin-800.css'
import {AuthProvider,useAuth} from './src/hooks/useAuth'
import './src/styles/tokens.css'
import './standalone.css'

const Game=lazy(()=>import('./src/components/suizamente/v2/SuizamenteApp'))
const Auth=lazy(()=>import('./src/pages/Auth'))
const ResetPassword=lazy(()=>import('./src/pages/ResetPassword'))
function Loading(){return <div className="standalone-loading" role="status">Cargando Suizamente…</div>}
function nextPath(search){const value=new URLSearchParams(search).get('next')||sessionStorage.getItem('suizamente:auth-destino');return /^\/suizamente(?:\/|\?|$)/.test(value||'')?value:'/suizamente'}
function Account(){const {authUser,loading}=useAuth(),{search}=useLocation();return loading?<Loading/>:authUser?<Navigate replace to={nextPath(search)}/>:<Auth/>}
function Return(){const [params]=useSearchParams();return <Navigate replace to={nextPath('?next='+encodeURIComponent(params.get('next')||'/suizamente'))}/>}
function ExternalLegal({path}){React.useEffect(()=>location.replace('https://www.latido.ch'+path),[path]);return <Loading/>}
function App(){return <AuthProvider><BrowserRouter><Suspense fallback={<Loading/>}><Routes>
 <Route path="/suizamente/*" element={<Game/>}/>
 <Route path="/auth" element={<Account/>}/><Route path="/cuenta" element={<Account/>}/>
 <Route path="/auth/callback" element={<Account/>}/><Route path="/auth/onboarding" element={<Return/>}/>
 <Route path="/reset-password" element={<ResetPassword/>}/><Route path="/auth/restablecer" element={<ResetPassword/>}/>
 <Route path="/terminos" element={<ExternalLegal path="/terminos"/>}/><Route path="/privacidad" element={<ExternalLegal path="/privacidad"/>}/>
 <Route path="*" element={<Navigate replace to="/suizamente"/>}/>
 </Routes></Suspense><Toaster position="top-center"/></BrowserRouter></AuthProvider>}
createRoot(document.getElementById('root')).render(<App/>)
if('serviceWorker'in navigator&&import.meta.env.PROD)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').then(r=>r.update()).catch(()=>{}))
