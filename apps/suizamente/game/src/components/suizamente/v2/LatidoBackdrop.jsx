import {DECO,ESCENA} from './latidoBackdropAssets'

export function LatidoBackdrop({tint,deco=false,scene=true}){
 return <div className="sv-latido-backdrop" data-latido-backdrop aria-hidden="true" style={{position:'absolute',inset:0,zIndex:-1,overflow:'hidden',pointerEvents:'none',background:tint?'radial-gradient(130% 50% at 50% 0%, '+tint+' 0%, #FBF9F6 72%)':'#FBF9F6'}} dangerouslySetInnerHTML={{__html:(deco?DECO:'')+(scene?ESCENA.replace('<svg ','<svg class="sv-backdrop-scene" '):'')}}/>
}
