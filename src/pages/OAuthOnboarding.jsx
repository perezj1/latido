import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import InterestOptionGrid from '../components/InterestOptionGrid'
import { Btn, Input, Select } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { CANTONS } from '../lib/constants'
import { normalizeInterestIds, ONBOARDING_INTEREST_OPTIONS } from '../lib/interests'
import { supabase } from '../lib/supabase'
import { C, PP } from '../lib/theme'

const LANGUAGE_OPTIONS = ['Español', 'Alemán', 'Francés', 'Italiano', 'Inglés', 'Portugués']

function getSafeNextPath(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

function isMissingInterestsColumn(error) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('interests') && (message.includes('column') || message.includes('schema cache'))
}

export default function OAuthOnboarding() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextPath = getSafeNextPath(searchParams.get('next'))
  const metadata = user?.user_metadata || {}
  const googleName = metadata.name || metadata.full_name || user?.email?.split('@')[0] || 'Latido'
  const [form, setForm] = useState({
    name:String(googleName),
    canton:String(metadata.canton || ''),
    languages:Array.isArray(metadata.languages) ? metadata.languages : [],
    interests:normalizeInterestIds(metadata.interests).slice(0, 3),
  })
  const [nameError, setNameError] = useState('')
  const [cantonError, setCantonError] = useState('')
  const [saving, setSaving] = useState(false)

  const displayName = form.name.trim() || googleName
  const avatarUrl = metadata.avatar_url || metadata.picture || ''

  const toggleLanguage = language => {
    setForm(current => ({
      ...current,
      languages:current.languages.includes(language)
        ? current.languages.filter(item => item !== language)
        : [...current.languages, language],
    }))
  }

  const toggleInterest = interest => {
    setForm(current => {
      if (!current.interests.includes(interest) && current.interests.length >= 3) {
        toast('Puedes elegir hasta tres intereses.')
        return current
      }

      return {
        ...current,
        interests:current.interests.includes(interest)
          ? current.interests.filter(item => item !== interest)
          : [...current.interests, interest],
      }
    })
  }

  const handleSave = async () => {
    const nextNameError = form.name.trim() ? '' : 'Añade tu nombre para continuar.'
    const nextCantonError = form.canton ? '' : 'Selecciona tu cantón para continuar.'
    setNameError(nextNameError)
    setCantonError(nextCantonError)
    if (nextNameError || nextCantonError) return
    if (!user?.id || saving) return

    setSaving(true)
    try {
      const profilePayload = {
        id:user.id,
        name:displayName,
        email:user.email,
        canton:form.canton,
        languages:form.languages,
        interests:form.interests,
      }
      let profileResult = await supabase
        .from('profiles')
        .upsert(profilePayload, { onConflict:'id' })

      if (profileResult.error && isMissingInterestsColumn(profileResult.error)) {
        const compatiblePayload = { ...profilePayload }
        delete compatiblePayload.interests
        profileResult = await supabase
          .from('profiles')
          .upsert(compatiblePayload, { onConflict:'id' })
      }
      if (profileResult.error) throw profileResult.error

      const { error:metadataError } = await supabase.auth.updateUser({
        data: {
          name:displayName,
          canton:form.canton,
          languages:form.languages,
          interests:form.interests,
          latido_onboarding_completed:true,
        },
      })
      if (metadataError) throw metadataError

      toast.success('¡Perfil completado! Ya podemos personalizar Latido para ti.')
      navigate(nextPath, { replace:true })
    } catch (error) {
      console.error('Google onboarding could not be saved:', error)
      toast.error('No pudimos guardar tu perfil. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    if (saving) return
    await signOut()
    navigate('/auth', { replace:true })
  }

  return (
    <div className="latido-page-container" style={{ maxWidth:440, marginTop:24, marginBottom:48 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:22 }}>
        <div style={{ width:54, height:54, flexShrink:0, display:'grid', placeItems:'center', overflow:'hidden', borderRadius:18, background:C.primaryLight, color:C.primary, fontFamily:PP, fontSize:20, fontWeight:800 }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : displayName.charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth:0 }}>
          <p style={{ margin:'0 0 3px', color:C.primary, fontFamily:PP, fontSize:10, fontWeight:800, letterSpacing:.8 }}>CUENTA DE GOOGLE CONECTADA</p>
          <h1 style={{ margin:0, color:C.text, fontFamily:PP, fontSize:21, fontWeight:800, lineHeight:1.2 }}>¡Hola, {displayName}!</h1>
        </div>
      </div>

      <div style={{ marginBottom:22, padding:'14px 15px', border:`1px solid ${C.border}`, borderRadius:16, background:C.primaryLight }}>
        <p style={{ margin:0, color:C.mid, fontFamily:PP, fontSize:11.5, lineHeight:1.6 }}>
          Completa estos datos para mostrarte contenido, anuncios y actividades cerca de ti. Después podrás cambiarlos desde tu perfil.
        </p>
      </div>

      <Input
        label="Nombre visible"
        required
        value={form.name}
        onChange={event => {
          setForm(current => ({ ...current, name:event.target.value }))
          setNameError('')
        }}
        error={nameError}
        errorKey="name"
      />

      <Select
        label="Tu cantón"
        required
        value={form.canton}
        onChange={event => {
          setForm(current => ({ ...current, canton:event.target.value }))
          setCantonError('')
        }}
        error={cantonError}
        errorKey="canton"
      >
        <option value="">Seleccionar cantón...</option>
        {CANTONS.map(canton => <option key={canton.code} value={canton.code}>{canton.code} — {canton.name}</option>)}
      </Select>

      <section style={{ margin:'18px 0 22px' }}>
        <h2 style={{ margin:'0 0 4px', color:C.text, fontFamily:PP, fontSize:13, fontWeight:800 }}>Idiomas que hablas</h2>
        <p style={{ margin:'0 0 11px', color:C.light, fontFamily:PP, fontSize:10.5, lineHeight:1.5 }}>Puedes seleccionar varios.</p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
          {LANGUAGE_OPTIONS.map(language => {
            const selected = form.languages.includes(language)
            return (
              <button
                key={language}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleLanguage(language)}
                style={{ padding:'7px 14px', border:`1.5px solid ${selected ? C.primary : C.border}`, borderRadius:20, background:selected ? C.primary : '#fff', color:selected ? '#fff' : C.mid, fontFamily:PP, fontSize:11, fontWeight:700, cursor:'pointer' }}
              >
                {language}
              </button>
            )
          })}
        </div>
      </section>

      <section style={{ marginBottom:22 }}>
        <h2 style={{ margin:'0 0 4px', color:C.text, fontFamily:PP, fontSize:13, fontWeight:800 }}>¿Qué buscas en Latido?</h2>
        <p style={{ margin:'0 0 11px', color:C.light, fontFamily:PP, fontSize:10.5, lineHeight:1.5 }}>Elige hasta tres intereses · {form.interests.length}/3 seleccionados</p>
        <InterestOptionGrid
          options={ONBOARDING_INTEREST_OPTIONS}
          selectedIds={form.interests}
          onToggle={toggleInterest}
        />
      </section>

      <Btn onClick={handleSave} disabled={saving}>
        {saving ? 'Guardando tu perfil…' : 'Guardar y entrar en Latido →'}
      </Btn>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={saving}
        style={{ width:'100%', marginTop:11, padding:'8px', border:0, background:'transparent', color:C.light, fontFamily:PP, fontSize:10.5, fontWeight:700, cursor:saving ? 'default' : 'pointer' }}
      >
        Cerrar sesión y usar otra cuenta
      </button>
    </div>
  )
}
