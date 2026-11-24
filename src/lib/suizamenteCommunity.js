import {supabase} from './supabase'

export const COMMUNITY_COUNTRIES = [
  ['AR','Argentina'],['BO','Bolivia'],['BR','Brasil'],['CL','Chile'],['CO','Colombia'],
  ['CR','Costa Rica'],['CU','Cuba'],['EC','Ecuador'],['SV','El Salvador'],['ES','España'],
  ['GT','Guatemala'],['HN','Honduras'],['MX','México'],['NI','Nicaragua'],['PA','Panamá'],
  ['PY','Paraguay'],['PE','Perú'],['DO','República Dominicana'],['CH','Suiza'],['UY','Uruguay'],
  ['VE','Venezuela'],['OTHER','Otro país'],
]
export const COMMUNITY_YEARS = [['under_1','Menos de 1 año'],['1_3','1–3 años'],['4_9','4–9 años'],['10_plus','10 años o más']]
export const countryFlag = code => /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map(c=>127397+c.charCodeAt(0))) : '🌍'

export async function communityCall(action,args={}) {
  const {data,error}=await supabase.rpc('suizamente_community',{p_action:action,p_args:args})
  if(error)throw new Error(action==='profile'?'No se han podido guardar tus datos de comunidad. Inténtalo de nuevo.':'No se pudieron cargar las respuestas de la comunidad.')
  return data
}
