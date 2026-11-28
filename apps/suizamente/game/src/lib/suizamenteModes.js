// Labels can render with the public configuration; personal counters arrive later.
export function initialModes(config){
 const flags=config?.mejoras||{},modes=[]
 if(flags.minuto?.activo)modes.push({id:'minuto',nombre:'El minuto suizo',linea:flags.minuto.segundos+' segundos para jugar',icono:'crono',to:'/suizamente/minuto'})
 if(flags.espejo?.activo)modes.push({id:'espejo',nombre:'Reto espejo',linea:'Las mismas preguntas, cuando quieras',icono:'espejo',to:'/suizamente/espejo'})
 if(flags.misterio?.activo&&flags.misterio.disponibleHoy)modes.push({id:'misterio',nombre:'El misterio del día',linea:'Nuevo · '+flags.misterio.pistas+' pistas',icono:'misterio',to:'/suizamente/misterio'})
 return modes
}
