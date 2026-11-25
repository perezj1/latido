// Device preferences only. Profile metadata (photo, onboarding, hints...) stays
// in the server-owned player record, never in another account's local settings.
const defaults={musica:true,sonidos:true,vibracion:true,menosAnimaciones:false,apariencia:'clara'}
const record=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{}
function boolean(value,fallback){
 if(typeof value==='boolean')return value
 if(value===1||value==='true'||value==='on')return true
 if(value===0||value==='false'||value==='off')return false
 return fallback
}
export function normalizeSzSettings(value,fallback={}){
 const source=record(value),previous=record(fallback),settings={...defaults}
 for(const key of ['musica','sonidos','vibracion','menosAnimaciones'])settings[key]=boolean(source[key],boolean(previous[key],defaults[key]))
 const notices=source.avisos??previous.avisos
 if(typeof notices==='boolean')settings.avisos={turnos:notices}
 else if(notices&&typeof notices==='object'&&!Array.isArray(notices)){
  settings.avisos=Object.fromEntries(Object.entries(notices).flatMap(([key,value])=>{const enabled=boolean(value,undefined);return enabled===undefined?[]:[[key,enabled]]}))
 }
 return settings
}
