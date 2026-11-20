const userId=/^user:([a-f0-9-]{36})$/i
const safePhoto=value=>{
  if(typeof value!=='string'||value.length>2048)return null
  if(/^\/(?!\/)/.test(value)&&!/[\\\u0000-\u001f]/.test(value))return value
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null}catch{return null}
}

// Match Latido's public profile cards: use the saved profile photo, never an
// automatically generated provider image. The client supplies Latido's fallback.
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
  for(const [id,items]of profiles)for(const profile of items)profile.avatarUrl=photos.get(id)||null
  return data
}
