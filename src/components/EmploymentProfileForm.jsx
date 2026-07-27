import { C, PP } from '../lib/theme'
import {
  EMPLOYMENT_LANGUAGES,
  EMPLOYMENT_PROFILE_OPTIONS,
  getEmploymentProfileLevel,
  normalizeEmploymentProfile,
} from '../lib/employmentProfile'

function QuickQuestion({ label, options, value, onChange }) {
  return (
    <fieldset className="employment-profile-question">
      <legend>{label}</legend>
      <div className="employment-profile-options">
        {options.map(option => {
          const selected = value === option.id
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              className={`employment-profile-option${selected ? ' is-selected' : ''}`}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
export function EmploymentLevelBadge({ profile, levelId='' }) {
  const level = getEmploymentProfileLevel(profile)
  const resolvedLevel = levelId && !level
    ? {
        apprentice:{ label:'Aprendiz', background:'#FEF3C7', color:'#92400E' },
        intermediate:{ label:'Nivel medio', background:'#DBEAFE', color:'#1D4ED8' },
        professional:{ label:'Profesional', background:'#D1FAE5', color:'#047857' },
      }[levelId]
    : level

  if (!resolvedLevel) {
    return (
      <span className="employment-level-badge" style={{ background:C.bg, color:C.light }}>
        Sin valorar
      </span>
    )
  }

  return (
    <span
      className="employment-level-badge"
      style={{ background:resolvedLevel.background, color:resolvedLevel.color }}
    >
      {resolvedLevel.label}
    </span>
  )
}

export default function EmploymentProfileForm({
  value,
  onChange,
  error='',
  title='Perfil profesional básico',
  description='Cinco respuestas rápidas para que una empresa entienda mejor tu disponibilidad.',
  showDisclaimer=true,
}) {
  const profile = normalizeEmploymentProfile(value)
  const update = (key, nextValue) => onChange?.({ ...profile, [key]:nextValue })
  const toggleLanguage = language => {
    const languages = profile.languages.includes(language)
      ? profile.languages.filter(item => item !== language)
      : [...profile.languages, language]
    update('languages', languages)
  }

  return (
    <section className="employment-profile-form" aria-label={title}>
      <div className="employment-profile-heading">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <EmploymentLevelBadge profile={profile} />
      </div>

      <QuickQuestion
        label="1. ¿Cuánta experiencia tienes?"
        options={EMPLOYMENT_PROFILE_OPTIONS.experience}
        value={profile.experience}
        onChange={nextValue => update('experience', nextValue)}
      />
      <QuickQuestion
        label="2. ¿Cuándo puedes empezar?"
        options={EMPLOYMENT_PROFILE_OPTIONS.availability}
        value={profile.availability}
        onChange={nextValue => update('availability', nextValue)}
      />
      <QuickQuestion
        label="3. ¿Tienes autorización para trabajar en Suiza?"
        options={EMPLOYMENT_PROFILE_OPTIONS.workPermit}
        value={profile.workPermit}
        onChange={nextValue => update('workPermit', nextValue)}
      />
      <QuickQuestion
        label="4. ¿Cómo puedes desplazarte?"
        options={EMPLOYMENT_PROFILE_OPTIONS.mobility}
        value={profile.mobility}
        onChange={nextValue => update('mobility', nextValue)}
      />

      <fieldset className="employment-profile-question">
        <legend>5. ¿Qué idiomas hablas?</legend>
        <div className="employment-profile-options">
          {EMPLOYMENT_LANGUAGES.map(language => {
            const selected = profile.languages.includes(language)
            return (
              <button
                key={language}
                type="button"
                aria-pressed={selected}
                className={`employment-profile-option${selected ? ' is-selected' : ''}`}
                onClick={() => toggleLanguage(language)}
              >
                {language}
              </button>
            )
          })}
        </div>
      </fieldset>

      {error && <p className="employment-profile-error">{error}</p>}
      {showDisclaimer && (
        <p className="employment-profile-disclaimer" style={{ fontFamily:PP }}>
          El nivel es orientativo y se basa en la experiencia declarada. Latido no verifica individualmente estos datos ni garantiza encontrar trabajo. La persona usuaria es responsable de la información publicada.
        </p>
      )}
    </section>
  )
}
