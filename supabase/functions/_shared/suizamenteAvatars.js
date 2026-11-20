const caches=new WeakMap()
const userId=/^user:([a-f0-9-]{36})$/i
const safePhoto=value=>{
  if(typeof value!=='string'||value.length>2048)return null
  if(/^\/(?!\/)/.test(value)&&!/[\\\u0000-\u001f]/.test(value))return value
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null}catch{return null}
}

// Adds only public image URLs to identities already permitted by the RPC.
// Auth metadata and email addresses never become part of the response.
export async function enrichSuizamenteAvatars(data,client,currentUser) {
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
  try{const result=await client.from('profiles').select('id,avatar_url').in('id',[...profiles.keys()]);rows=result.data||[]}catch{/* Keep avatars available if the photo lookup fails. */}
  const photos=new Map(rows.map(row=>[row.id,safePhoto(row.avatar_url)]))
  let cache=caches.get(client);if(!cache){cache=new Map();caches.set(client,cache)}
  const pending=[...profiles.keys()].filter(id=>!photos.get(id))
  let next=0
  await Promise.all(Array.from({length:Math.min(4,pending.length)},async()=>{
    while(next<pending.length){
      const id=pending[next++];let photo=null
      if(id===currentUser?.id)photo=safePhoto(currentUser.user_metadata?.avatar_url)||safePhoto(currentUser.user_metadata?.picture)
      else{
        let hit=cache.get(id)
        if(!hit||hit.expires<Date.now()){
          try{const result=await client.auth.admin.getUserById(id),meta=result.data?.user?.user_metadata;hit={photo:safePhoto(meta?.avatar_url)||safePhoto(meta?.picture),expires:Date.now()+60000}}
          catch{hit={photo:null,expires:Date.now()+15000}}
          if(cache.size>500)cache.clear()
          cache.set(id,hit)
        }
        photo=hit.photo
      }
      photos.set(id,photo)
    }
  }))
  for(const [id,items]of profiles)for(const profile of items)profile.avatarUrl=photos.get(id)||safePhoto(profile.avatarUrl)||null
  return data
}
