// Draw the sticker directly: WebKit can omit embedded QR images when an SVG
// foreignObject is rasterized. Use the visible layout and the decoded QR PNG.
export async function businessStickerImage(node) {
  await document.fonts.ready
  const qr = node.querySelector('img.lc-qr')
  if (!qr) throw new Error('QR pendiente')
  await qr.decode()
  const box = node.getBoundingClientRect()
  if (!box.width || !box.height) throw new Error('Material no visible')
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(box.width * 3)
  canvas.height = Math.ceil(box.height * 3)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Imagen no disponible')
  ctx.scale(3, 3)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, box.width, box.height)
  const style = getComputedStyle(node)
  const border = parseFloat(style.borderTopWidth)
  ctx.strokeStyle = style.borderTopColor
  ctx.lineWidth = border
  ctx.beginPath()
  ctx.roundRect(
    border / 2,
    border / 2,
    box.width - border,
    box.height - border,
    parseFloat(style.borderTopLeftRadius)
  )
  ctx.stroke()
  for (const element of node.querySelectorAll('strong, h3')) {
    const bounds = element.getBoundingClientRect()
    const textStyle = getComputedStyle(element)
    ctx.font = `${textStyle.fontWeight} ${textStyle.fontSize} ${textStyle.fontFamily}`
    ctx.fillStyle = textStyle.color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lines = []
    let line = ''
    for (const word of element.textContent.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word
      if (line && ctx.measureText(candidate).width > bounds.width + 0.5) {
        lines.push(line)
        line = word
      } else line = candidate
    }
    if (line) lines.push(line)
    const lineHeight = parseFloat(textStyle.lineHeight) || parseFloat(textStyle.fontSize) * 1.2
    const top = bounds.top - box.top + (bounds.height - lines.length * lineHeight) / 2
    lines.forEach((text, index) =>
      ctx.fillText(
        text,
        bounds.left - box.left + bounds.width / 2,
        top + (index + 0.5) * lineHeight
      )
    )
  }
  const qrBox = qr.getBoundingClientRect()
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(qr, qrBox.left - box.left, qrBox.top - box.top, qrBox.width, qrBox.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Imagen pendiente'))),
      'image/png'
    )
  })
}
