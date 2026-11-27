export function negocioRoute(method,route){
 if(method==='GET'&&route==='negocios')return {action:'inicio',args:{}}
 if(method==='GET'&&route==='negocios/ciudades')return {action:'postales',args:{}}
 if(method==='GET'&&route==='negocios/admin')return {action:'admin',args:{}}
 if(method==='POST'&&['alta','espera','plazas','pregunta','pregunta_responder'].some(a=>route==='negocios/'+a))return {action:route.slice(9),args:{}}
 const m=route.match(/^negocios\/([0-9a-f-]{36})(?:\/([a-z_]+))?$/i)
 if(!m)return null
 if(method==='GET'&&(!m[2]||m[2]==='panel'))return {action:m[2]||'ficha',args:{id:m[1]}}
 if(method==='POST'&&['editar','baja','plan','pregunta_guardar','aprobar','cambio','rechazar','pagada','pregunta_revisar','cambio_revisar','reportar','estadistica'].includes(m[2]))return {action:m[2],args:{id:m[1]}}
 return null
}
