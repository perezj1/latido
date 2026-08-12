import { C, PP } from '../lib/theme'
import { Icon } from '../lib/icons'

export default function FavoriteButton({ isFav, onClick, label='', icon='', style={} }) {
  return (
    <button
      type="button"
      onClick={event => {
        event.stopPropagation()
        onClick?.()
      }}
      style={{
        width:36,
        height:36,
        borderRadius:'50%',
        border:'none',
        background:'rgba(255,255,255,0.96)',
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        fontFamily:PP,
        fontSize:20,
        cursor:'pointer',
        boxShadow:'0 8px 18px rgba(15,23,42,0.14)',
        lineHeight:1,
        color:C.text,
        ...style,
      }}
      aria-label={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      title={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
    >
      <span aria-hidden="true" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
        {icon || <Icon name={isFav ? 'favoriteActive' : 'favorite'} size={20} color={isFav ? '#E11D48' : C.text} />}
      </span>
      {label && <span>{label}</span>}
    </button>
  )
}
