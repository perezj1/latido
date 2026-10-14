import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/poppins/latin-800.css'
import ScannerApp from './ScannerApp'

document.body.style.margin = '0'
document.body.style.background = '#f8faff'
createRoot(document.getElementById('root')).render(<ScannerApp />)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/scanner/sw.js', { scope: '/scanner/', updateViaCache: 'none' })
    .catch(() => {})
}
