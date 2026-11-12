import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chromium, webkit } from '@playwright/test'

const port = 5242
const origin = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  env:{ ...process.env, VITE_SUPABASE_URL:`${origin}/security-test-api`, VITE_SUPABASE_ANON_KEY:'test-key' },
  stdio:'pipe', windowsHide:true,
})
let logs = ''
server.stdout.on('data', data => { logs += data })
server.stderr.on('data', data => { logs += data })
let browser
try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(origin)).ok) break } catch {}
    if (i >= 100) throw new Error(`Vite failed to start: ${logs}`)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  for (const [name, engine] of [['Chromium', chromium], ['WebKit', webkit]]) {
    browser = await engine.launch({ headless:true })
    const page = await browser.newPage()
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.origin !== origin) return route.abort()
      if (url.pathname === '/__upload-security-test') return route.fulfill({ contentType:'text/html', body:'<!doctype html><meta charset="utf-8"><title>Upload privacy test</title>' })
      return route.continue()
    })
    await page.goto(`${origin}/__upload-security-test`)
    const result = await page.evaluate(async () => {
      const { uploadAvatar, uploadPublicationImage } = await import('/src/lib/storage.js')
      const { supabase } = await import('/src/lib/supabase.js')
      const uploads = []
      supabase.storage.from = bucket => ({
        upload:async (path, file, options) => { uploads.push({ bucket, path, file, options }); return {} },
        getPublicUrl:path => ({ data:{ publicUrl:`https://storage.test/${bucket}/${path}` } }),
      })
      const canvas = document.createElement('canvas')
      canvas.width = 40; canvas.height = 20
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = 'red'; ctx.fillRect(0, 0, 20, 20)
      ctx.fillStyle = 'blue'; ctx.fillRect(20, 0, 20, 20)
      const jpeg = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95))
      // Valid EXIF orientation=6 (90 degrees clockwise) plus a private marker.
      const exif = new Uint8Array(64)
      exif.set([0x45,0x78,0x69,0x66,0,0,0x49,0x49,0x2a,0,8,0,0,0,1,0])
      exif.set([0x12,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0], 16)
      exif.set(new TextEncoder().encode('PRIVATE_GPS_47.37_8.54'), 32)
      const bytes = new Uint8Array(await jpeg.arrayBuffer())
      const length = exif.length + 2
      const photo = new File([bytes.slice(0, 2), new Uint8Array([0xff,0xe1,length >> 8,length & 255]), exif, bytes.slice(2)], 'photo.jpg', { type:'image/jpeg' })
      const load = async file => {
        const url = URL.createObjectURL(file)
        const image = new Image()
        try { image.src = url; await image.decode(); return image } finally { URL.revokeObjectURL(url) }
      }
      const original = await load(photo)
      await uploadAvatar({ file:photo, userId:'test-user' })
      const publicationUrl = await uploadPublicationImage({ file:photo, userId:'test-user', folder:'ads' })
      const photos = await Promise.all(uploads.map(async upload => {
        const image = await load(upload.file)
        const output = new Uint8Array(await upload.file.arrayBuffer())
        const text = new TextDecoder('latin1').decode(output)
        const sample = document.createElement('canvas')
        sample.width = image.naturalWidth; sample.height = image.naturalHeight
        const context = sample.getContext('2d')
        context.drawImage(image, 0, 0)
        return {
          bucket:upload.bucket, path:upload.path, type:upload.file.type,
          contentType:upload.options.contentType, size:upload.file.size,
          width:image.naturalWidth, height:image.naturalHeight,
          hasMetadata:text.includes('Exif') || text.includes('PRIVATE_GPS'),
          top:Array.from(context.getImageData(10, 5, 1, 1).data),
          bottom:Array.from(context.getImageData(10, 35, 1, 1).data),
        }
      }))
      // PNG/WebP small sources must also go through the same privacy pipeline.
      for (const type of ['image/png', 'image/webp']) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, type))
        if (blob.type !== type) continue
        const start = uploads.length
        await uploadAvatar({ file:new File([blob], `small.${type.split('/')[1]}`, { type }), userId:'test-user' })
        if (uploads.length !== start + 1 || uploads.at(-1).file === blob) throw new Error('Raster upload failed')
        const image = await load(uploads.at(-1).file)
        if (image.naturalWidth !== 40 || image.naturalHeight !== 20) throw new Error('Raster dimensions changed')
      }
      return { original:[original.naturalWidth, original.naturalHeight], photos, publicationUrl }
    })
    assert.deepEqual(result.original, [20, 40], `${name}: EXIF fixture is interpreted correctly`)
    assert.equal(result.photos.length, 3, `${name}: avatar, detail and thumbnail all upload`)
    for (const photo of result.photos) {
      assert.equal(photo.hasMetadata, false, `${name}: metadata removed from ${photo.path}`)
      assert.deepEqual([photo.width, photo.height], result.original, `${name}: orientation and dimensions preserved`)
      assert.equal(photo.type, photo.contentType)
      assert.ok(['image/webp', 'image/jpeg'].includes(photo.type))
      assert.ok(photo.top[0] > 200 && photo.top[2] < 60, `${name}: red remains at top`)
      assert.ok(photo.bottom[2] > 200 && photo.bottom[0] < 60, `${name}: blue remains at bottom`)
    }
    assert.match(result.publicationUrl, /-detail\.(webp|jpg)$/)
    assert.match(result.photos[2].path, /-thumb\.(webp|jpg)$/)
    await page.goto(`${origin}/privacidad`)
    await page.getByRole('heading', { name:'2. Datos que recopilamos', exact:true }).waitFor()
    assert.ok(await page.getByText('es seudónima, no anónima', { exact:false }).count())
    console.log(`${name}: photo metadata removal, orientation, colors, avatar/detail/thumbnail uploads, PNG/WebP and privacy page passed.`)
    await browser.close(); browser = null
  }
} finally {
  if (browser) await browser.close()
  server.kill()
}
