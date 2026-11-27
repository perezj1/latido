// Load the supplied script unchanged, only while decoration is enabled.
import * as Three from 'three'
let pending
export function loadDecorations(){
 if(window.Decoraciones3D)return Promise.resolve(window.Decoraciones3D)
 if(!pending)pending=new Promise((resolve,reject)=>{window.THREE=Three;const script=document.createElement('script');script.src='/suizamente-assets/decoraciones3d.js';script.onload=()=>resolve(window.Decoraciones3D);script.onerror=()=>{pending=null;script.remove();reject(new Error('No se pudieron cargar las decoraciones'))};document.head.append(script)})
 return pending
}
