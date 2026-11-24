import {useLayoutEffect} from 'react'

// Fit the reference layout to the available viewport without changing quiz state.
export function useQuestionLayout(rootRef,scrollRef,active,contentKey){
  useLayoutEffect(()=>{
    const root=rootRef.current,scroll=scrollRef.current
    if(!active||!root||!scroll)return undefined
    let live=true,frame=0
    const explanationOverflow=()=>{
      const explanation=root.querySelector('.sg-feedback-explanation')
      if(explanation)explanation.dataset.more=String(explanation.scrollHeight-explanation.clientHeight-explanation.scrollTop>2)
    }
    const fit=()=>{
      frame=0
      if(!live)return
      root.dataset.fit='0'
      for(let step=1;step<=4&&scroll.scrollHeight>scroll.clientHeight+2;step++)root.dataset.fit=String(step)
      explanationOverflow()
    }
    const schedule=()=>{if(live&&!frame)frame=requestAnimationFrame(fit)}
    fit()
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(schedule)
    for(const element of [root,scroll,scroll.firstElementChild,root.querySelector('.sg-game-footer')])if(element)observer?.observe(element)
    window.addEventListener('resize',schedule)
    window.visualViewport?.addEventListener('resize',schedule)
    root.addEventListener('toggle',schedule,true)
    root.addEventListener('scroll',explanationOverflow,true)
    document.fonts?.ready.then(schedule)
    return()=>{
      live=false;cancelAnimationFrame(frame);observer?.disconnect()
      window.removeEventListener('resize',schedule)
      window.visualViewport?.removeEventListener('resize',schedule)
      root.removeEventListener('toggle',schedule,true)
      root.removeEventListener('scroll',explanationOverflow,true)
      delete root.dataset.fit
    }
  },[rootRef,scrollRef,active,contentKey])
}
