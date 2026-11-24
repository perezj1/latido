import {useEffect,useId,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {cleanShareText} from './shareData'
import './share.css'

export function ShareImage({makeData,apodo,onClose,title='Compartir mi Suiza'}){
  const [includeName,setIncludeName]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false)
  const canvas=useRef(null),dialog=useRef(null),prepared=useRef(null),titleId=useId(),hintId=useId()
  useEffect(()=>{
    const previous=document.activeElement,host=dialog.current.parentElement,siblings=[...document.body.children].filter(el=>el!==host),inert=siblings.map(el=>el.inert),overflow=document.body.style.overflow
    siblings.forEach(el=>{el.inert=true});document.body.style.overflow='hidden';dialog.current.focus()
    return()=>{siblings.forEach((el,i)=>{el.inert=inert[i]});document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus()}
  },[])
  useEffect(()=>{
    let active=true;prepared.current=null;setReady(false);setError('')
    ;(async()=>{const data=await makeData(includeName),engine=await import('./story');if(!active)return;const draft=document.createElement('canvas');await engine.dibujar(draft,data);if(!active)return;canvas.current.width=draft.width;canvas.current.height=draft.height;canvas.current.getContext('2d').drawImage(draft,0,0);const blob=await new Promise(resolve=>draft.toBlob(resolve,'image/png'));if(!blob)throw Error('No se pudo crear la imagen');if(active){prepared.current={data,blob,engine};setReady(true)}})().catch(e=>{if(active)setError(e.message)})
    return()=>{active=false}
  },[makeData,includeName])
  async function run(save){
    if(!ready||busy)return
    setBusy(true);setNotice('');setError('')
    try{const {data,blob,engine}=prepared.current;if(save){engine.descargar(blob,'mi-suiza.png');setNotice('Imagen guardada')}else{const result=await engine.compartir(data,'mi-suiza.png',blob);if(result==='descargada')setNotice('Imagen guardada')}}catch(e){if(e.name!=='AbortError')setError(e.message)}finally{setBusy(false)}
  }
  function keydown(e){
    e.stopPropagation()
    if(e.key==='Escape'){e.preventDefault();onClose()}
    if(e.key==='Tab'){const buttons=[...dialog.current.querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
  }
  return createPortal(<div className="sv-image-share-host"><section className="sv-image-share" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={dialog} onKeyDown={keydown}><div className="sv-image-panel"><header><button aria-label="Volver al mapa" onClick={onClose}>←</button><h1 id={titleId}>{title}</h1></header><div className="sv-image-preview"><canvas ref={canvas} width="1080" height="1920" role="img" aria-label="Vista previa de la imagen"/></div><button className="sv-image-name" role="switch" aria-checked={includeName} aria-label="Poner mi apodo" aria-describedby={hintId} onClick={()=>{setReady(false);prepared.current=null;setIncludeName(n=>!n)}}><span><b>🙂 Poner mi apodo</b><small id={hintId}>{includeName?'Saldrá «'+cleanShareText(apodo)+'» en la imagen':'Si no, tu nombre no aparece'}</small></span><i aria-hidden="true"><span/></i></button><p className="sv-image-private">La imagen se crea en tu móvil, con el enlace a Suizamente.</p>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}<footer><button disabled={!ready||busy} onClick={()=>run(false)}>📤 Compartir</button><button disabled={!ready||busy} onClick={()=>run(true)}>⬇️ Guardar la imagen</button></footer></div></section></div>,document.body)
}
