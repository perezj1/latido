import { useEffect, useId, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { Btn, Input, ProgressBar, Select, StickyFormActions } from '../components/UI'
import { CreatorAvatar, CreatorTopicPill } from '../components/CreatorCards'
import { CANTONS } from '../lib/constants'
import {
  CREATOR_PLATFORMS,
  CREATOR_FOLLOWER_RANGES,
  CREATOR_TOPICS,
  getCreatorForUser,
  isCreatorHandleAvailable,
  getCreatorTopicsFromInterests,
  normalizeCreatorUrl,
  saveCreatorProfile,
} from '../lib/creators'
import { C, PP } from '../lib/theme'
import './Creators.css'

const STEPS = [
  { title:'Tu perfil y lo que compartes', sub:'Puedes presentarte como persona, profesional, proyecto o negocio.' },
  { title:'¿Qué compartes sobre Suiza?', sub:'Experiencias, información, trabajo, servicios o proyectos: elige los temas que mejor te representan.' },
  { title:'Conecta tus redes', sub:'Las visitas llegarán siempre a tus perfiles, publicaciones y páginas originales.' },
  { title:'Revisa tu perfil', sub:'En este prototipo se publicará inmediatamente para que puedas probarlo.' },
]

const PROFILE_LIMITS = {
  name:{ min:2, max:60 },
  tagline:{ min:20, max:120 },
  bio:{ min:80, max:600 },
}

function focusFirstError(errors) {
  const firstKey = Object.keys(errors)[0]
  if (!firstKey) return
  window.setTimeout(() => {
    const field = document.querySelector(`[data-error-field="${firstKey}"]`)
    field?.scrollIntoView({ behavior:'smooth', block:'center' })
    field?.querySelector('input,textarea,select,button')?.focus({ preventScroll:true })
  }, 40)
}

function prepareLocalAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Selecciona una imagen JPG, PNG o WebP.'))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error('La imagen pesa más de 10 MB. Elige una más ligera.'))
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 360
      canvas.height = 360
      const context = canvas.getContext('2d')
      const scale = Math.max(canvas.width / image.width, canvas.height / image.height)
      const width = image.width * scale
      const height = image.height * scale
      context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
      URL.revokeObjectURL(objectUrl)
      resolve(canvas.toDataURL('image/webp', .8))
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('No se pudo leer la imagen seleccionada.'))
    }
    image.src = objectUrl
  })
}

function initialForm(existing, displayName, userCanton, userInterests = []) {
  const socialMap = Object.fromEntries((existing?.socials || []).map(social => [social.platform, social.url]))
  const followerMap = Object.fromEntries((existing?.socials || []).map(social => [social.platform, social.follower_range || '']))
  return {
    name:existing?.name || displayName || '',
    avatar_url:existing?.avatar_url || '',
    handle:existing?.handle ? `@${String(existing.handle).replace(/^@+/, '')}` : '',
    tagline:existing?.tagline || '',
    bio:existing?.bio || '',
    city:existing?.city || '',
    canton:existing?.canton || userCanton || '',
    reach:existing?.reach || 'Toda Suiza',
    topics:existing ? (existing.topics || []) : getCreatorTopicsFromInterests(userInterests),
    socials:Object.fromEntries(CREATOR_PLATFORMS.map(platform => [platform.id, socialMap[platform.id] || ''])),
    followers:Object.fromEntries(CREATOR_PLATFORMS.map(platform => [platform.id, followerMap[platform.id] || ''])),
    accepted:false,
  }
}

export default function CreadorAlta() {
  const navigate = useNavigate()
  const location = useLocation()
  const avatarDeviceId = useId()
  const avatarCameraId = useId()
  const { user, displayName, userCanton, userInterests } = useAuth()
  const existing = useMemo(() => getCreatorForUser(user?.id), [user?.id])
  const isEditing = Boolean(existing)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [processingAvatar, setProcessingAvatar] = useState(false)
  const [form, setForm] = useState(() => initialForm(existing, displayName, userCanton, userInterests))
  const [errors, setErrors] = useState({})

  useEffect(() => {
    window.scrollTo({ top:0, left:0, behavior:'smooth' })
  }, [step])

  const clearErrors = (...keys) => setErrors(current => {
    if (!keys.some(key => current[key])) return current
    const next = { ...current }
    keys.forEach(key => delete next[key])
    return next
  })

  const update = (key, value) => {
    setForm(current => ({ ...current, [key]:value }))
    clearErrors(key)
  }

  const updateSocial = (platform, value) => {
    setForm(current => ({
      ...current,
      socials:{ ...current.socials, [platform]:value },
    }))
    clearErrors(`social_${platform}`, `followers_${platform}`, 'socials')
  }

  const updateHandle = value => {
    const raw = String(value || '')
    update('handle', raw ? `@${raw.replace(/^@+/, '')}` : '')
  }

  const updateFollowerRange = (platform, value) => {
    setForm(current => ({
      ...current,
      followers:{ ...current.followers, [platform]:value },
    }))
    clearErrors(`followers_${platform}`)
  }

  const toggleTopic = topicId => {
    clearErrors('topics')
    setForm(current => {
      const selected = current.topics.includes(topicId)
      if (!selected && current.topics.length >= 4) {
        toast('Puedes elegir hasta cuatro temas principales.', { icon:'💡' })
        return current
      }
      return {
        ...current,
        topics:selected ? current.topics.filter(item => item !== topicId) : [...current.topics, topicId],
      }
    })
  }

  const validateStep = (stepsToValidate = [step]) => {
    const activeSteps = new Set(Array.isArray(stepsToValidate) ? stepsToValidate : [stepsToValidate])
    const nextErrors = {}
    if (activeSteps.has(0)) {
      const nameLength = form.name.trim().length
      const handle = form.handle.trim()
      const taglineLength = form.tagline.trim().length
      const bioLength = form.bio.trim().length

      if (!nameLength) nextErrors.name = 'Escribe el nombre público de tu perfil, proyecto o negocio.'
      else if (nameLength < PROFILE_LIMITS.name.min) nextErrors.name = `El nombre necesita al menos ${PROFILE_LIMITS.name.min} caracteres (llevas ${nameLength}).`
      else if (nameLength > PROFILE_LIMITS.name.max) nextErrors.name = `El nombre admite como máximo ${PROFILE_LIMITS.name.max} caracteres (llevas ${nameLength}).`

      if (!handle) nextErrors.handle = 'Crea un usuario para identificar tu perfil, por ejemplo @joseensuiza.'
      else if (!handle.startsWith('@')) nextErrors.handle = 'El usuario debe comenzar por @.'
      else if (handle.slice(1).length < 3) nextErrors.handle = `El usuario necesita al menos 3 caracteres después de la @ (llevas ${handle.slice(1).length}).`
      else if (!/^@[a-zA-Z0-9._-]+$/.test(handle)) nextErrors.handle = 'Después de la @ usa solo letras, números, punto, guion o guion bajo; no incluyas espacios.'
      else if (!isCreatorHandleAvailable(handle, user?.id)) nextErrors.handle = 'Ese usuario ya está siendo utilizado por otro creador. Elige uno diferente.'

      if (!taglineLength) nextErrors.tagline = 'Resume en una frase qué compartes o qué aportas.'
      else if (taglineLength < PROFILE_LIMITS.tagline.min) nextErrors.tagline = `La frase necesita al menos ${PROFILE_LIMITS.tagline.min} caracteres (llevas ${taglineLength}).`
      else if (taglineLength > PROFILE_LIMITS.tagline.max) nextErrors.tagline = `La frase admite como máximo ${PROFILE_LIMITS.tagline.max} caracteres (llevas ${taglineLength}).`

      if (!bioLength) nextErrors.bio = 'Cuenta quién eres o qué proyecto representas, qué compartes y qué relación tienes con Suiza.'
      else if (bioLength < PROFILE_LIMITS.bio.min) nextErrors.bio = `La descripción necesita al menos ${PROFILE_LIMITS.bio.min} caracteres (llevas ${bioLength}).`
      else if (bioLength > PROFILE_LIMITS.bio.max) nextErrors.bio = `La descripción admite como máximo ${PROFILE_LIMITS.bio.max} caracteres (llevas ${bioLength}).`
    }
    if (activeSteps.has(1) && !form.topics.length) nextErrors.topics = 'Elige al menos un tema principal para que podamos recomendar tu perfil.'
    if (activeSteps.has(2)) {
      const socialEntries = Object.entries(form.socials).filter(([, value]) => value.trim())
      if (!socialEntries.length) nextErrors.socials = 'Añade al menos una red social, canal o página web.'
      socialEntries.forEach(([platform, value]) => {
        if (!normalizeCreatorUrl(value)) nextErrors[`social_${platform}`] = 'Introduce una dirección válida que empiece, por ejemplo, por https://'
        const platformConfig = CREATOR_PLATFORMS.find(item => item.id === platform)
        if (platformConfig?.hasFollowerRange && !form.followers[platform]) {
          nextErrors[`followers_${platform}`] = 'Selecciona un rango aproximado. Es un dato privado para la revisión de Latido.'
        }
      })
    }
    if (activeSteps.has(3) && !form.accepted) nextErrors.accepted = 'Marca esta casilla para confirmar que representas el perfil y puedes compartir estos enlaces.'

    setErrors(nextErrors)
    focusFirstError(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const next = () => {
    if (!validateStep()) return
    setErrors({})
    setStep(current => Math.min(current + 1, STEPS.length - 1))
  }

  const handleSave = () => {
    if (!validateStep(isEditing ? [0, 1, 2] : [step])) return

    setSaving(true)
    try {
      const socials = CREATOR_PLATFORMS
        .map(platform => ({ platform:platform.id, url:form.socials[platform.id], label:platform.label, follower_range:form.followers[platform.id] }))
        .filter(social => social.url.trim())
      saveCreatorProfile(user.id, { ...form, socials, status:'published' })
      toast.success(existing ? 'Perfil actualizado' : 'Perfil de prueba creado')
      navigate(existing ? '/creadores/mi-perfil' : '/creadores/mi-perfil?created=1')
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar el perfil')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarFiles = async event => {
    const [file] = Array.from(event.target.files || [])
    event.target.value = ''
    if (!file) return

    setProcessingAvatar(true)
    try {
      const avatarUrl = await prepareLocalAvatar(file)
      update('avatar_url', avatarUrl)
      toast.success('Foto de perfil preparada')
    } catch (error) {
      toast.error(error?.message || 'No se pudo preparar la foto')
    } finally {
      setProcessingAvatar(false)
    }
  }

  const cancelCreatorFlow = () => {
    setErrors({})
    const returnPath = typeof location.state?.from === 'string' ? location.state.from : ''
    const safeReturnPath = returnPath.startsWith('/') && !returnPath.startsWith('//') && !returnPath.startsWith('/auth')
      ? returnPath
      : ''

    if (safeReturnPath) {
      navigate(safeReturnPath, { replace:true })
      return
    }
    if (new URLSearchParams(location.search).get('from') === 'onboarding') {
      navigate('/perfil', { replace:true })
      return
    }
    if (Number(window.history.state?.idx) > 0) {
      navigate(-1)
      return
    }
    navigate(existing ? '/creadores/mi-perfil' : '/perfil', { replace:true })
  }

  const previewCreator = {
    name:form.name || 'Tu nombre o proyecto',
    avatar_url:form.avatar_url,
    handle:form.handle || '@tuusuario',
    tagline:form.tagline || 'Aquí aparecerá lo que compartes sobre Suiza.',
    city:form.city,
    canton:form.canton,
    reach:form.reach,
    topics:form.topics,
    accent:'#2563EB',
  }

  return (
    <div className="creators-page creator-app-form-page">
      <div style={{ maxWidth:600, margin:'0 auto', padding:'32px 24px 170px' }}>
        {!isEditing && <ProgressBar step={step} total={STEPS.length} />}
        <h1 style={{ margin:'0 0 4px', color:C.text, fontFamily:PP, fontWeight:800, fontSize:22, letterSpacing:-.3 }}>{isEditing ? 'Editar perfil de creador' : STEPS[step].title}</h1>
        <p style={{ margin:'0 0 18px', color:C.light, fontFamily:PP, fontSize:12, lineHeight:1.6 }}>{isEditing ? 'Actualiza los campos que necesites y guarda los cambios en cualquier momento.' : STEPS[step].sub}</p>

        {!isEditing && step === 0 && (
          <div style={{ display:'flex', gap:9, alignItems:'flex-start', marginBottom:16, padding:'11px 13px', color:'#1E3A8A', background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:14, fontFamily:PP, fontSize:10.5, lineHeight:1.6 }}>
            <span>🧪</span>
            <span>Este espacio es para personas, profesionales y negocios que comparten sobre Suiza en redes. No hace falta dedicarse profesionalmente a crear contenido. Durante la prueba, el perfil se guarda solo en este navegador.</span>
          </div>
        )}

        <div>
          {(isEditing || step === 0) && (
            <>
              {isEditing && <div className="creator-edit-section-heading"><strong>Información del perfil</strong><span>Nombre, foto y presentación pública.</span></div>}
              <Input label="NOMBRE DEL PERFIL, PROYECTO O NEGOCIO" required error={errors.name} errorKey="name" value={form.name} onChange={event => update('name', event.target.value)} placeholder="Ej. Lucía en Suiza · Taller García · Enfermera en Zúrich" />
              <div className="creator-avatar-upload">
                <span className="creator-avatar-upload__label">FOTO DE PERFIL · OPCIONAL</span>
                <div className="creator-avatar-upload__body">
                  <CreatorAvatar creator={previewCreator} size={82} />
                  <div className="creator-avatar-upload__controls">
                    <strong>{processingAvatar ? 'Preparando la foto…' : form.avatar_url ? 'Tu foto está lista' : 'Elige una foto que te represente'}</strong>
                    <small>Se recortará en formato cuadrado y se mostrará en círculo.</small>
                    <div>
                      <label className="creator-avatar-upload__button is-primary" htmlFor={avatarDeviceId}>
                        🖼 {form.avatar_url ? 'Cambiar' : 'Elegir foto'}
                      </label>
                      <label className="creator-avatar-upload__button" htmlFor={avatarCameraId}>📷 Cámara</label>
                      {form.avatar_url && <button type="button" onClick={() => update('avatar_url', '')}>Quitar</button>}
                    </div>
                    <input id={avatarDeviceId} type="file" accept="image/*" onChange={handleAvatarFiles} disabled={processingAvatar} />
                    <input id={avatarCameraId} type="file" accept="image/*" capture="user" onChange={handleAvatarFiles} disabled={processingAvatar} />
                  </div>
                </div>
              </div>
              <Input label="USUARIO O ALIAS" required error={errors.handle} errorKey="handle" leftElement={<span aria-hidden="true">@</span>} value={form.handle.replace(/^@/, '')} onChange={event => updateHandle(event.target.value)} placeholder="joseensuiza" />
              <p className="creator-field-help">Identificador corto de tu perfil.</p>
              <Input label="QUÉ COMPARTES EN UNA FRASE" required error={errors.tagline} errorKey="tagline" value={form.tagline} onChange={event => update('tagline', event.target.value)} placeholder="Ej. Mi experiencia trabajando en Suiza y consejos para recién llegados." />
              <p className={`creator-field-count${errors.tagline ? ' is-error' : ''}`}>{form.tagline.trim().length}/{PROFILE_LIMITS.tagline.max} caracteres · mínimo {PROFILE_LIMITS.tagline.min}</p>
              <Input label="SOBRE TI, TU TRABAJO O PROYECTO" required rows={5} error={errors.bio} errorKey="bio" value={form.bio} onChange={event => update('bio', event.target.value)} placeholder="¿Quién eres o qué proyecto representas? ¿Qué compartes en redes? ¿Vives, trabajas o tienes un negocio en Suiza?" />
              <p className={`creator-field-count${errors.bio ? ' is-error' : ''}`}>{form.bio.trim().length}/{PROFILE_LIMITS.bio.max} caracteres · mínimo {PROFILE_LIMITS.bio.min} · No incluyas datos privados.</p>
            </>
          )}

          {(isEditing || step === 1) && (
            <>
              {isEditing && <div className="creator-edit-section-heading"><strong>Temas y ubicación</strong><span>Ayudan a recomendar tu perfil a las personas adecuadas.</span></div>}
              <p style={{ margin:'0 0 10px', color:C.light, fontFamily:PP, fontSize:10, fontWeight:800, letterSpacing:.8 }}>TEMAS PRINCIPALES · ELIGE HASTA 4</p>
              <div data-error-field="topics" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:8, marginBottom:errors.topics ? 6 : 22, padding:errors.topics ? 8 : 0, background:errors.topics ? '#FFF7F7' : 'transparent', border:errors.topics ? '1.5px solid #EF4444' : '1.5px solid transparent', borderRadius:16 }}>
                {CREATOR_TOPICS.map(topic => {
                  const selected = form.topics.includes(topic.id)
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => toggleTopic(topic.id)}
                      style={{ display:'flex', minHeight:54, padding:'10px 12px', alignItems:'center', gap:10, color:selected ? topic.color : C.mid, background:selected ? topic.bg : '#fff', border:`1.5px solid ${selected ? topic.color : C.border}`, borderRadius:14, fontFamily:PP, fontSize:10.5, fontWeight:800, textAlign:'left', cursor:'pointer' }}
                    >
                      <span style={{ fontSize:22 }}>{topic.emoji}</span>
                      <span>{topic.label}</span>
                      <span style={{ marginLeft:'auto' }}>{selected ? '✓' : '+'}</span>
                    </button>
                  )
                })}
              </div>
              {errors.topics && <p className="creator-inline-error">{errors.topics}</p>}

              <div className="creator-onboarding-location-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <Select label="CANTÓN BASE" value={form.canton} onChange={event => update('canton', event.target.value)}>
                  <option value="">Toda Suiza / sin cantón</option>
                  {CANTONS.map(canton => <option key={canton.code} value={canton.code}>{canton.code} · {canton.name}</option>)}
                </Select>
                <Input label="CIUDAD (OPCIONAL)" value={form.city} onChange={event => update('city', event.target.value)} placeholder="Ej. Zürich" />
              </div>
              <Select label="ALCANCE HABITUAL" value={form.reach} onChange={event => update('reach', event.target.value)}>
                <option value="Toda Suiza">Toda Suiza</option>
                <option value="Suiza alemana">Suiza alemana</option>
                <option value="Suiza francófona">Suiza francófona</option>
                <option value="Suiza italiana">Suiza italiana</option>
                <option value="Contenido local">Principalmente local</option>
              </Select>
            </>
          )}

          {(isEditing || step === 2) && (
            <>
              {isEditing && <div className="creator-edit-section-heading"><strong>Redes y enlaces</strong><span>Cambia, añade o elimina los destinos de tu perfil.</span></div>}
              <div style={{ marginBottom:18, padding:'12px 14px', color:'#1E3A8A', background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:13, fontFamily:PP, fontSize:10.5, lineHeight:1.65 }}>
                Añade al menos una red social, canal o web. El rango aproximado de audiencia es privado: ayuda a Latido a revisar el alta, pero no se muestra en tu perfil ni influye en el orden.
              </div>
              {CREATOR_PLATFORMS.map(platform => (
                <div key={platform.id} data-error-field={errors[`social_${platform.id}`] ? `social_${platform.id}` : errors[`followers_${platform.id}`] ? `followers_${platform.id}` : undefined} className="creator-social-field">
                  <span style={{ color:platform.color, fontFamily:PP, fontSize:10, fontWeight:900 }}>{platform.short} · {platform.label}</span>
                  <div>
                    <input
                      className={`creator-form-control${errors[`social_${platform.id}`] ? ' is-error' : ''}`}
                      type="url"
                      value={form.socials[platform.id]}
                      onChange={event => updateSocial(platform.id, event.target.value)}
                      placeholder={platform.id === 'web' ? 'https://tuweb.com' : `https://${platform.id}.com/tuusuario`}
                      aria-label={`Enlace de ${platform.label}`}
                      aria-invalid={Boolean(errors[`social_${platform.id}`]) || undefined}
                    />
                    {errors[`social_${platform.id}`] && <p className="creator-inline-error">{errors[`social_${platform.id}`]}</p>}
                    {platform.hasFollowerRange && form.socials[platform.id].trim() && (
                      <>
                        <select
                          className={`creator-form-control creator-private-range${errors[`followers_${platform.id}`] ? ' is-error' : ''}`}
                          value={form.followers[platform.id]}
                          onChange={event => updateFollowerRange(platform.id, event.target.value)}
                          aria-label={`Rango privado de audiencia en ${platform.label}`}
                          aria-invalid={Boolean(errors[`followers_${platform.id}`]) || undefined}
                        >
                          <option value="">Rango aproximado · privado</option>
                          {CREATOR_FOLLOWER_RANGES.map(range => <option key={range.id} value={range.id}>{range.label}</option>)}
                        </select>
                        {errors[`followers_${platform.id}`] && <p className="creator-inline-error">{errors[`followers_${platform.id}`]}</p>}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div data-error-field="socials">
                {errors.socials && <p className="creator-inline-error creator-inline-error--box">{errors.socials}</p>}
              </div>
              <p style={{ margin:'12px 0 0', color:C.light, fontFamily:PP, fontSize:9.5, lineHeight:1.6 }}>Después podrás editar estos enlaces desde tu espacio en Latido.</p>
            </>
          )}

          {!isEditing && step === 3 && (
            <>
              <div style={{ display:'flex', gap:14, alignItems:'center', marginBottom:18 }}>
                <CreatorAvatar creator={previewCreator} size={72} />
                <div style={{ minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <strong style={{ overflow:'hidden', color:C.text, fontFamily:PP, fontSize:16, textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{previewCreator.name}</strong>
                    <span style={{ color:C.light, fontFamily:PP, fontSize:9 }}>Sin confirmar</span>
                  </div>
                  <span style={{ display:'block', marginTop:3, color:C.light, fontFamily:PP, fontSize:10 }}>{previewCreator.handle}</span>
                  <span style={{ display:'block', marginTop:5, color:C.mid, fontFamily:PP, fontSize:10 }}>📍 {previewCreator.city || previewCreator.reach}{previewCreator.canton ? ` · ${previewCreator.canton}` : ''}</span>
                </div>
              </div>
              <p style={{ margin:'0 0 12px', color:C.text, fontFamily:PP, fontSize:13, fontWeight:800, lineHeight:1.55 }}>{form.tagline}</p>
              <p style={{ margin:'0 0 14px', color:C.mid, fontFamily:PP, fontSize:11, lineHeight:1.7 }}>{form.bio}</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:18 }}>
                {form.topics.map(topic => <CreatorTopicPill key={topic} topicId={topic} />)}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:7, padding:'13px', background:C.bgAlt, borderRadius:14 }}>
                {CREATOR_PLATFORMS.filter(platform => form.socials[platform.id].trim()).map(platform => (
                  <span key={platform.id} style={{ padding:'6px 9px', color:platform.color, background:platform.bg, borderRadius:999, fontFamily:PP, fontSize:9, fontWeight:800 }}>{platform.short} · {platform.label}</span>
                ))}
              </div>

              <label data-error-field="accepted" style={{ display:'flex', gap:10, alignItems:'flex-start', marginTop:20, padding:'13px', color:errors.accepted ? '#991B1B' : C.mid, background:errors.accepted ? '#FFF7F7' : '#FFF7ED', border:`1.5px solid ${errors.accepted ? '#EF4444' : '#FED7AA'}`, borderRadius:14, fontFamily:PP, fontSize:10.5, lineHeight:1.6, cursor:'pointer' }}>
                <input type="checkbox" checked={form.accepted} onChange={event => update('accepted', event.target.checked)} style={{ width:18, height:18, marginTop:1, flex:'0 0 18px', accentColor:C.primary }} />
                <span>Confirmo que esta información es verídica, que represento este perfil y que tengo derecho a compartir sus enlaces, nombre e identidad visual. Entiendo que Latido no valida automáticamente la información de las publicaciones enlazadas.</span>
              </label>
              {errors.accepted && <p className="creator-inline-error">{errors.accepted}</p>}

              <div style={{ marginTop:14, padding:'12px 14px', color:'#1E3A8A', background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:13, fontFamily:PP, fontSize:10, lineHeight:1.6 }}>
                <strong>Durante la prueba:</strong> el perfil se guarda solo en este navegador y aparece inmediatamente en el directorio. En producción pasaría primero por revisión de Latido.
              </div>
            </>
          )}
        </div>
      </div>

      <StickyFormActions>
        <Btn variant="secondary" onClick={() => {
          setErrors({})
          if (isEditing || step === 0) cancelCreatorFlow()
          else setStep(current => current - 1)
        }} style={{ flex:'0 0 125px' }}>
          {isEditing || step === 0 ? 'Cancelar' : '← Atrás'}
        </Btn>
        {isEditing ? (
          <Btn variant="success" disabled={saving || processingAvatar} onClick={handleSave} style={{ flex:1 }}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Btn>
        ) : step < STEPS.length - 1 ? (
          <Btn onClick={next} style={{ flex:1 }}>Continuar →</Btn>
        ) : (
          <Btn variant="success" disabled={saving} onClick={handleSave} style={{ flex:1 }}>
            {saving ? 'Guardando…' : existing ? 'Guardar cambios' : 'Publicar perfil de prueba'}
          </Btn>
        )}
      </StickyFormActions>
    </div>
  )
}
