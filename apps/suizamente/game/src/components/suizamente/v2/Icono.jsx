import {createContext,Fragment,useContext} from 'react'
import './icons.css'

// 23.22. Only call iconizar for interface text. Questions, facts and cards stay literal.
export const EMOJI_ICONO={'🪙':'moneda','🔥':'racha','⭐':'xp','🎁':'regalo','🃏':'sobre','🛡':'escudo','🎯':'misiones','📊':'pregunta','🏆':'trofeo','⏳':'tiempo','🗺':'mapa','🛒':'tienda','👥':'amigos','⚔':'duelo','🛂':'pasaporte','✂':'quita','🔁':'otra','⏭':'cambiar','⏱':'mas15','🔔':'aviso','📤':'compartir','🌿':'pradera','🌲':'bosque','🧊':'glaciar','🏔':'cumbre','🥇':'medalla-oro','💎':'medalla-cristal','🗣':'sello-idioma','🎭':'sello-cultura','🧀':'sello-comida','📄':'sello-papeles','🏠':'sello-casa','🚆':'sello-dia'}
const legacy=Object.fromEntries(Object.entries(EMOJI_ICONO).map(([emoji,name])=>[name,emoji])),enabledContext=createContext(true)
const tokens=new RegExp('('+Object.keys(EMOJI_ICONO).join('|')+')\uFE0F?','gu')
export function IconScope({enabled=true,children}){return <enabledContext.Provider value={enabled}>{children}</enabledContext.Provider>}
export function Icono({nombre,size,className='',...props}){
 const enabled=useContext(enabledContext),seal=nombre?.startsWith('sello-'),box=seal?64:48
 if(!enabled)return legacy[nombre?.replace(/-gris$/,'')]||''
 return <svg className={'sv-icono'+(seal?' sv-icono-sello':'')+(className?' '+className:'')} width={size||(seal?'1.3em':'1.2em')} height={size||(seal?'1.3em':'1.2em')} viewBox={'0 0 '+box+' '+box} {...props} aria-hidden="true" focusable="false"><use href={'/suizamente-assets/iconos/iconos.svg#sz-'+nombre}/></svg>
}
export function Sello({categoria,conseguido=false,...props}){const id=typeof categoria==='string'?categoria:categoria?.id;return id?<Icono nombre={'sello-'+id+(conseguido?'':'-gris')} {...props}/>:null}
export function iconizar(value){
 if(Array.isArray(value))return value.map((part,i)=><Fragment key={i}>{iconizar(part)}</Fragment>)
 if(typeof value!=='string')return value
 if(/^🏠\uFE0F?\s*(Volver al inicio|Inicio)$/.test(value))return value.replace(/^🏠\uFE0F?\s*/,'')
 const parts=[];let start=0
 for(const m of value.matchAll(tokens)){if(m.index>start)parts.push(value.slice(start,m.index));parts.push(<Icono key={m.index} nombre={EMOJI_ICONO[m[1]]}/>);start=m.index+m[0].length}
 if(!parts.length)return value
 if(start<value.length)parts.push(value.slice(start))
 return parts.length===1?parts[0]:<span className={"sv-icon-text"+(parts.length===2&&parts[0]?.type===Icono&&typeof parts[1]==="string"&&value.length<40?" sv-inline-value":"")}>{parts}</span>
}
export function IconText({children}){const enabled=useContext(enabledContext);return enabled?iconizar(children):children}
export function UiIcon({value,...props}){const name=EMOJI_ICONO[value?.replace?.(/\uFE0F/g,'')];return name?<Icono nombre={name} {...props}/>:value}
export const powerIcon=id=>({quita:'quita',otra:'otra',salta:'cambiar',tiempo:'mas15'}[id])
export const lapIcon=style=>/leyenda/.test(style?.marco)?'medalla-leyenda':/cristal/.test(style?.marco)?'medalla-cristal':/oro/.test(style?.marco)?'medalla-oro':'mapa'
