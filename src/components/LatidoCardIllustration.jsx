import { Store } from 'lucide-react'
import './LatidoCardIllustration.css'

export default function LatidoCardIllustration({ business = false }) {
  return (
    <div className="lc-intro-illustration" aria-hidden="true">
      <div className="lc-intro-plastic-card">
        <div className="lc-intro-plastic-brand">
          <img src="/favicon.svg" alt="" />
          <div>
            <strong>Latido</strong>
            <span>{business ? 'Para negocios' : 'Tarjeta de socio'}</span>
          </div>
        </div>
        <div className="lc-intro-plastic-lines">
          <span />
          <span />
        </div>
        <div className="lc-intro-plastic-stripe" />
      </div>
      <div className="lc-intro-orbits">
        <span>%</span>
        <span>
          <Store size={24} strokeWidth={2.2} />
        </span>
      </div>
    </div>
  )
}
