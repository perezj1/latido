import { PanelPartners } from './Landing'
import { Link } from 'react-router-dom'

export default function Colaboraciones() {
  return (
    <div style={{ background:'#fff', padding:'28px 16px 72px' }}>
      <style>{`
        .latido-partner-pricing-scroll {
          overflow: visible;
        }

        @media (max-width: 640px) {
          .latido-partner-benefits-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            margin-bottom: 30px !important;
          }
          .latido-partner-benefit-card {
            min-height: 158px !important;
            padding: 12px 10px !important;
            border-radius: 14px !important;
          }
          .latido-partner-benefit-icon {
            margin-bottom: 7px !important;
            font-size: 22px !important;
            line-height: 1 !important;
          }
          .latido-partner-benefit-title {
            margin-bottom: 5px !important;
            font-size: 11.5px !important;
            line-height: 1.22 !important;
          }
          .latido-partner-benefit-desc {
            display: -webkit-box !important;
            overflow: hidden !important;
            font-size: 10px !important;
            line-height: 1.42 !important;
            -webkit-box-orient: vertical !important;
            -webkit-line-clamp: 4 !important;
          }
          .latido-partner-pricing-scroll {
            margin: 0 -16px !important;
            padding: 0 16px 16px !important;
            overflow-x: auto !important;
            overscroll-behavior-x: contain !important;
            scroll-padding-left: 16px !important;
            scroll-snap-type: x mandatory !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .latido-partner-pricing-scroll::-webkit-scrollbar {
            display: none;
          }
          .latido-partner-pricing-track {
            display: flex !important;
            width: max-content !important;
            min-width: 0 !important;
            grid-template-columns: none !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .latido-partner-pricing-card {
            flex: 0 0 min(82vw, 320px) !important;
            width: min(82vw, 320px) !important;
            min-width: min(82vw, 320px) !important;
            min-height: 470px !important;
            scroll-snap-align: start !important;
            scroll-snap-stop: always !important;
          }
        }
      `}</style>
      <div style={{ maxWidth:860, margin:'0 auto', width:'100%' }}>
        <div style={{ border:'1px solid #BFDBFE', background:'#EFF6FF', borderRadius:18, padding:16, margin:'0 0 18px', display:'grid', gap:10 }}>
          <div>
            <p style={{ fontFamily:'Poppins, system-ui, sans-serif', fontWeight:900, fontSize:10, letterSpacing:0.9, color:'#2563EB', textTransform:'uppercase', margin:'0 0 6px' }}>
              Herramienta para temporeras
            </p>
            <h1 style={{ fontFamily:'Poppins, system-ui, sans-serif', fontWeight:900, fontSize:22, lineHeight:1.18, color:'#0F172A', margin:'0 0 8px' }}>
              Latido WorkCheck Construccion
            </h1>
            <p style={{ fontFamily:'Poppins, system-ui, sans-serif', fontSize:13, lineHeight:1.65, color:'#475569', margin:0 }}>
              Perfiles de trabajadores prefiltrados con experiencia real, seguridad, movilidad, disponibilidad y resumen listo para decidir si merece la pena llamar.
            </p>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <Link
              to="/workcheck-construccion"
              style={{ fontFamily:'Poppins, system-ui, sans-serif', fontWeight:800, fontSize:13, background:'#2563EB', color:'#fff', textDecoration:'none', borderRadius:14, padding:'12px 18px', display:'inline-flex', justifyContent:'center', alignItems:'center', width:'fit-content' }}
            >
              Formulario trabajador
            </Link>
            <Link
              to="/temporeras/aha-personal"
              style={{ fontFamily:'Poppins, system-ui, sans-serif', fontWeight:800, fontSize:13, background:'#fff', color:'#2563EB', border:'1.5px solid #BFDBFE', textDecoration:'none', borderRadius:14, padding:'12px 18px', display:'inline-flex', justifyContent:'center', alignItems:'center', width:'fit-content' }}
            >
              Pagina temporera
            </Link>
            <Link
              to="/portal-temporera/aha-personal"
              style={{ fontFamily:'Poppins, system-ui, sans-serif', fontWeight:800, fontSize:13, background:'#fff', color:'#2563EB', border:'1.5px solid #BFDBFE', textDecoration:'none', borderRadius:14, padding:'12px 18px', display:'inline-flex', justifyContent:'center', alignItems:'center', width:'fit-content' }}
            >
              Portal temporera
            </Link>
          </div>
        </div>
        <PanelPartners />
      </div>
    </div>
  )
}
