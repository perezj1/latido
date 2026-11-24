import {useLayoutEffect,useId,useRef,useState} from 'react'
import {IMG} from './questionArt'

const TILE_SIZE=5,REVEAL_DURATION=20000

// A playful reveal, never a speed test: the solution and XP stay on the server.
// Screen readers get the same complete visual description from the SVG at once.
export default function QuestionImage({imageKey,answered=false}){
  const id=useId().replaceAll(':',''),[revealed,setRevealed]=useState(false),canvasRef=useRef(null)
  useLayoutEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)')
    if(answered||revealed||media.matches){setRevealed(true);return undefined}
    const canvas=canvasRef.current,context=canvas?.getContext('2d')
    if(!context){setRevealed(true);return undefined}
    let tiles=[],cleared=0,frame,progress=0
    const start=performance.now()
    const clearTiles=()=>{
      const target=Math.floor(tiles.length*progress)
      while(cleared<target){
        const [x,y]=tiles[cleared++]
        context.clearRect(x,y,TILE_SIZE,TILE_SIZE)
      }
    }
    const resize=()=>{
      const {width,height}=canvas.getBoundingClientRect(),scale=window.devicePixelRatio||1
      canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale)
      context.setTransform(scale,0,0,scale,0,0)
      context.fillStyle='#e2e8f0';context.fillRect(0,0,width,height)
      tiles=[]
      for(let y=0;y<height;y+=TILE_SIZE)for(let x=0;x<width;x+=TILE_SIZE)tiles.push([x,y])
      // Small scattered openings, rather than large patches or visible rows.
      for(let i=tiles.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[tiles[i],tiles[j]]=[tiles[j],tiles[i]]}
      cleared=0;clearTiles()
    }
    resize()
    const observer=new ResizeObserver(resize)
    observer.observe(canvas)
    const tick=now=>{
      progress=Math.min(1,(now-start)/REVEAL_DURATION)
      clearTiles()
      if(progress===1)setRevealed(true)
      else frame=requestAnimationFrame(tick)
    }
    frame=requestAnimationFrame(tick)
    const motion=()=>{if(media.matches)setRevealed(true)}
    media.addEventListener('change',motion)
    return()=>{cancelAnimationFrame(frame);observer.disconnect();media.removeEventListener('change',motion)}
  },[imageKey,answered,revealed])
  if(!IMG[imageKey])return null
  const complete=answered||revealed
  return <div className="sg-image-challenge">
    <div className="sg-question-art">
      <div dangerouslySetInnerHTML={{__html:IMG[imageKey](id)}}/>
      {!complete&&<canvas ref={canvasRef} className="sg-image-tiles" aria-hidden="true"/>}
    </div>
    {!complete&&<div className="sg-image-hint"><span>¿Ya la reconoces? Sin prisa.</span><button type="button" onClick={()=>setRevealed(true)}>Ver imagen completa</button></div>}
  </div>
}
