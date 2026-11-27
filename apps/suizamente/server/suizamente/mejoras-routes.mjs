// Only new endpoints. Legacy routes and operations retain their original mapping.
export function mejoraRoute(method,route){
 const routes={
  'GET mejoras/resumen':'resumen','GET mejoras/minuto':'minuto/inicio','POST mejoras/minuto':'minuto/empezar',
  'GET mejoras/espejo':'espejo/inicio','POST mejoras/espejo':'espejo/crear','POST mejoras/espejo/aceptar':'espejo/aceptar',
  'GET mejoras/misterio':'misterio/hoy','POST mejoras/misterio/pista':'misterio/pista','POST mejoras/misterio/respuesta':'misterio/respuesta',
  'GET mejoras/misterio/avisos':'misterio/avisos','PUT mejoras/misterio/avisos':'misterio/avisos_guardar',
  'GET mejoras/decorar':'decorar/inicio','POST mejoras/decorar/poner':'decorar/poner','POST mejoras/decorar/quitar':'decorar/quitar','POST mejoras/decorar/visto':'decorar/visto',
  'POST mejoras/decorar/momento':'decorar/momento',
  'GET mejoras/decorar/amigo':'decorar/visitar','PUT mejoras/decorar/gusto':'decorar/gustar',
  'GET mejoras/avisos':'avisos/inicio','PUT mejoras/avisos':'avisos/guardar',
  'PUT mejoras/libreta':'libreta/guardar',
 }
 const action=routes[method+' '+route];if(action)return {action,args:{}}
 const m=route.match(/^mejoras\/(minuto|espejo)\/([0-9a-f-]{36})(?:\/(respuesta|terminar|retar|empezar|revancha))?$/i)
 if(m&&(method==='GET'&&!m[3]||method==='POST'&&({minuto:['respuesta','terminar','retar'],espejo:['respuesta','empezar','revancha']})[m[1]].includes(m[3])))return {action:m[1]+'/'+(m[3]||'ver'),args:{id:m[2]}}
 return null
}
