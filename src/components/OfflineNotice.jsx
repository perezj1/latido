import { useEffect, useState } from 'react'
import { C, PP } from '../lib/theme'

export default function OfflineNotice() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      style={{
        position:'fixed',
        top:'calc(12px + env(safe-area-inset-top))',
        left:'50%',
        zIndex:1200,
        transform:'translateX(-50%)',
        width:'max-content',
        maxWidth:'calc(100vw - 32px)',
        padding:'9px 14px',
        border:`1px solid ${C.border}`,
        borderRadius:999,
        background:'rgba(255,255,255,0.96)',
        color:C.mid,
        boxShadow:'0 8px 28px rgba(15,23,42,0.16)',
        fontFamily:PP,
        fontSize:11,
        fontWeight:700,
        textAlign:'center',
        backdropFilter:'blur(12px)',
      }}
    >
      Sin conexión · mostrando contenido guardado
    </div>
  )
}
