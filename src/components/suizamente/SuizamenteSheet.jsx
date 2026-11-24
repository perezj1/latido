import {useEffect,useLayoutEffect,useId,useRef} from 'react'
import {createPortal} from 'react-dom'
import {useOverlayHistory} from '../../hooks/useOverlayHistory'

export default function SuizamenteSheet({show,onClose,title,children,className='',showClose=true,variant='sheet'}) {
  const panel=useRef(null),close=useRef(onClose),id=useId()
  useEffect(()=>{close.current=onClose},[onClose])
  useOverlayHistory(show,onClose)
  useLayoutEffect(()=>{
    if(!show)return undefined
    const previous=document.activeElement,overflow=document.body.style.overflow
    if(variant!=='card')document.body.style.overflow='hidden'
    panel.current?.focus()
    function key(e){
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close.current();return}
      if(e.key!=='Tab'||variant==='card')return
      const items=[...panel.current.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length)
      const first=items[0],last=items.at(-1)
      if(!first){e.preventDefault();return}
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===panel.current)){e.preventDefault();first.focus()}
    }
    document.addEventListener('keydown',key,true)
    return()=>{if(variant!=='card')document.body.style.overflow=overflow;document.removeEventListener('keydown',key,true);if(previous?.isConnected)previous.focus()}
  },[show,variant])
  if(!show)return null
  return createPortal(<div className={`sz-sheet-root${variant==='card'?' sg-stage-root':''}`} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className={`sz-sheet${className?` ${className}`:''}`} role="dialog" aria-modal={variant!=='card'} aria-labelledby={id} tabIndex={-1} ref={panel}>
      <span className="sz-sheet-grab" aria-hidden="true"/>
      <div className="sz-between"><h2 id={id} className="sz-h2">{title}</h2>{showClose&&<button type="button" className="sz-icon-button" onClick={onClose} aria-label="Cerrar">✕</button>}</div>
      {children}
    </section>
  </div>,document.body)
}
