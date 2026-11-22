import {isSuizamentePath} from '../../../src/lib/suizamenteSessionBridge.js'
const key='suizamente:destino-conquista'
export function rememberConquistaRoute(storage,path){
 if(/^\/conquista(?:\/|\?|$)/.test(path)&&isSuizamentePath(path))try{storage.setItem(key,path)}catch{/* Optional session storage. */}
}
export function takeConquistaRoute(storage){
 try{const path=storage.getItem(key);storage.removeItem(key);return path&&path.startsWith('/conquista')&&isSuizamentePath(path)?path:'/'}catch{return '/'}
}
