import { Heart, Share2 } from 'lucide-react'
import FavoriteButton from './FavoriteButton'
import ShareButton from './ShareButton'
import { C } from '../lib/theme'

const actionStyle = {
  width:40,
  height:40,
  flexShrink:0,
  border:`1px solid ${C.border}`,
  background:'rgba(255,255,255,0.96)',
  color:C.text,
  boxShadow:'0 1px 4px rgba(15,23,42,0.2)',
}

export default function DetailHeaderActions({ share, isFav, onToggleFavorite }) {
  return (
    <>
      <ShareButton {...share} icon={<Share2 size={20} />} style={actionStyle} />
      <FavoriteButton
        isFav={isFav}
        onClick={onToggleFavorite}
        icon={<Heart size={21} fill={isFav ? 'currentColor' : 'none'} />}
        style={{ ...actionStyle, color:isFav ? C.primary : C.text }}
      />
    </>
  )
}
