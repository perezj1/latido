import toast from 'react-hot-toast'

const style={fontFamily:'Poppins, sans-serif',fontSize:'14px',fontWeight:600,lineHeight:1.45,color:'#0F1A2B',background:'#FFFFFF',borderRadius:'18px',padding:'12px 16px',maxWidth:'min(390px, calc(100vw - 24px))',boxShadow:'0 8px 24px #0F1A2B26'}
export function notify(message,{error=false}={}){
 const text=typeof message==='string'?message:message?.message
 if(!text||message?.notified)return
 if(message&&typeof message==='object')message.notified=true
 return toast(text,{id:error?'suizamente-action-error':'suizamente-action-notice',duration:error?4500:3500,icon:error?'!':'✓',style:{...style,border:'2px solid '+(error?'#D51D29':'#03AA98')},ariaProps:{role:error?'alert':'status','aria-live':error?'assertive':'polite'}})
}
