const userId=/^user:([a-f0-9-]{36})$/i
const safePhoto=value=>{
  if(typeof value!=='string'||value.length>2048)return null
  if(/^\/(?!\/)/.test(value)&&!/[\\\u0000-\u001f]/.test(value))return value
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null}catch{return null}
}

// Prefer the photo chosen in Suizamente, then the saved Latido profile photo.
// Automatic provider images are excluded. The client supplies the initial.
export async function enrichSuizamenteAvatars(data,client) {
  const profiles=new Map()
  function visit(value){
    if(!value||typeof value!=='object')return
    if(typeof value.apodo==='string'){
      const id=userId.exec(value.id||'')?.[1]
      if(id){if(!profiles.has(id))profiles.set(id,[]);profiles.get(id).push(value)}
    }
    for(const item of Object.values(value))if(item&&typeof item==='object')visit(item)
  }
  visit(data)
  if(!profiles.size)return data
  let rows=[]
  try{const result=await client.from('profiles').select('id,avatar_url').in('id',[...profiles.keys()]);rows=result.data||[]}catch{/* Keep initial avatars available if photo lookup fails. */}
  const photos=new Map(rows.map(row=>[row.id,safePhoto(row.avatar_url)]))
  try{
    const own=await client.rpc('suizamente_social_fotos',{p_usuarios:[...profiles.keys()]})
    for(const row of own.data||[]){const photo=safePhoto(row.url);if(photo)photos.set(row.id,photo)}
  }catch{/* Existing Latido photos remain available during a backend update. */}
  for(const [id,items]of profiles)for(const profile of items)profile.avatarUrl=photos.get(id)||null
  return data
}
