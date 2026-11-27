import {Link} from 'react-router-dom'
import {IconText,Icono} from './Icono'
import {Avatar} from './Shared'
import {timeLeft} from '../../../lib/suizamenteV2'

export function HomeBadge({to,onClick,label,image,tint,chip,name,alert,green,disabled}){
 const props={className:'sv-home-access','aria-label':label,style:{'--access-tint':tint}}
 const content=<><span className="sv-home-access-icon" aria-hidden="true">{image}</span>{alert&&<i aria-hidden="true">{alert}</i>}<span className={'sv-home-access-chip'+(green?' green':'')} aria-hidden="true"><IconText>{chip}</IconText></span><span className="sv-home-access-name" aria-hidden="true">{name}</span></>
 return to?<Link {...props} to={to}>{content}</Link>:<button {...props} onClick={onClick} disabled={disabled}>{content}</button>
}
export function HomeRow({label,children}){
 return <div className="sv-home-list" role="list" aria-label={label}>{children}</div>
}
export function HomeAction({to,onClick,icon,children,label,subtitle}){
 const props={className:'sv-home-action '+icon,'aria-label':label}
 const content=<><span className="sv-home-action-icon" aria-hidden="true"><Icono nombre={icon} size={24}/></span><span className="sv-home-row-text"><b>{children}</b><span>{subtitle}</span></span><span className="sv-home-chevron" aria-hidden="true">›</span></>
 return <div role="listitem">{to?<Link {...props} to={to}>{content}</Link>:<button type="button" {...props} onClick={onClick}>{content}</button>}</div>
}
export function HomeMatch({match:m,mine,sealText}){
 const left=timeLeft(m.plazo,Date.parse(m.servidorAhora)),name=m.rival?.apodo||'Buscando rival…'
 return <div role="listitem"><Link className={'sv-home-match '+(mine?'sv-home-turn':'sv-home-wait')} to={'/suizamente/partida/'+m.id} aria-label={mine?'Te toca contra '+name+', '+m.tusSellos.length+' a '+m.susSellos.length+'. '+sealText+'. Quedan '+left+'. Jugar':m.rival?'Turno de '+name+', '+m.tusSellos.length+' a '+m.susSellos.length+'. Le quedan '+left:'Partida pendiente: buscando rival'}>
  <span className="sv-home-rival"><Avatar id={m.rival?.id} name={m.rival?.apodo||'?'} color={m.rival?.color}/>{m.rival?.online&&<i aria-label="En línea"/>}</span>
  <span className="sv-home-row-text"><b className="sv-home-match-heading"><span>{name}</span><span className="sv-home-score">{m.tusSellos.length} – {m.susSellos.length}</span></b><span>{mine?<><strong>Tu turno</strong> · quedan {left}</>:m.rival?'Su turno · te avisamos':'Buscando rival…'}</span></span>
  {mine?<span className="sv-home-play" aria-hidden="true">▶︎</span>:<span className="sv-home-time" aria-hidden="true"><Icono nombre="tiempo" size={14}/>{left}</span>}
 </Link></div>
}
