import {supabase} from './supabase'

// Re-encode locally: a small square JPEG, with source metadata discarded.
export async function prepareProfilePhoto(file){
 if(!file?.type.startsWith('image/'))throw new Error('Elige una foto de tu galería.')
 if(file.size>10*1024*1024)throw new Error('Elige una foto de menos de 10 MB.')
 const url=URL.createObjectURL(file),image=new Image()
 try{
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('No se puede abrir esta foto. Prueba con JPG, PNG o WebP.'));image.src=url})
  const side=Math.min(image.naturalWidth,image.naturalHeight),canvas=document.createElement('canvas')
  if(!side)throw new Error('No se puede abrir esta foto.')
  canvas.width=canvas.height=512
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('No se puede preparar la foto.')
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,512,512)
  ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,512,512)
  for(const quality of [.85,.7,.5]){const data=canvas.toDataURL('image/jpeg',quality);if(data.length<240000)return data}
  throw new Error('La foto es demasiado grande. Prueba con otra.')
 }finally{URL.revokeObjectURL(url)}
}
export async function uploadProfilePhoto(image,userId){
 const file=userId+'/'+crypto.randomUUID()+'.jpg',blob=await(await fetch(image)).blob()
 const {error}=await supabase.storage.from('suizamente-avatars').upload(file,blob,{contentType:'image/jpeg',cacheControl:'31536000',upsert:false})
 if(error)throw new Error('No se pudo guardar la foto. Inténtalo otra vez.')
 return supabase.storage.from('suizamente-avatars').getPublicUrl(file).data.publicUrl
}
