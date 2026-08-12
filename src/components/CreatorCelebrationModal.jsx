import { Modal } from './UI'
import './CreatorCelebrationModal.css'
import { Icon } from '../lib/icons'

const CONFETTI_PIECES = [
  { left:'7%', color:'#2563EB', delay:'-.15s', duration:'2.4s', rotate:'18deg' },
  { left:'16%', color:'#F59E0B', delay:'-.8s', duration:'2.8s', rotate:'-24deg' },
  { left:'27%', color:'#EC4899', delay:'-.35s', duration:'2.6s', rotate:'42deg' },
  { left:'38%', color:'#10B981', delay:'-1.1s', duration:'3s', rotate:'-12deg' },
  { left:'49%', color:'#8B5CF6', delay:'-.55s', duration:'2.5s', rotate:'31deg' },
  { left:'60%', color:'#EF4444', delay:'-1.35s', duration:'2.9s', rotate:'-38deg' },
  { left:'71%', color:'#0EA5E9', delay:'-.25s', duration:'2.7s', rotate:'16deg' },
  { left:'82%', color:'#F97316', delay:'-.95s', duration:'2.45s', rotate:'-30deg' },
  { left:'91%', color:'#22C55E', delay:'-1.55s', duration:'3.1s', rotate:'45deg' },
]

export default function CreatorCelebrationModal({
  show,
  onClose,
  title,
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel = 'Cerrar',
}) {
  return (
    <Modal show={show} onClose={onClose} title={title} syncHistory={false} zIndex={620}>
      <div className="creator-celebration">
        <div className="creator-celebration__confetti" aria-hidden="true">
          {CONFETTI_PIECES.map((piece, index) => (
            <span
              key={index}
              style={{
                '--confetti-left':piece.left,
                '--confetti-color':piece.color,
                '--confetti-delay':piece.delay,
                '--confetti-duration':piece.duration,
                '--confetti-rotate':piece.rotate,
              }}
            />
          ))}
        </div>
        <div className="creator-celebration__icon" aria-hidden="true"><Icon name="success" size={32} /></div>
        <h2>¡Enhorabuena!</h2>
        <p>{message}</p>
        <div className="creator-celebration__actions">
          <button type="button" className="creator-celebration__primary" onClick={onPrimary}>
            {primaryLabel}
          </button>
          <button type="button" className="creator-celebration__secondary" onClick={onClose}>
            {secondaryLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
