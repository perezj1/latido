import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import { AD_CATS, AD_TYPES, CANTONS, normalizeAdCat } from '../lib/constants'
import { Btn, ProgressBar, Input, Select, ImageUploadField } from '../components/UI'
import { getStorageErrorMessage, uploadPublicationImage, uploadPublicationImages } from '../lib/storage'
import { insertWithOptionalColumnsFallback, isLikelySchemaMismatchError } from '../lib/supabaseCompat'
import toast from 'react-hot-toast'

const STEPS = [
  { title:'¿Qué quieres publicar?', sub:'Elige la categoría de tu anuncio' },
  { title:'¿Qué quieres hacer?', sub:'Elige si buscas, ofreces, vendes o regalas' },
  { title:'Título y descripción', sub:'Cuanto más detallado, mejor' },
  { title:'Precio, zona y publicación', sub:'Último paso — ubicación, visibilidad y mensajes dentro de Latido' },
]

const STEP1_BY_CAT = {
  vivienda:   { title:'¿Buscas u ofreces vivienda?',    sub:'Dinos si buscas o pones a disposición un piso o habitación' },
  venta:      { title:'¿Qué quieres hacer?',            sub:'Busca artículos, vende lo que no usas o dalo gratis' },
  cuidados:   { title:'¿Buscas u ofreces cuidados?',    sub:'Dinos si necesitas un cuidador o si ofreces tus servicios' },
  documentos: { title:'¿Necesitas ayuda con un trámite?', sub:'Cartas, traducciones, formularios y gestiones del día a día' },
  servicios:  { title:'¿Buscas u ofreces un servicio?', sub:'Limpieza, mudanzas, reparaciones, clases, peluquería y otros servicios' },
}

const TYPE_DESC_BY_CAT = {
  vivienda: {
    busca:  'Buscas piso, habitación o compañero de piso',
    ofrece: 'Ofreces un piso, habitación o sublet',
  },
  venta: {
    busca:  'Buscas algún artículo de segunda mano',
    vende:  'Quieres vender algo que ya no usas',
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
    setStep(current => (current === 0 ? 1 : current))
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
            background:form.privacy === 'private' ? C.warnLight : C.successLight,
            border:`1px solid ${form.privacy === 'private' ? C.warnMid : C.successMid}`,
            borderRadius:14,
            padding:'12px 16px',
            marginBottom:24
          }}
        >
          <p
            style={{
              fontFamily:PP,
              fontSize:12,
              fontWeight:600,
              color:form.privacy === 'private' ? '#92400E' : '#065F46',
              margin:0
            }}
          >
            {form.privacy === 'private'
              ? '🔒 Solo usuarios con cuenta pueden ver tu anuncio y escribirte dentro de Latido'
              : '🌐 Tu anuncio es público, pero el contacto sigue dentro de Latido'}
          </p>
        </div>

        <Btn onClick={() => navigate(form.cat ? `/tablon?cat=${encodeURIComponent(form.cat)}` : '/tablon')}>Ver en el tablón →</Btn>

        <button
          onClick={() => {
            setDone(false)
            setStep(0)
            setForm({
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
    if (!form.canton) {
      toast.error('Selecciona tu cantón')
      return
    }

    setLoading(true)

    try {
      const finalPrice = getFormattedPrice() || null
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
        type: form.type,
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

  const stepInfo = step === 1 && STEP1_BY_CAT[form.cat]
    ? STEP1_BY_CAT[form.cat]
    : STEPS[step]

  return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'32px 24px 100px' }}>
      <ProgressBar step={step} total={STEPS.length} />

      <h1
        style={{
          fontFamily:PP,
          fontWeight:800,
          fontSize:22,
          color:C.text,
          marginBottom:4,
          letterSpacing:-0.3
        }}
      >
        {stepInfo.title}
      </h1>

      <p style={{ fontFamily:PP, fontSize:12, color:C.light, marginBottom:24 }}>
        {stepInfo.sub}
      </p>

      {step === 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
          {AD_CATS.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                if (cat.id === 'empleo') {
                  navigate('/publicar-empleo')
                  return
                }
                setForm(f => ({ ...f, cat: cat.id, type: '', sub: '' }))
              }}
              style={{
                background:form.cat === cat.id ? C.primary : C.surface,
                borderRadius:16,
                padding:'18px 14px',
                display:'flex',
                flexDirection:'column',
                gap:7,
                border:`2px solid ${form.cat === cat.id ? C.primary : C.border}`,
                cursor:'pointer',
                textAlign:'left',
                transition:'all .15s'
              }}
            >
              <span style={{ fontSize:26 }}>{cat.emoji}</span>
              <span style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:form.cat === cat.id ? '#fff' : C.text }}>
                {cat.label}
              </span>
              {cat.desc && (
                <span style={{ fontFamily:PP, fontSize:10, fontWeight:400, color:form.cat === cat.id ? 'rgba(255,255,255,0.75)' : C.light, lineHeight:1.4 }}>
                  {cat.desc}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {AD_TYPES.filter(t => !selectedCat?.types || selectedCat.types.includes(t.id)).map(t => (
            <button
              key={t.id}
              onClick={() => s('type', t.id)}
              style={{
                background:form.type === t.id ? C.primaryLight : '#fff',
                border:`1.5px solid ${form.type === t.id ? C.primary : C.border}`,
                borderRadius:14,
                padding:'14px 16px',
                cursor:'pointer',
                display:'flex',
                gap:12,
                alignItems:'center',
                textAlign:'left',
                transition:'all .15s'
              }}
            >
              <span style={{ fontSize:26 }}>{t.emoji}</span>
              <div>
                <p
                  style={{
                    fontFamily:PP,
                    fontWeight:700,
                    fontSize:14,
                    color:form.type === t.id ? C.primary : C.text,
                    marginBottom:2
                  }}
                >
                  {t.label}
                </p>
                <p style={{ fontFamily:PP, fontSize:11, color:C.light }}>{TYPE_DESC_BY_CAT[form.cat]?.[t.id] ?? t.desc}</p>
              </div>
            </button>
          ))}

          {selectedCat?.sub?.length > 0 && (
            <div style={{ marginTop:8 }}>
              <p
                style={{
                  fontFamily:PP,
                  fontSize:11,
                  fontWeight:700,
                  color:C.light,
                  marginBottom:8,
                  letterSpacing:0.5
                }}
              >
                SUBCATEGORÍA (OPCIONAL)
              </p>

              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {selectedCat.sub.map(sb => (
                  <button
                    key={sb}
                    onClick={() => s('sub', form.sub === sb ? '' : sb)}
                    style={{
                      fontFamily:PP,
                      fontSize:11,
                      fontWeight:600,
                      padding:'5px 12px',
                      borderRadius:20,
                      border:`1.5px solid ${form.sub === sb ? C.primary : C.border}`,
                      background:form.sub === sb ? C.primary : '#fff',
                      color:form.sub === sb ? '#fff' : C.mid,
                      cursor:'pointer'
                    }}
                  >
                    {sb}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <>
          <Input
            label="Título del anuncio"
            placeholder="Ej: Busco habitación en Zürich / Ofrezco limpieza de pisos"
            required
            value={form.title}
            onChange={e => s('title', e.target.value)}
          />

          <Input
            label="Descripción"
            placeholder="Cuéntanos con detalle qué buscas, vendes u ofreces. Cuánta más info, mejor respuesta recibirás."
            rows={5}
            value={form.desc}
            onChange={e => s('desc', e.target.value)}
          />

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
              const nextUrls = prev.photo_urls.filter((_, itemIndex) => itemIndex !== index)
              return {
                ...prev,
                img_url: prev.img_url === removedUrl ? nextUrls[0] || '' : prev.img_url,
                photo_urls: nextUrls,
              }
            })}
            hint={supportsMultiplePhotos(form.cat)
              ? 'Puedes añadir varias fotos para mostrar mejor el piso, habitación o producto.'
              : 'Ideal para pisos, productos o servicios. En móvil puedes tomar la foto al momento.'}
          />
        </>
      )}

      {step === 3 && (
        <>
          <div style={{ marginBottom:16 }}>
            <label
              style={{
                display:'block',
                fontFamily:PP,
                fontSize:12,
                fontWeight:700,
                color:C.text,
                marginBottom:8
              }}
            >
              Precio
            </label>

            <div
              style={{
                display:'flex',
                alignItems:'center',
                border:`1.5px solid ${C.border}`,
                borderRadius:14,
                background:'#fff',
                overflow:'hidden'
              }}
            >
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ej: 30"
                value={form.priceValue}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^0-9.,]/g, '')
                  s('priceValue', clean)
                }}
                style={{
                  flex:1,
                  border:'none',
                  outline:'none',
                  background:'transparent',
                  padding:'13px 14px',
                  fontFamily:PP,
                  fontSize:13,
                  color:C.text
                }}
              />
              <div
                style={{
                  padding:'13px 14px',
                  borderLeft:`1px solid ${C.border}`,
                  fontFamily:PP,
                  fontSize:12,
                  fontWeight:800,
                  color:C.primary,
                  background:C.primaryLight,
                  whiteSpace:'nowrap'
                }}
              >
                CHF
              </div>
            </div>

            <div style={{ marginTop:10 }}>
              <Select
                label="Frecuencia del precio"
                value={form.priceUnit}
                onChange={e => s('priceUnit', e.target.value)}
              >
                {PRICE_UNITS.map(unit => (
                  <option key={unit.id} value={unit.id}>
                    {unit.label}
                  </option>
                ))}
              </Select>
            </div>

            {form.priceValue && (
              <div
                style={{
                  marginTop:10,
                  background:C.primaryLight,
                  border:`1px solid ${C.primaryMid}`,
                  borderRadius:12,
                  padding:'10px 12px'
                }}
              >
                <p style={{ fontFamily:PP, fontSize:11, color:C.primary, margin:0 }}>
                  Se mostrará como: <strong>{getFormattedPrice()}</strong>
                </p>
              </div>
            )}
          </div>

          <div className="grid-2" style={{ gap:10 }}>
            <Select label="Cantón" required value={form.canton} onChange={e => s('canton', e.target.value)}>
              <option value="">Seleccionar...</option>
              {CANTONS.map(c => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </Select>

            <Input
              label="PLZ (código postal)"
              placeholder="8001"
              value={form.plz}
              onChange={e => s('plz', e.target.value)}
              style={{ maxLength:4 }}
            />
          </div>

          <div style={{ background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:14, padding:'14px 16px', marginBottom:14 }}>
            <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.primaryDark, margin:'0 0 6px' }}>💬 Contacto dentro de Latido</p>
            <p style={{ fontFamily:PP, fontSize:11, color:C.mid, lineHeight:1.6, margin:0 }}>
              Los interesados te escribirán por mensajes dentro de la plataforma. No mostramos teléfono ni email en el anuncio.
            </p>
          </div>

          <div style={{ marginBottom:10 }}>
            <p
              style={{
                fontFamily:PP,
                fontSize:10,
                fontWeight:700,
                color:C.light,
                letterSpacing:1,
                marginBottom:10
              }}
            >
              VISIBILIDAD DEL ANUNCIO *
            </p>

            <div className="grid-2" style={{ gap:10 }}>
              {[
                {
                  id:'public',
                  ico:'🌐',
                  title:'Público',
                  desc:'Tu anuncio es visible para cualquier visitante, sin cuenta.',
                  bg:C.successLight,
                  border:C.successMid,
                  tc:'#065F46'
                },
                {
                  id:'private',
                  ico:'🔒',
                  title:'Privado',
                  desc:'Solo usuarios registrados pueden ver tu anuncio.',
                  bg:C.warnLight,
                  border:C.warnMid,
                  tc:'#92400E'
                },
              ].map(o => (
                <button
                  key={o.id}
                  onClick={() => s('privacy', o.id)}
                  style={{
                    background:form.privacy === o.id ? o.bg : '#fff',
                    border:`2px solid ${form.privacy === o.id ? o.border : C.border}`,
                    borderRadius:16,
                    padding:'14px 12px',
                    cursor:'pointer',
                    textAlign:'center',
                    transition:'all .15s'
                  }}
                >
                  <p style={{ fontSize:26, marginBottom:6 }}>{o.ico}</p>
                  <p
                    style={{
                      fontFamily:PP,
                      fontWeight:700,
                      fontSize:13,
                      color:form.privacy === o.id ? o.tc : C.text,
                      marginBottom:5
                    }}
                  >
                    {o.title}
                  </p>
                  <p style={{ fontFamily:PP, fontSize:10, color:C.light, lineHeight:1.4 }}>
                    {o.desc}
                  </p>
                </button>
              ))}
            </div>

            {/* <div
              style={{
                background:form.privacy === 'private' ? C.warnLight : C.successLight,
                border:`1px solid ${form.privacy === 'private' ? C.warnMid : C.successMid}`,
                borderRadius:12,
                padding:'10px 13px',
                marginTop:10
              }}
            >
              <p
                style={{
                  fontFamily:PP,
                  fontSize:11,
                  color:form.privacy === 'private' ? '#92400E' : '#065F46',
                  margin:0,
                  lineHeight:1.5
                }}
              >
                {form.privacy === 'private'
                  ? '🔒 Solo usuarios con cuenta pueden ver tu anuncio y escribirte dentro de Latido.'
                  : '🌐 Tu anuncio es público para todos, pero las conversaciones pasan por Latido.'}
              </p>
            </div> */}
          </div>

          {form.title && (
            <div style={{ background:C.bg, borderRadius:14, padding:'12px 14px', marginBottom:10 }}>
              <p
                style={{
                  fontFamily:PP,
                  fontSize:10,
                  fontWeight:700,
                  color:C.light,
                  marginBottom:8,
                  letterSpacing:0.5
                }}
              >
                VISTA PREVIA
              </p>

              {(form.img_url || form.photo_urls.length > 0) && (
                <div style={{ borderRadius:12, overflow:'hidden', marginBottom:10 }}>
                  <img
                    src={form.img_url || form.photo_urls[0]}
                    alt={form.title || 'Vista previa'}
                    style={{ width:'100%', maxHeight:180, objectFit:'cover' }}
                  />
                  {supportsMultiplePhotos(form.cat) && form.photo_urls.length > 1 && (
                    <p style={{ fontFamily:PP, fontSize:10, fontWeight:700, color:C.primary, background:C.primaryLight, margin:0, padding:'7px 10px' }}>
                      {form.photo_urls.length} fotos añadidas
                    </p>
                  )}
                </div>
              )}

              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:6 }}>
                {selectedCat && (
                  <span
                    style={{
                      fontFamily:PP,
                      fontSize:10,
                      fontWeight:600,
                      padding:'3px 8px',
                      borderRadius:20,
                      background:form.privacy === 'private' ? C.warnLight : C.successLight,
                      color:form.privacy === 'private' ? '#92400E' : '#065F46'
                    }}
                  >
                    {form.privacy === 'private' ? '🔒 Privado' : '🌐 Público'}
                  </span>
                )}

                {form.canton && (
                  <span
                    style={{
                      fontFamily:PP,
                      fontSize:10,
                      fontWeight:600,
                      padding:'3px 8px',
                      borderRadius:20,
                      background:C.primaryLight,
                      color:C.primary
                    }}
                  >
                    📍 {form.canton} {form.plz}
                  </span>
                )}
              </div>

              <p style={{ fontFamily:PP, fontWeight:700, fontSize:13, color:C.text }}>
                {form.title}
              </p>

              {getFormattedPrice() && (
                <p style={{ fontFamily:PP, fontWeight:800, fontSize:14, color:C.primary, marginTop:4 }}>
                  {getFormattedPrice()}
                </p>
              )}
            </div>
          )}
        </>
      )}

      <div style={{ display:'flex', gap:10, marginTop:24 }}>
        {step > 0 && (
          <Btn onClick={() => setStep(s => s - 1)} variant="secondary" style={{ flex:'0 0 100px' }}>
            ← Atrás
          </Btn>
        )}

        {step < STEPS.length - 1 ? (
          <Btn
            onClick={() => {
              if (step === 0 && !form.cat) {
                toast.error('Selecciona una categoría')
                return
              }

              if (step === 1 && !form.type) {
                toast.error('Selecciona tu rol')
                return
              }

              setStep(s => s + 1)
            }}
            style={{ flex:1 }}
          >
            Continuar →
          </Btn>
        ) : (
          <Btn onClick={handleSubmit} disabled={loading} variant="success" style={{ flex:1 }}>
            {loading ? '⏳ Publicando...' : '✅ Publicar anuncio'}
          </Btn>
        )}
      </div>

      <p style={{ fontFamily:PP, fontSize:11, color:C.light, textAlign:'center', marginTop:12 }}>
        Tus anuncios se revisan automáticamente. Respeta las normas de la comunidad.
      </p>
    </div>
  )
}
