import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { CANTONS } from '../lib/constants'
import { normalizeInterestIds } from '../lib/interests'
import { loadPushSettings, subscribeToPushNotifications } from '../lib/pushNotifications'
import { supabase } from '../lib/supabase'
import './Auth.css'

const ONBOARDING_GOALS = [
  { id:'buscar_servicios', emoji:'🔍', label:'Buscar negocios y servicios' },
  { id:'ofrecer_servicios', emoji:'🏪', label:'Tengo un negocio o soy autónomo' },
  { id:'anuncios', emoji:'📢', label:'Anuncios, empleo o vivienda' },
  { id:'creador', emoji:'🎥', label:'Soy creador de contenido' },
]

const GOAL_INTERESTS = {
  buscar_servicios:['servicios'],
  ofrecer_servicios:['servicios'],
  anuncios:['empleo', 'vivienda'],
  creador:['comunidad'],
}

const POPULAR_CANTONS = [
  { code:'ZH', label:'Zúrich' },
  { code:'LU', label:'Lucerna' },
  { code:'BE', label:'Berna' },
  { code:'BS', label:'Basilea' },
  { code:'GE', label:'Ginebra' },
  { code:'VD', label:'Vaud' },
  { code:'AG', label:'Argovia' },
  { code:'SG', label:'San Galo' },
  { code:'TI', label:'Tesino' },
  { code:'ZG', label:'Zug' },
]

const STEP_CONTENT = [
  {
    title:'¿Qué te trae a Latido?',
    body:'Así te preparamos la portada con lo que de verdad te interesa.',
  },
  {
    emoji:'📍',
    title:'¿Por dónde te mueves?',
    body:'Verás primero lo que está cerca de ti. Puedes cambiarlo cuando quieras.',
  },
  {
    emoji:'🔔',
    title:'¿Te avisamos?',
    body:'Solo lo que te sirve, nada de spam:',
  },
]

function getSafeNextPath(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

function isMissingInterestsColumn(error) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('interests') && (message.includes('column') || message.includes('schema cache'))
}

function getInterestIds(goals) {
  return normalizeInterestIds(goals.flatMap(goal => GOAL_INTERESTS[goal] || []))
}

function LatidoMark() {
  return (
    <span className="latido-post-onboarding__logo">
      <img src="/apple-touch-icon-180.png" alt="Logo de Latido" />
    </span>
  )
}

export default function OAuthOnboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextPath = getSafeNextPath(searchParams.get('next'))
  const metadata = user?.user_metadata || {}
  const displayName = String(metadata.name || metadata.full_name || user?.email?.split('@')[0] || 'Latido').trim()
  const initialGoals = Array.isArray(metadata.onboarding_goals)
    ? metadata.onboarding_goals.filter(goal => ONBOARDING_GOALS.some(option => option.id === goal))
    : []
  const [step, setStep] = useState(0)
  const [goals, setGoals] = useState(initialGoals)
  const [canton, setCanton] = useState(String(metadata.canton || ''))
  const [showAllCantons, setShowAllCantons] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activatingPush, setActivatingPush] = useState(false)

  const selectedInterests = getInterestIds(goals)
  const selectedCanton = POPULAR_CANTONS.find(option => option.code === canton)
    || CANTONS.find(option => option.code === canton)

  const toggleGoal = goal => {
    setGoals(current => current.includes(goal)
      ? current.filter(item => item !== goal)
      : [...current, goal])
  }

  const saveOnboarding = async () => {
    if (!user?.id) throw new Error('No authenticated user is available.')

    const profilePayload = {
      id:user.id,
      name:displayName,
      email:user.email,
      canton:canton || null,
      languages:Array.isArray(metadata.languages) ? metadata.languages : [],
      interests:selectedInterests,
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
        canton,
        languages:profilePayload.languages,
        interests:selectedInterests,
        onboarding_goals:goals,
        latido_onboarding_completed:true,
      },
    })
    if (metadataError) throw metadataError
  }

  const finishOnboarding = async ({ enablePush=false }={}) => {
    if (saving || activatingPush) return
    setSaving(true)
    if (enablePush) setActivatingPush(true)

    try {
      await saveOnboarding()

      if (enablePush) {
        try {
          const settings = loadPushSettings()
          await subscribeToPushNotifications({
            user,
            userCanton:canton,
            settings: {
              ...settings,
              enabled:true,
              canton,
              categories:selectedInterests,
            },
          })
        } catch (error) {
          console.error('Onboarding push activation failed:', error)
          toast('Tu cuenta está lista. Podrás activar los avisos más tarde desde tu perfil.')
        }
      }

      setStep(3)
    } catch (error) {
      console.error('Onboarding could not be saved:', error)
      toast.error('No pudimos guardar tus preferencias. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
      setActivatingPush(false)
    }
  }

  const finishActions = []
  if (goals.includes('ofrecer_servicios')) {
    finishActions.push({ label:'Publicar mi negocio gratis', path:'/registrar-negocio', kind:'primary' })
  }
  if (goals.includes('anuncios')) {
    finishActions.push({ label:'Crear mi primer anuncio', path:'/publicar', kind:finishActions.length ? 'oauth' : 'primary' })
  }
  if (goals.includes('creador')) {
    finishActions.push({ label:'Crear mi perfil de creador', path:'/creadores/alta?from=onboarding', kind:finishActions.length ? 'oauth' : 'primary' })
  }
  if (goals.includes('buscar_servicios') && finishActions.length < 2) {
    finishActions.push({ label:'Buscar negocios y servicios', path:'/comunidades', kind:finishActions.length ? 'oauth' : 'primary' })
  }

  if (step === 3) {
    return (
      <section className="latido-post-onboarding latido-post-onboarding--complete">
        <div className="latido-post-onboarding__hero">
          <LatidoMark />
          <h1>Ya eres parte de Latido</h1>
          <p>Tu cuenta está lista. ¿Por dónde empezamos?</p>
        </div>
        <div className="latido-post-onboarding__sheet">
          <div className="latido-post-onboarding__sheet-inner">
            {finishActions.slice(0, 2).map(action => (
              <button
                key={action.path}
                type="button"
                className={`latido-post-onboarding__button latido-post-onboarding__button--${action.kind}`}
                onClick={() => navigate(action.path, { replace:true })}
              >
                {action.label}
              </button>
            ))}
            <button
              type="button"
              className="latido-post-onboarding__button latido-post-onboarding__button--secondary"
              onClick={() => navigate(nextPath, { replace:true })}
            >
              Explorar Latido
            </button>
            {finishActions.length > 0 && (
              <p className="latido-post-onboarding__note">Las opciones aparecen según lo que marcaste antes.</p>
            )}
          </div>
        </div>
      </section>
    )
  }

  const content = STEP_CONTENT[step]

  return (
    <section className="latido-post-onboarding">
      <header className="latido-post-onboarding__topbar">
        <div className="latido-post-onboarding__segments" aria-label={`Paso ${step + 1} de 3`}>
          {STEP_CONTENT.map((_, index) => <span key={index} className={index <= step ? 'is-active' : ''} />)}
        </div>
        <div className="latido-post-onboarding__nav">
          {step > 0
            ? <button type="button" onClick={() => setStep(current => current - 1)}>‹ Atrás</button>
            : <span />}
          <button
            type="button"
            onClick={() => {
              if (step < 2) setStep(current => current + 1)
              else finishOnboarding()
            }}
            disabled={saving}
          >
            Ahora no
          </button>
        </div>
      </header>

      <div className="latido-post-onboarding__hero">
        {step === 0 ? <LatidoMark /> : <span className="latido-post-onboarding__emoji" aria-hidden="true">{content.emoji}</span>}
        <h1>{content.title}</h1>
        <p>{content.body}</p>
        {step === 2 && (
          <p className="latido-post-onboarding__alerts">
            · Cuando alguien responda a tu anuncio<br />
            · Ofertas nuevas de empleo o vivienda en {selectedCanton?.label || selectedCanton?.name || 'tu zona'}<br />
            · Eventos de la comunidad cerca de ti
          </p>
        )}
      </div>

      <div className="latido-post-onboarding__sheet">
        <div className="latido-post-onboarding__sheet-inner">
          {step === 0 && (
            <>
              <p className="latido-post-onboarding__eyebrow">Puedes elegir varias</p>
              <div className="latido-post-onboarding__goals">
                {ONBOARDING_GOALS.map(goal => {
                  const selected = goals.includes(goal.id)
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      className={selected ? 'is-selected' : ''}
                      aria-pressed={selected}
                      onClick={() => toggleGoal(goal.id)}
                    >
                      <span aria-hidden="true">{goal.emoji}</span>
                      {goal.label}
                    </button>
                  )
                })}
              </div>
              <button type="button" className="latido-post-onboarding__button latido-post-onboarding__button--primary" onClick={() => setStep(1)}>
                Continuar →
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <div className="latido-post-onboarding__cantons">
                {POPULAR_CANTONS.map(option => (
                  <button
                    key={option.code}
                    type="button"
                    className={canton === option.code ? 'is-selected' : ''}
                    aria-pressed={canton === option.code}
                    onClick={() => setCanton(option.code)}
                  >
                    {option.label}
                  </button>
                ))}
                <button type="button" className={showAllCantons ? 'is-selected' : ''} onClick={() => setShowAllCantons(current => !current)}>
                  Otro cantón
                </button>
              </div>
              {showAllCantons && (
                <select className="latido-post-onboarding__select" value={canton} onChange={event => setCanton(event.target.value)} aria-label="Seleccionar otro cantón">
                  <option value="">Seleccionar cantón…</option>
                  {CANTONS.map(option => <option key={option.code} value={option.code}>{option.name}</option>)}
                </select>
              )}
              <button type="button" className="latido-post-onboarding__button latido-post-onboarding__button--primary" onClick={() => setStep(2)}>
                Continuar →
              </button>
              <button
                type="button"
                className="latido-post-onboarding__link"
                onClick={() => {
                  setCanton('')
                  setStep(2)
                }}
              >
                Ver toda Suiza
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                className="latido-post-onboarding__button latido-post-onboarding__button--primary"
                onClick={() => finishOnboarding({ enablePush:true })}
                disabled={saving}
              >
                {activatingPush ? 'Activando avisos…' : 'Activar avisos'}
              </button>
              <button
                type="button"
                className="latido-post-onboarding__button latido-post-onboarding__button--secondary"
                onClick={() => finishOnboarding()}
                disabled={saving}
              >
                {saving && !activatingPush ? 'Guardando…' : 'Ahora no'}
              </button>
              <p className="latido-post-onboarding__note">Puedes cambiarlo en cualquier momento desde tu perfil.</p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
