// Decode and re-encode locally to resize the photo and discard source metadata.
export async function prepararFoto(file){
  if(!file||!file.type.startsWith('image/'))throw new Error('Elige una foto de tu galería.')
  if(file.size>10*1024*1024)throw new Error('Elige una foto de menos de 10 MB.')
  const url=URL.createObjectURL(file),image=new Image()
  try{
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('No se puede abrir esta foto. Prueba con JPG, PNG o WebP.'));image.src=url})
    const side=Math.min(image.naturalWidth,image.naturalHeight)
    if(!side)throw new Error('No se puede abrir esta foto.')
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('No se puede preparar la foto.')
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,512,512)
    ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,512,512)
    for(const quality of [.85,.7,.5]){const data=canvas.toDataURL('image/jpeg',quality);if(data.length<240000)return data}
    throw new Error('La foto es demasiado grande. Prueba con otra.')
  }finally{URL.revokeObjectURL(url)}
}

export async function guardarFoto(image,{socialApi,token}){
  if(!token)throw new Error('Entra con tu cuenta para elegir tu foto.')
  const response=await fetch(socialApi+'/photo',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({image}),signal:AbortSignal.timeout(30000)})
  const data=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(data.error||'No se ha podido guardar la foto. Vuelve a intentarlo.')
  return data
}
