export const EMPLOYMENT_LANGUAGES = [
  'Español',
  'Alemán',
  'Francés',
  'Italiano',
  'Inglés',
  'Portugués',
]

export const EMPLOYMENT_PROFILE_OPTIONS = {
  experience:[
    { id:'none', label:'Sin experiencia' },
    { id:'under_one', label:'Menos de 1 año' },
    { id:'one_to_three', label:'1–3 años' },
    { id:'four_plus', label:'4 años o más' },
  ],
  availability:[
    { id:'immediate', label:'Inmediata' },
    { id:'two_weeks', label:'En 2 semanas' },
    { id:'one_month', label:'En 1 mes' },
    { id:'flexible', label:'A convenir' },
  ],
  workPermit:[
    { id:'yes', label:'Sí' },
    { id:'in_process', label:'En trámite' },
    { id:'no', label:'No actualmente' },
  ],
  mobility:[
    { id:'public_transport', label:'Transporte público' },
    { id:'driving_license', label:'Carnet de conducir' },
    { id:'own_vehicle', label:'Vehículo propio' },
  ],
}
export const EMPLOYMENT_LEVELS = {
  apprentice:{
    id:'apprentice',
    label:'Aprendiz',
    shortDescription:'Perfil inicial o con menos de un año de experiencia.',
    background:'#FEF3C7',
    color:'#92400E',
  },
  intermediate:{
    id:'intermediate',
    label:'Nivel medio',
    shortDescription:'Entre uno y tres años de experiencia declarada.',
    background:'#DBEAFE',
    color:'#1D4ED8',
  },
  professional:{
    id:'professional',
    label:'Profesional',
    shortDescription:'Cuatro años o más de experiencia declarada.',
    background:'#D1FAE5',
    color:'#047857',
  },
}

const VALID_VALUES = Object.fromEntries(
  Object.entries(EMPLOYMENT_PROFILE_OPTIONS)
    .map(([key, options]) => [key, new Set(options.map(option => option.id))])
)

export function createEmptyEmploymentProfile(values={}) {
  return normalizeEmploymentProfile({
    experience:'',
    availability:'',
    workPermit:'',
    mobility:'',
    languages:[],
    ...values,
  })
}

export function normalizeEmploymentProfile(value={}) {
  const profile = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const languages = Array.isArray(profile.languages)
    ? [...new Set(profile.languages.filter(language => EMPLOYMENT_LANGUAGES.includes(language)))]
    : []

  return {
    experience:VALID_VALUES.experience.has(profile.experience) ? profile.experience : '',
    availability:VALID_VALUES.availability.has(profile.availability) ? profile.availability : '',
    workPermit:VALID_VALUES.workPermit.has(profile.workPermit) ? profile.workPermit : '',
    mobility:VALID_VALUES.mobility.has(profile.mobility) ? profile.mobility : '',
    languages,
  }
}

export function hasEmploymentProfileData(value) {
  const profile = normalizeEmploymentProfile(value)
  return Boolean(
    profile.experience
    || profile.availability
    || profile.workPermit
    || profile.mobility
    || profile.languages.length
  )
}

export function isEmploymentProfileComplete(value) {
  const profile = normalizeEmploymentProfile(value)
  return Boolean(
    profile.experience
    && profile.availability
    && profile.workPermit
    && profile.mobility
    && profile.languages.length
  )
}

export function getEmploymentProfileLevel(value) {
  const profile = normalizeEmploymentProfile(value)
  if (!profile.experience) return null
  if (profile.experience === 'four_plus') return EMPLOYMENT_LEVELS.professional
  if (profile.experience === 'one_to_three') return EMPLOYMENT_LEVELS.intermediate
  return EMPLOYMENT_LEVELS.apprentice
}

export function getEmploymentProfileLevelById(value) {
  return EMPLOYMENT_LEVELS[value] || null
}

export function getEmploymentExperienceYears(value) {
  const profile = normalizeEmploymentProfile(value)
  if (profile.experience === 'four_plus') return 4
  if (profile.experience === 'one_to_three') return 2
  if (profile.experience === 'under_one' || profile.experience === 'none') return 0
  return null
}

export function getEmploymentAvailabilityDate(value, referenceDate=new Date()) {
  const profile = normalizeEmploymentProfile(value)
  const days = profile.availability === 'immediate'
    ? 0
    : profile.availability === 'two_weeks'
      ? 14
      : profile.availability === 'one_month'
        ? 30
        : null
  if (days == null) return null

  const date = new Date(referenceDate)
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function getEmploymentDrivingLicense(value) {
  const mobility = normalizeEmploymentProfile(value).mobility
  if (!mobility) return null
  return ['driving_license', 'own_vehicle'].includes(mobility)
}

function getOptionLabel(group, value) {
  return EMPLOYMENT_PROFILE_OPTIONS[group]
    ?.find(option => option.id === value)?.label || ''
}

export function getEmploymentProfileRows(value) {
  const profile = normalizeEmploymentProfile(value)
  return [
    { key:'experience', label:'Experiencia', value:getOptionLabel('experience', profile.experience) },
    { key:'availability', label:'Disponibilidad', value:getOptionLabel('availability', profile.availability) },
    { key:'workPermit', label:'Autorización laboral', value:getOptionLabel('workPermit', profile.workPermit) },
    { key:'mobility', label:'Movilidad', value:getOptionLabel('mobility', profile.mobility) },
    { key:'languages', label:'Idiomas', value:profile.languages.join(' · ') },
  ].filter(row => row.value)
}

export function employmentProfileFromJob(job={}) {
  if (hasEmploymentProfileData(job.employment_profile)) {
    return normalizeEmploymentProfile(job.employment_profile)
  }

  const years = Number(job.experience_years)
  const experience = job.experience_years == null || Number.isNaN(years)
    ? ''
    : years >= 4
      ? 'four_plus'
      : years >= 1
        ? 'one_to_three'
        : 'none'

  let availability = ''
  if (job.available_from) {
    const availableAt = new Date(`${job.available_from}T12:00:00`)
    const daysAway = Math.ceil((availableAt.getTime() - Date.now()) / 86400000)
    availability = daysAway <= 3
      ? 'immediate'
      : daysAway <= 18
        ? 'two_weeks'
        : daysAway <= 45
          ? 'one_month'
          : 'flexible'
  }

  const languages = Array.isArray(job.languages)
    ? job.languages
    : String(job.lang || '')
      .split(/[·,]/)
      .map(value => value.trim())
      .filter(Boolean)

  return normalizeEmploymentProfile({
    experience,
    availability,
    workPermit:'',
    mobility:job.driving_license === true ? 'driving_license' : '',
    languages,
  })
}
