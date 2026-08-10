import { useEffect, useRef, useState } from 'react'
import { Modal } from './UI'

const OUTPUT_SIZE = 640
const MIN_ZOOM = 1
const MAX_ZOOM = 3

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getImageGeometry(imageSize, zoom) {
  if (!imageSize?.width || !imageSize?.height) {
    return { width:1, height:1, maxX:0, maxY:0 }
  }

  const aspect = imageSize.width / imageSize.height
  const width = (aspect >= 1 ? aspect : 1) * zoom
  const height = (aspect >= 1 ? 1 : 1 / aspect) * zoom
  return {
    width,
    height,
    maxX:Math.max(0, (width - 1) / 2),
    maxY:Math.max(0, (height - 1) / 2),
  }
}

function constrainOffset(offset, imageSize, zoom) {
  const geometry = getImageGeometry(imageSize, zoom)
  return {
    x:clamp(offset.x, -geometry.maxX, geometry.maxX),
    y:clamp(offset.y, -geometry.maxY, geometry.maxY),
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

async function createCroppedAvatar(image, sourceName, zoom, offset) {
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo preparar el recorte')

  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  const baseScale = Math.max(OUTPUT_SIZE / sourceWidth, OUTPUT_SIZE / sourceHeight)
  const drawWidth = sourceWidth * baseScale * zoom
  const drawHeight = sourceHeight * baseScale * zoom
  const centerX = OUTPUT_SIZE / 2 + offset.x * OUTPUT_SIZE
  const centerY = OUTPUT_SIZE / 2 + offset.y * OUTPUT_SIZE

  context.fillStyle = '#F1F5F9'
  context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    image,
    centerX - drawWidth / 2,
    centerY - drawHeight / 2,
    drawWidth,
    drawHeight,
  )

  let blob = await canvasToBlob(canvas, 'image/webp', 0.9)
  let extension = 'webp'
  if (!blob) {
    blob = await canvasToBlob(canvas, 'image/jpeg', 0.92)
    extension = 'jpg'
  }
  canvas.width = 1
  canvas.height = 1
  if (!blob) throw new Error('No se pudo guardar el recorte')

  const baseName = String(sourceName || 'avatar').replace(/\.[^.]+$/, '') || 'avatar'
  return new File([blob], `${baseName}-perfil.${extension}`, {
    type:blob.type || `image/${extension === 'jpg' ? 'jpeg' : extension}`,
    lastModified:Date.now(),
  })
}

export default function CreatorAvatarEditor({ show=false, source='', sourceName='', saving=false, onCancel, onSave }) {
  const viewportRef = useRef(null)
  const imageRef = useRef(null)
  const dragRef = useRef(null)
  const [imageSize, setImageSize] = useState(null)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState({ x:0, y:0 })
  const [rendering, setRendering] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    setImageSize(null)
    setZoom(MIN_ZOOM)
    setOffset({ x:0, y:0 })
    setRendering(false)
    setLoadError(false)
  }, [source])

  const geometry = getImageGeometry(imageSize, zoom)
  const busy = saving || rendering

  const updateZoom = nextZoom => {
    const normalizedZoom = clamp(Number(nextZoom) || MIN_ZOOM, MIN_ZOOM, MAX_ZOOM)
    setZoom(normalizedZoom)
    setOffset(current => constrainOffset(current, imageSize, normalizedZoom))
  }

  const startDrag = event => {
    if (!imageSize || busy) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = {
      pointerId:event.pointerId,
      clientX:event.clientX,
      clientY:event.clientY,
      offset,
    }
  }

  const moveDrag = event => {
    const drag = dragRef.current
    const viewport = viewportRef.current
    if (!drag || drag.pointerId !== event.pointerId || !viewport) return
    const rect = viewport.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const nextOffset = {
      x:drag.offset.x + (event.clientX - drag.clientX) / rect.width,
      y:drag.offset.y + (event.clientY - drag.clientY) / rect.height,
    }
    setOffset(constrainOffset(nextOffset, imageSize, zoom))
  }

  const stopDrag = event => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    dragRef.current = null
  }

  const confirmCrop = async () => {
    if (!imageRef.current || !imageSize || busy) return
    setRendering(true)
    try {
      const croppedFile = await createCroppedAvatar(imageRef.current, sourceName, zoom, offset)
      await onSave?.(croppedFile)
    } finally {
      setRendering(false)
    }
  }

  return (
    <Modal show={show} onClose={busy ? () => {} : onCancel} title="Ajustar foto de perfil" syncHistory={false} zIndex={1300}>
      <div className="creator-avatar-editor">
        <p>Mueve la foto para centrarla y usa el control para ajustar el tamaño.</p>
        <div
          ref={viewportRef}
          className={`creator-avatar-editor__viewport${dragRef.current ? ' is-dragging' : ''}`}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          aria-label="Vista previa circular de la foto"
        >
          {source && (
            <img
              ref={imageRef}
              src={source}
              alt=""
              draggable="false"
              onLoad={event => {
                const image = event.currentTarget
                setImageSize({ width:image.naturalWidth, height:image.naturalHeight })
                setLoadError(false)
              }}
              onError={() => setLoadError(true)}
              style={{
                width:`${geometry.width * 100}%`,
                height:`${geometry.height * 100}%`,
                left:`${50 + offset.x * 100}%`,
                top:`${50 + offset.y * 100}%`,
              }}
            />
          )}
          {loadError && <span>No se pudo mostrar esta foto.</span>}
        </div>

        <div className="creator-avatar-editor__zoom">
          <button type="button" onClick={() => updateZoom(zoom - 0.1)} disabled={busy || zoom <= MIN_ZOOM} aria-label="Reducir foto">−</button>
          <label>
            <span>Zoom</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step="0.01"
              value={zoom}
              onChange={event => updateZoom(event.target.value)}
              disabled={busy || !imageSize}
            />
          </label>
          <button type="button" onClick={() => updateZoom(zoom + 0.1)} disabled={busy || zoom >= MAX_ZOOM} aria-label="Ampliar foto">+</button>
        </div>

        <button
          type="button"
          className="creator-avatar-editor__reset"
          onClick={() => {
            setZoom(MIN_ZOOM)
            setOffset({ x:0, y:0 })
          }}
          disabled={busy}
        >
          Restablecer encuadre
        </button>

        <div className="creator-avatar-editor__actions">
          <button type="button" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button type="button" className="is-primary" onClick={confirmCrop} disabled={busy || !imageSize || loadError}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
