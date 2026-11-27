export async function copyInvitationText(text){
 if(navigator.clipboard){await navigator.clipboard.writeText(text);return}
 const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;left:-10000px;top:0';document.body.append(area);area.select()
 try{if(!document.execCommand('copy'))throw new Error('Selecciona y copia el enlace de invitación.')}finally{area.remove()}
}
