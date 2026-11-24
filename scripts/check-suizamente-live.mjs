import assert from 'node:assert/strict'
const origin=process.argv[2]||'https://www.latido.ch'
let cookie
async function api(path){
 const r=await fetch(origin+'/api/suizamente/'+path,{headers:cookie?{Cookie:cookie}:{},redirect:'follow',signal:AbortSignal.timeout(30000)})
 if(!cookie&&r.headers.get('set-cookie')){cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly/i);assert.match(r.headers.get('set-cookie'),/Secure/i)}
 assert.match(r.headers.get('content-type')||'',/application\/json/,'API returns JSON, not the SPA or Vercel login')
 return {status:r.status,data:await r.json()}
}
const config=await api('config');assert.equal(config.status,200);assert.equal(config.data.apiVersion,13)
const capabilities=await api('capacidades');assert.equal(capabilities.status,200);assert.equal(capabilities.data.admin,false)
const admin=await api('admin/resumen');assert.equal(admin.status,403)
const player=await api('jugador');assert.equal(player.status,200);assert.equal(player.data.jugador,null)
for(const path of ['/suizamente','/suizamente/nueva','/suizamente/mapa']){
 const r=await fetch(origin+path,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);assert.match(r.headers.get('content-type')||'',/text\/html/)
}
const manifestResponse=await fetch(origin+'/suizamente.webmanifest');assert.equal(manifestResponse.status,200)
const manifest=await manifestResponse.json();assert.equal(manifest.id,'/suizamente');assert.equal(manifest.background_color,'#FFFFFF')
for(const icon of manifest.icons){const r=await fetch(origin+icon.src);assert.equal(r.status,200);assert.match(r.headers.get('content-type')||'',/image\/png/)}
const model=await fetch(origin+'/suizamente-assets/mapa3d.json');assert.equal(model.status,200);assert.ok(Object.keys((await model.json()).cantones).length>=26)
console.log('Producción comprobada:',origin+'/suizamente')
console.log('API v13; permisos 403; sesión invitada segura sin crear perfil; rutas, manifiesto, iconos y geometría 3D correctos.')
