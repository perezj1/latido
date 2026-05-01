import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { AD_CATS, CANTONS, normalizeAdCat } from '../lib/constants'
import { Btn, ProgressBar, Input, Select, ImageUploadField } from '../components/UI'
import { getStorageErrorMessage, uploadPublicationImage, uploadPublicationImages } from '../lib/storage'
import { insertWithOptionalColumnsFallback, isLikelySchemaMismatchError } from '../lib/supabaseCompat'
import toast from 'react-hot-toast'

const STEPS = [
  { title:'¿Qué publicas?',      sub:'Elige qué haces y en qué categoría' },
  { title:'Cuéntanos más',       sub:'Añade título y descripción — cuanto más detallado, mejor' },
  { title:'Foto, precio y zona', sub:'Último paso — ya casi está' },
]

const PUBLISH_INTENTS = [
  {
    id:'busca',
    emoji:'🔍',
    title:'Busco / necesito',
    desc:'Necesitas vivienda, ayuda, cuidados, un servicio o algún artículo',
  },
  {
    id:'ofrece_vende',
    emoji:'🏷️',
    title:'Ofrezco / vendo',
    desc:'Ofreces servicios, vivienda, cuidados, ayuda con trámites o vendes algo',
  },
  {
    id:'regala',
    emoji:'🎁',
    title:'Regalo',
    desc:'Das algo gratis para que otra persona lo aproveche',
  },
]

const TYPE_DESC_BY_CAT = {
  vivienda: {
    busca:  'Buscas piso, habitación o compañero de piso',
    ofrece: 'Ofreces un piso, habitación o sublet',
  },
  venta: {
    busca:  'Buscas algo para comprar',
    vende:  'Quieres vender algo',
    regala: 'Das algo gratis sin pedir nada a cambio',
  },
  cuidados: {
    busca:  'Necesitas un cuidador, niñera o asistente',
    ofrece: 'Ofreces servicios de cuidado o asistencia',
  },
  documentos: {
    busca:  'Necesitas ayuda con trámites, cartas o traducciones',
    ofrece: 'Puedes ayudar con gestiones y asesoría',
  },
  servicios: {
    busca:  'Buscas limpieza, mudanza, reparaciones, clases u otro servicio',
    ofrece: 'Ofreces servicios para el hogar o habilidades profesionales',
  },
}

const PRICE_UNITS = [
  { id:'hora', label:'Por hora' },
  { id:'dia', label:'Por día' },
  { id:'mes', label:'Por mes' },
  { id:'once', label:'Total' },
]

const OPTIONAL_AD_INSERT_COLUMNS = ['price_amount', 'price_unit', 'contact_via_app', 'contact_phone', 'contact_email', 'photo_urls']
const MULTI_PHOTO_CATS = new Set(['vivienda', 'venta'])

function resolveTypeForCategory(intent, catId) {
  if (intent === 'ofrece_vende') return catId === 'venta' ? 'vende' : 'ofrece'
  return intent || ''
}

function getCompatibleCategories(intent) {
  const compatibleTypes = intent === 'ofrece_vende'
    ? ['ofrece', 'vende']
    : intent
      ? [intent]
      : []

  return AD_CATS.filter(cat => (
    cat.id !== 'empleo'
    && (!compatibleTypes.length || compatibleTypes.some(type => cat.types?.includes(type)))
  ))
}

function getTitlePlaceholder(intent, catId) {
  if (intent === 'busca') return 'Ej: Busco habitación en Zürich / Necesito mudanza'
  if (intent === 'ofrece_vende' && catId === 'venta') return 'Ej: Vendo iPhone 13 en buen estado'
  if (intent === 'ofrece_vende') return 'Ej: Ofrezco limpieza de pisos / Habitación disponible'
  if (intent === 'regala') return 'Ej: Regalo sofá en Bern'
  return 'Ej: Busco habitación en Zürich / Ofrezco limpieza de pisos'
}

function supportsMultiplePhotos(cat) {
  return MULTI_PHOTO_CATS.has(cat)
}

function uniqueUrls(urls) {
  return Array.from(new Set((urls || []).filter(Boolean)))
}

export default function Publicar() {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetCat = normalizeAdCat(searchParams.get('cat') || '')
  const presetHandledRef = useRef(false)

  const [step, setStep] = useState(0)
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [step])
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [done, setDone] = useState(false)

  const [form, setForm] = useState({
    intent:'',
    cat:'',
    sub:'',
    type:'',
    title:'',
    desc:'',
    img_url:'',
    photo_urls:[],
    priceValue:'',
    priceUnit:'hora',
    canton:'',
    plz:'',
    privacy:'public',
  })

  const s = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const selectedCat = AD_CATS.find(c => c.id === form.cat)
  const selectedIntent = PUBLISH_INTENTS.find(intent => intent.id === form.intent)
  const compatibleCats = getCompatibleCategories(form.intent)

  const selectIntent = (intent) => {
    const nextCats = getCompatibleCategories(intent)
    setForm(prev => {
      const catStillFits = nextCats.some(cat => cat.id === prev.cat)
      const nextCat = catStillFits ? prev.cat : (nextCats.length === 1 ? nextCats[0].id : '')
      return {
        ...prev,
        intent,
        type: resolveTypeForCategory(intent, nextCat),
        cat: nextCat,
        sub: catStillFits ? prev.sub : '',
      }
    })
    // Don't advance step — categories appear below on same screen
  }

  const selectCategory = (catId) => {
    setForm(prev => ({
      ...prev,
      cat: catId,
      type: resolveTypeForCategory(prev.intent, catId),
      sub: '',
    }))
    setStep(1)
  }

  useEffect(() => {
    if (presetHandledRef.current) return

    presetHandledRef.current = true

    if (!presetCat) return

    if (presetCat === 'empleo') {
      navigate('/publicar-empleo', { replace:true })
      return
    }

    if (!AD_CATS.some(cat => cat.id === presetCat)) return

    setForm(prev => ({ ...prev, cat:presetCat }))
  }, [navigate, presetCat])

  const getFormattedPrice = () => {
    const value = String(form.priceValue || '').trim()
    if (!value) return ''

    if (form.priceUnit === 'once') return `CHF ${value} total`
    if (form.priceUnit === 'hora') return `CHF ${value} / hora`
    if (form.priceUnit === 'dia') return `CHF ${value} / día`
    if (form.priceUnit === 'mes') return `CHF ${value} / mes`

    return `CHF ${value}`
  }

  if (!isLoggedIn) {
    return (
      <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
        <div style={{ fontSize:52, marginBottom:16 }}>🔐</div>
        <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:10 }}>
          Necesitas una cuenta
        </h1>
        <p style={{ fontFamily:PP, fontSize:13, color:C.mid, marginBottom:24, lineHeight:1.7 }}>
          Para publicar anuncios necesitas registrarte. Es gratis, rápido y sin spam.
        </p>
        <Btn onClick={() => navigate('/auth')}>Crear cuenta gratis</Btn>
        <button
          onClick={() => navigate('/auth')}
          style={{
            fontFamily:PP,
            fontWeight:600,
            fontSize:13,
            color:C.primary,
            background:'none',
            border:`1.5px solid ${C.primaryMid}`,
            borderRadius:14,
            padding:'12px 0',
            width:'100%',
            cursor:'pointer',
            marginTop:10
          }}
        >
          Ya tengo cuenta — iniciar sesión
        </button>
      </div>
    )
  }

  if (done) {
    return (
      <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
        <div
          style={{
            width:80,
            height:80,
            background:C.successLight,
            borderRadius:24,
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            fontSize:42,
            margin:'0 auto 20px'
          }}
        >
          ✅
        </div>

        <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:24, color:C.text, marginBottom:10 }}>
          ¡Anuncio publicado!
        </h1>

        <p style={{ fontFamily:PP, fontSize:13, color:C.mid, lineHeight:1.7, marginBottom:8 }}>
          Tu anuncio ya está visible en el tablón.
        </p>

        <div
          style={{
            background:C.successLight,
            border:`1px solid ${C.successMid}`,
            borderRadius:14,
            padding:'12px 16px',
            marginBottom:24
          }}
        >
          <p style={{ fontFamily:PP, fontSize:12, fontWeight:600, color:'#065F46', margin:0 }}>
            🌐 Tu anuncio es público. El contacto con los interesados es siempre dentro de Latido.
          </p>
        </div>

        <Btn onClick={() => navigate(form.cat ? `/tablon?cat=${encodeURIComponent(form.cat)}` : '/tablon')}>Ver en el tablón →</Btn>

        <button
          onClick={() => {
            setDone(false)
            setStep(0)
            setForm({
              intent:'',
              cat:'',
              sub:'',
              type:'',
              title:'',
              desc:'',
              img_url:'',
              photo_urls:[],
              priceValue:'',
              priceUnit:'hora',
              canton:'',
              plz:'',
              privacy:'public',
            })
          }}
          style={{
            fontFamily:PP,
            fontWeight:600,
            fontSize:12,
            color:C.mid,
            background:'none',
            border:'none',
            cursor:'pointer',
            width:'100%',
            marginTop:12,
            padding:'6px 0'
          }}
        >
          Publicar otro anuncio
        </button>
      </div>
    )
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error('Escribe un título para el anuncio')
      return
    }

    if (!form.canton) {
      toast.error('Selecciona tu cantón')
      return
    }

    setLoading(true)

    try {
      const finalPrice = getFormattedPrice() || null
      const resolvedType = form.type || resolveTypeForCategory(form.intent, form.cat)
      const priceAmount = form.priceValue
        ? Number(String(form.priceValue).replace(',', '.'))
        : null
      const { data: ownProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user?.id)
        .maybeSingle()

      const photoUrls = uniqueUrls([
        form.img_url,
        ...(supportsMultiplePhotos(form.cat) ? form.photo_urls : []),
      ])

      const payload = {
        cat: form.cat,
        sub: form.sub,
        type: resolvedType,
        title: form.title,
        desc: form.desc,
        img_url: photoUrls[0] || null,
        photo_urls: supportsMultiplePhotos(form.cat) && photoUrls.length > 0 ? photoUrls : null,
        price: finalPrice,
        price_amount: Number.isNaN(priceAmount) ? null : priceAmount,
        price_unit: form.priceValue ? form.priceUnit : null,
        canton: form.canton,
        plz: form.plz || null,
        privacy: form.privacy,
        contact_via_app: true,
        contact_phone: null,
        contact_email: null,
        user_id: user?.id,
        active: true,
        user_name: ownProfile?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuario',
      }

      const { error, strippedColumns } = await insertWithOptionalColumnsFallback({
        table: 'listings',
        payload,
        optionalColumns: OPTIONAL_AD_INSERT_COLUMNS,
      })

      if (error) throw error
      if (strippedColumns?.includes('photo_urls') && photoUrls.length > 1) {
        toast.error('El anuncio se publicó, pero algunas fotos extra no se pudieron guardar.')
      }

      setDone(true)
    } catch (error) {
      console.error('Publish ad failed:', error)
      if (isLikelySchemaMismatchError(error, 'ads')) {
        toast.error('No pudimos publicar el anuncio ahora. Inténtalo de nuevo más tarde.')
      } else {
        toast.error(error?.message || 'No se pudo publicar el anuncio')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async files => {
    if (!files?.length) return

    setUploadingImage(true)

    try {
      if (supportsMultiplePhotos(form.cat)) {
        const uploadedUrls = await uploadPublicationImages({
          files,
          userId: user?.id,
          folder:'ads'
        })

        setForm(prev => {
          const nextUrls = uniqueUrls([...prev.photo_urls, ...uploadedUrls])
          return {
            ...prev,
            img_url: prev.img_url || nextUrls[0] || '',
            photo_urls: nextUrls,
          }
        })
        toast.success(`${uploadedUrls.length} foto(s) añadida(s)`)
      } else {
        const publicUrl = await uploadPublicationImage({
          file:files[0],
          userId: user?.id,
          folder:'ads'
        })
        setForm(prev => ({ ...prev, img_url:publicUrl, photo_urls:[publicUrl] }))
        toast.success('Imagen subida')
      }
    } catch (error) {
      toast.error(getStorageErrorMessage(error))
    } finally {
      setUploadingImage(false)
    }
  }

  return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'32px 24px 100px' }}>
      <ProgressBar step={step} total={STEPS.length} />

      <h1 style={{ fontFamily:PP, fontWeight:800, fontSize:22, color:C.text, marginBottom:4, letterSpacing:-0.3 }}>
        {STEPS[step].title}
      </h1>
      <p style={{ fontFamily:PP, fontSize:12, color:C.light, marginBottom:24 }}>
        {STEPS[step].sub}
      </p>

      {/* Step 0 — Intención + Categoría */}
      {step === 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {PUBLISH_INTENTS.map(intent => (
              <button
                key={intent.id}
                onClick={() => selectIntent(intent.id)}
                style={{
                  background:form.intent === intent.id ? C.primaryLight : '#fff',
                  border:`2px solid ${form.intent === intent.id ? C.primary : C.border}`,
                  borderRadius:14, padding:'14px 16px',
                  display:'flex', gap:12, alignItems:'center',
                  cursor:'pointer', textAlign:'left', transition:'all .15s'
                }}
              >
                <span style={{ fontSize:26 }}>{intent.emoji}</span>
                <div>
                  <p style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:form.intent === intent.id ? C.primary : C.text, marginBottom:2 }}>
                    {intent.title}
                  </p>
                  <p style={{ fontFamily:PP, fontSize:11, color:C.light, lineHeight:1.5, margin:0 }}>
                    {intent.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {form.intent && (
            <div>
              <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:10 }}>
                ELIGE LA CATEGORÍA
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {compatibleCats.map(cat => {
                  const categoryType = resolveTypeForCategory(form.intent, cat.id)
                  return (
                    <button
                      key={cat.id}
                      onClick={() => selectCategory(cat.id)}
                      style={{
                        background:form.cat === cat.id ? C.primary : '#fff',
                        borderRadius:14, padding:'14px 16px',
                        display:'flex', alignItems:'center', gap:14,
                        border:`2px solid ${form.cat === cat.id ? C.primary : C.border}`,
                        cursor:'pointer', textAlign:'left', transition:'all .15s'
                      }}
                    >
                      <span style={{ fontSize:26, width:32, flex:'0 0 32px', textAlign:'center' }}>{cat.emoji}</span>
                      <div style={{ minWidth:0 }}>
                        <p style={{ fontFamily:PP, fontWeight:700, fontSize:14, color:form.cat === cat.id ? '#fff' : C.text, margin:'0 0 2px' }}>
                          {cat.label}
                        </p>
                        <p style={{ fontFamily:PP, fontSize:11, color:form.cat === cat.id ? 'rgba(255,255,255,0.78)' : C.light, margin:0, lineHeight:1.4 }}>
                          {TYPE_DESC_BY_CAT[cat.id]?.[categoryType] ?? cat.desc}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 1 — Título + descripción + subcategoría opcional */}
      {step === 1 && (
        <>
          {selectedCat?.sub?.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:1, marginBottom:8 }}>
                SUBCATEGORÍA (OPCIONAL)
              </p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {selectedCat.sub.map(sb => (
                  <button
                    key={sb}
                    onClick={() => s('sub', form.sub === sb ? '' : sb)}
                    style={{
                      fontFamily:PP, fontSize:11, fontWeight:600,
                      padding:'6px 14px', borderRadius:20, cursor:'pointer',
                      border:`1.5px solid ${form.sub === sb ? C.primary : C.border}`,
                      background:form.sub === sb ? C.primary : '#fff',
                      color:form.sub === sb ? '#fff' : C.mid,
                    }}
                  >
                    {sb}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Input
            label="Título del anuncio *"
            placeholder={getTitlePlaceholder(form.intent, form.cat)}
            required
            value={form.title}
            onChange={e => s('title', e.target.value)}
          />
          <Input
            label="Descripción"
            placeholder="Cuéntanos con detalle qué buscas, ofreces, vendes o regalas. Cuánta más info, mejor respuesta recibirás."
            rows={5}
            value={form.desc}
            onChange={e => s('desc', e.target.value)}
          />
        </>
      )}

      {/* Step 2 — Foto + precio inline + zona + resumen */}
      {step === 2 && (
        <>
          <ImageUploadField
            label="Imagen del anuncio (opcional)"
            previewUrl={form.img_url}
            previewUrls={supportsMultiplePhotos(form.cat) ? form.photo_urls : []}
            uploading={uploadingImage}
            multiple={supportsMultiplePhotos(form.cat)}
            onFilesSelected={handleImageUpload}
            onRemove={() => setForm(prev => ({ ...prev, img_url:'', photo_urls:[] }))}
            onRemoveAt={index => setForm(prev => {
              const removedUrl = prev.photo_urls[index]
              const nextUrls = prev.photo_urls.filter((_, i) => i !== index)
              return { ...prev, img_url: prev.img_url === removedUrl ? nextUrls[0] || '' : prev.img_url, photo_urls: nextUrls }
            })}
            hint={supportsMultiplePhotos(form.cat)
              ? 'Puedes añadir varias fotos para mostrar mejor el piso, habitación o producto.'
              : 'Ideal para pisos, productos o servicios. En móvil puedes tomar la foto al momento.'}
          />

          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontFamily:PP, fontSize:12, fontWeight:700, color:C.text, marginBottom:8 }}>
              Precio (opcional)
            </label>
            <div style={{ display:'flex', gap:8, alignItems:'stretch' }}>
              <div style={{ display:'flex', border:`1.5px solid ${C.border}`, borderRadius:14, overflow:'hidden', flex:1, background:'#fff' }}>
                <div style={{ padding:'13px 14px', background:C.primaryLight, color:C.primary, fontWeight:800, fontSize:12, whiteSpace:'nowrap', display:'flex', alignItems:'center' }}>
                  CHF
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ej: 30"
                  value={form.priceValue}
                  onChange={e => s('priceValue', e.target.value.replace(/[^0-9.,]/g, ''))}
                  style={{ flex:1, border:'none', outline:'none', background:'transparent', padding:'13px 14px', fontFamily:PP, fontSize:13, color:C.text }}
                />
              </div>
              <select
                value={form.priceUnit}
                onChange={e => s('priceUnit', e.target.value)}
                style={{ border:`1.5px solid ${C.border}`, borderRadius:14, padding:'0 12px', fontFamily:PP, fontSize:12, color:C.text, background:'#fff', cursor:'pointer', minWidth:90 }}
              >
                {PRICE_UNITS.map(unit => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
              </select>
            </div>
            {form.priceValue && (
              <p style={{ fontFamily:PP, fontSize:11, color:C.primary, margin:'8px 0 0', background:C.primaryLight, padding:'8px 12px', borderRadius:10 }}>
                Se mostrará como: <strong>{getFormattedPrice()}</strong>
              </p>
            )}
          </div>

          <div className="grid-2" style={{ gap:10 }}>
            <Select label="Cantón *" required value={form.canton} onChange={e => s('canton', e.target.value)}>
              <option value="">Seleccionar...</option>
              {CANTONS.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </Select>
            <Input
              label="Código postal (PLZ)"
              placeholder="8001"
              value={form.plz}
              onChange={e => s('plz', e.target.value)}
              style={{ maxLength:4 }}
            />
          </div>

          {/* Resumen antes de publicar */}
          <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:16, padding:'16px', marginBottom:4 }}>
            <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.light, letterSpacing:0.5, marginBottom:12 }}>
              RESUMEN DEL ANUNCIO
            </p>
            <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
              {selectedCat && <span style={{ fontSize:32, flexShrink:0 }}>{selectedCat.emoji}</span>}
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontFamily:PP, fontWeight:800, fontSize:15, color:C.text, margin:'0 0 6px' }}>{form.title}</p>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:4 }}>
                  {selectedCat && (
                    <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:C.primaryLight, color:C.primary }}>
                      {selectedCat.label}
                    </span>
                  )}
                  {form.sub && (
                    <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:C.primaryLight, color:C.primary }}>
                      {form.sub}
                    </span>
                  )}
                  {form.canton && (
                    <span style={{ fontFamily:PP, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:C.primaryLight, color:C.primary }}>
                      📍 {form.canton}{form.plz ? ` ${form.plz}` : ''}
                    </span>
                  )}
                </div>
                {getFormattedPrice() && (
                  <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.primary, margin:0 }}>{getFormattedPrice()}</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div style={{ display:'flex', gap:10, marginTop:24 }}>
        {step > 0 && (
          <Btn onClick={() => setStep(s => s - 1)} variant="secondary" style={{ flex:'0 0 100px' }}>← Atrás</Btn>
        )}
        {step === 0 ? null
          : step === 1 ? (
            <Btn onClick={() => {
              if (!form.title.trim()) { toast.error('Escribe un título para el anuncio'); return }
              setStep(2)
            }} style={{ flex:1 }}>
              Continuar →
            </Btn>
          ) : (
            <Btn onClick={handleSubmit} disabled={loading} variant="success" style={{ flex:1 }}>
              {loading ? '⏳ Publicando...' : '✅ Publicar anuncio'}
            </Btn>
          )
        }
      </div>

      <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center', marginTop:12 }}>
        Gratuito · Se publica al instante · Puedes eliminarlo desde tu perfil
      </p>
    </div>
  )
}
