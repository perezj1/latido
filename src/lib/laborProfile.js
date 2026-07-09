const PROFILE_STORAGE_KEY = 'latido_labor_profiles_v1'
const SUBMISSION_STORAGE_KEY = 'latido_labor_submissions_v1'
const PORTAL_STATE_STORAGE_KEY = 'latido_labor_portal_state_v1'

export const LABOR_SECTORS = {
  construction: {
    id:'construction',
    label:'Construcción',
    publicLabel:'Construcción',
    route:'/workcheck-construccion',
  },
  cleaning: {
    id:'cleaning',
    label:'Limpieza',
    publicLabel:'Limpieza',
    route:'/perfil-laboral?sector=cleaning',
    disabled:true,
  },
}

export const LABOR_VISIBILITY = {
  private: {
    id:'private',
    label:'Privado',
    description:'Solo temporeras elegidas.',
  },
  partners: {
    id:'partners',
    label:'Temporeras colaboradoras',
    description:'Visible en su portal.',
  },
}

export const LABOR_STATUS_META = {
  missing: { label:'No creado', tone:'muted' },
  incomplete: { label:'Incompleto', tone:'warning' },
  needs_review: { label:'Necesita mejorar', tone:'danger' },
  ready: { label:'Listo para enviar', tone:'success' },
  sent: { label:'Enviado a empresas', tone:'success' },
}

export const AGENCY_CANDIDATE_STATUSES = [
  'Nuevo',
  'Visto',
  'Interesante',
  'Contactado',
  'Entrevista pendiente',
  'Enviado a cliente',
  'Contratado',
  'Rechazado',
  'No disponible',
]

export const TEMPORARY_AGENCIES = [
  {
    slug:'aha-personal',
    name:'AHA Personal',
    city:'Luzern',
    cantons:['Luzern', 'Zug', 'Aargau', 'Zurich'],
    sectors:['construction', 'cleaning'],
    headline:'Trabaja con AHA Personal',
    description:'Recibe perfiles de construcción y limpieza con datos claros desde el primer contacto.',
    contact:'recruiting@aha-personal.ch',
  },
  {
    slug:'bau-team-luzern',
    name:'Bau Team Luzern',
    city:'Luzern',
    cantons:['Luzern', 'Nidwalden', 'Obwalden', 'Zug'],
    sectors:['construction'],
    headline:'Candidatos de obra para Bau Team Luzern',
    description:'Página de prueba para recibir trabajadores de construcción con Perfil Laboral Latido.',
    contact:'bau@latido-demo.ch',
  },
  {
    slug:'limpieza-swiss',
    name:'Limpieza Swiss',
    city:'Zurich',
    cantons:['Zurich', 'Aargau', 'Zug', 'Schwyz'],
    sectors:['cleaning'],
    headline:'Perfiles de limpieza organizados',
    description:'Demo para el futuro flujo de limpieza. El MVP completo empieza con construcción.',
    contact:'limpieza@latido-demo.ch',
  },
]

const DEMO_CANDIDATES = [
  {
    id:'demo-juan-perez',
    source:'demo',
    agencySlug:'aha-personal',
    agencyName:'AHA Personal',
    sentAt:'2026-07-06T08:30:00.000Z',
    status:'Nuevo',
    sector:'construction',
    candidate:{
      name:'Juan Perez',
      phone:'+41 79 123 45 67',
      email:'juan.demo@latido.ch',
      city:'Luzern',
      location:'En Suiza',
    },
    profileSnapshot:{
      form:{
        name:'Juan Perez',
        phone:'+41 79 123 45 67',
        email:'juan.demo@latido.ch',
        city:'Luzern',
        location:'En Suiza',
        start:'Inmediatamente',
        transport:'Coche propio',
        license:'Sí',
        homeCanton:'Luzern',
        mobilityScope:'Mi cantón y cantones cercanos',
        nearbyCantons:['Zug', 'Aargau'],
        role:'Peón / ayudante',
        experience:'2 a 5 años',
        swissExperience:'Sí',
        german:'Órdenes simples',
        references:'Puedo conseguirlas',
        ppe:['Botas', 'Casco', 'Chaleco', 'Guantes'],
      },
      analysis:{
        profile:'Peón avanzado',
        status:'Apto con reservas',
        recommendation:'Candidato recomendable para apoyo en obra y ayuda a oficiales. Verificar tareas especializadas antes de enviarlo como oficial.',
        completion:86,
        dangerCount:0,
        canDo:['Cargar material', 'Ordenar material', 'Preparar zona', 'Limpiar obra', 'Retirar escombros', 'Usar taladro'],
        notDemonstrated:['Lectura de planos', 'Trabajo autónomo como oficial'],
        strengths:['Disponible inmediatamente', 'Tiene coche propio', 'Tiene experiencia previa en Suiza', 'Equipo de protección bastante completo'],
        risks:['Nivel de alemán limitado para conversación compleja'],
      },
    },
  },
  {
    id:'demo-miguel-ruiz',
    source:'demo',
    agencySlug:'aha-personal',
    agencyName:'AHA Personal',
    sentAt:'2026-07-05T13:05:00.000Z',
    status:'Visto',
    sector:'construction',
    candidate:{
      name:'Miguel Ruiz',
      phone:'+41 76 555 21 90',
      email:'',
      city:'Zurich',
      location:'En Suiza',
    },
    profileSnapshot:{
      form:{
        name:'Miguel Ruiz',
        phone:'+41 76 555 21 90',
        email:'',
        city:'Zurich',
        location:'En Suiza',
        start:'Menos de 1 semana',
        transport:'Transporte público',
        license:'No',
        homeCanton:'Zurich',
        mobilityScope:'Todo mi canton',
        nearbyCantons:[],
        role:'Peón básico',
        experience:'Menos de 1 año',
        swissExperience:'Todavía no',
        german:'Palabras básicas',
        references:'No',
        ppe:['Botas', 'Chaleco'],
      },
      analysis:{
        profile:'Peón básico',
        status:'Solo con supervisión',
        recommendation:'Puede servir para tareas básicas si la empresa acepta formar y supervisar.',
        completion:68,
        dangerCount:1,
        canDo:['Cargar material', 'Limpiar obra', 'Ordenar material'],
        notDemonstrated:['Uso de herramientas', 'Trabajo autónomo', 'Tareas especializadas'],
        strengths:['Disponible pronto', 'Puede entender instrucciones básicas'],
        risks:['Equipo de protección incompleto', 'No demuestra experiencia previa en Suiza', 'Carnet de conducir no confirmado'],
      },
    },
  },
]

function readJson(key, fallback) {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent('latido:labor-profile-updated', { detail:{ key } }))
}

function makeId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function getProfileOwnerKey(user) {
  return user?.id ? `user:${user.id}` : 'local-demo-user'
}

export function getAgencyBySlug(slug='') {
  return TEMPORARY_AGENCIES.find(agency => agency.slug === slug) || null
}

export function getLaborProfiles({ user, includeAll = false } = {}) {
  const profiles = readJson(PROFILE_STORAGE_KEY, [])
  if (includeAll) return profiles
  const ownerKey = getProfileOwnerKey(user)
  return profiles.filter(profile => profile.ownerKey === ownerKey)
}

export function getLatestLaborProfile({ user, sector = 'construction' } = {}) {
  return getLaborProfiles({ user })
    .filter(profile => profile.sector === sector && profile.deletedAt == null)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))[0] || null
}

export function getLaborProfileStatus({ form = {}, analysis = {}, sentCount = 0 } = {}) {
  if (sentCount > 0) return 'sent'
  if (!form.name || !form.phone || !form.consent || !form.truth || (analysis.completion || 0) < 45) return 'incomplete'
  if (analysis.key === 'notRecommended' || analysis.key === 'notDemonstrated' || analysis.key === 'notReadyLegal') return 'needs_review'
  return 'ready'
}

export function buildLaborProfileRecord({ form, analysis, user, sector = 'construction', visibility = 'private', previousProfile = null }) {
  const now = new Date().toISOString()
  const sentCount = getLaborSubmissions({ user, includeDemo:false })
    .filter(item => item.profileId === previousProfile?.id)
    .length
  const status = getLaborProfileStatus({ form, analysis, sentCount })

  return {
    id:previousProfile?.id || makeId('profile'),
    ownerKey:getProfileOwnerKey(user),
    userId:user?.id || null,
    userEmail:user?.email || form.email || '',
    sector,
    visibility,
    status,
    createdAt:previousProfile?.createdAt || now,
    updatedAt:now,
    candidateName:form.name || user?.user_metadata?.name || 'Candidato',
    candidatePhone:form.phone || '',
    candidateEmail:form.email || user?.email || '',
    city:form.city || '',
    location:form.location || '',
    form:{ ...form },
    analysis:{ ...analysis },
  }
}

export function saveLaborProfile(profile) {
  const profiles = readJson(PROFILE_STORAGE_KEY, [])
  const next = [
    profile,
    ...profiles.filter(item => item.id !== profile.id),
  ]
  writeJson(PROFILE_STORAGE_KEY, next)
  return profile
}

export function updateLaborProfileVisibility({ profileId, visibility }) {
  const profiles = readJson(PROFILE_STORAGE_KEY, [])
  const now = new Date().toISOString()
  const next = profiles.map(profile => profile.id === profileId ? { ...profile, visibility, updatedAt:now } : profile)
  writeJson(PROFILE_STORAGE_KEY, next)
  return next.find(profile => profile.id === profileId) || null
}

export function deleteLaborProfile(profileId) {
  const profiles = readJson(PROFILE_STORAGE_KEY, [])
  writeJson(PROFILE_STORAGE_KEY, profiles.filter(profile => profile.id !== profileId))
}

export function getLaborSubmissions(options = {}) {
  const { user, agencySlug = '', includeDemo = true } = options
  const submissions = readJson(SUBMISSION_STORAGE_KEY, [])
  const ownerKey = Object.prototype.hasOwnProperty.call(options, 'user') ? getProfileOwnerKey(user) : ''
  const filtered = submissions.filter(item => {
    if (agencySlug && item.agencySlug !== agencySlug) return false
    if (ownerKey && item.ownerKey !== ownerKey) return false
    return true
  })

  if (!includeDemo || user) return filtered

  return [
    ...filtered,
    ...DEMO_CANDIDATES.filter(item => !agencySlug || item.agencySlug === agencySlug),
  ]
}

export function getVisiblePartnerCandidates({ agencySlug = '', includeDemo = true } = {}) {
  const agency = getAgencyBySlug(agencySlug)
  const profiles = []

  for (const profile of getLaborProfiles({ includeAll:true })) {
    if (profile.visibility !== 'partners' || profile.deletedAt != null) continue
    if (agency && !agency.sectors.includes(profile.sector)) continue

    profiles.push({
      id:`visible_${profile.id}`,
      source:'visible',
      profileId:profile.id,
      ownerKey:profile.ownerKey,
      agencySlug:agencySlug || 'partners',
      agencyName:agency?.name || 'Temporeras colaboradoras',
      sentAt:profile.updatedAt,
      status:'Nuevo',
      sector:profile.sector,
      candidate:{
        name:profile.candidateName,
        phone:profile.candidatePhone,
        email:profile.candidateEmail,
        city:profile.city,
        location:profile.location,
      },
      profileSnapshot:profile,
    })
  }

  if (!includeDemo) return profiles
  return profiles
}

export function getPortalCandidates({ agencySlug = '', includeVisible = true, includeDemo = true } = {}) {
  const submissions = getLaborSubmissions({ agencySlug, includeDemo })
  const visible = includeVisible ? getVisiblePartnerCandidates({ agencySlug, includeDemo:false }) : []
  const portalState = readJson(PORTAL_STATE_STORAGE_KEY, {})
  const merged = [...submissions, ...visible]
  const byId = new Map()
  const byProfile = new Map()

  merged.forEach(item => {
    const profileKey = item.profileId
      ? `${item.agencySlug || agencySlug || 'partners'}:${item.profileId}`
      : ''
    const priority = item.source === 'sent' ? 3 : item.source === 'visible' ? 2 : 1
    const current = profileKey ? byProfile.get(profileKey) : null
    const currentPriority = current?.source === 'sent' ? 3 : current?.source === 'visible' ? 2 : 1
    const newer = new Date(item.sentAt || 0) > new Date(current?.sentAt || 0)

    if (!profileKey) {
      byId.set(item.id, item)
      return
    }

    if (!current || priority > currentPriority || (priority === currentPriority && newer)) {
      byProfile.set(profileKey, item)
    }
  })

  byProfile.forEach(item => byId.set(item.id, item))

  byId.forEach((item, id) => {
    const visibleState = item.profileId ? portalState[`visible_${item.profileId}`] : null
    const state = portalState[id] || visibleState || {}
    byId.set(id, { ...item, ...state })
  })

  return Array.from(byId.values())
    .sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0))
}

export function submitLaborProfile({ profile, agencySlug, user, message = '', quick = {} }) {
  const agency = getAgencyBySlug(agencySlug)
  if (!profile || !agency) throw new Error('Falta perfil o temporera.')

  const now = new Date().toISOString()
  const submissions = readJson(SUBMISSION_STORAGE_KEY, [])
  const existing = submissions.find(item => item.profileId === profile.id && item.agencySlug === agency.slug)
  const submission = {
    id:existing?.id || makeId('application'),
    source:'sent',
    profileId:profile.id,
    ownerKey:getProfileOwnerKey(user),
    userId:user?.id || null,
    agencySlug:agency.slug,
    agencyName:agency.name,
    sector:profile.sector,
    sentAt:now,
    status:existing?.status || 'Nuevo',
    message,
    quick,
    candidate:{
      name:quick.name || profile.candidateName,
      phone:quick.phone || profile.candidatePhone,
      email:quick.email || profile.candidateEmail,
      city:quick.city || profile.city,
      location:profile.location,
    },
    profileSnapshot:{
      ...profile,
      form:{
        ...profile.form,
        start:quick.start || profile.form?.start,
        transport:quick.transport || profile.form?.transport,
        phone:quick.phone || profile.form?.phone,
      },
    },
  }

  writeJson(SUBMISSION_STORAGE_KEY, [submission, ...submissions.filter(item => item.id !== submission.id)])

  const profiles = readJson(PROFILE_STORAGE_KEY, [])
  writeJson(PROFILE_STORAGE_KEY, profiles.map(item => (
    item.id === profile.id ? { ...item, status:'sent', lastSubmittedAt:now, updatedAt:now } : item
  )))

  return submission
}

export function updatePortalCandidate(id, updates) {
  const state = readJson(PORTAL_STATE_STORAGE_KEY, {})
  const next = {
    ...state,
    [id]:{
      ...(state[id] || {}),
      ...updates,
      portalUpdatedAt:new Date().toISOString(),
    },
  }
  writeJson(PORTAL_STATE_STORAGE_KEY, next)
  return next[id]
}

export function formatLaborDate(value) {
  if (!value) return '-'
  try {
    return new Intl.DateTimeFormat('es-CH', { day:'2-digit', month:'2-digit', year:'numeric' }).format(new Date(value))
  } catch {
    return '-'
  }
}

export function getCandidateContact(candidate = {}) {
  return [candidate.phone, candidate.email].filter(Boolean).join(' / ') || '-'
}

export function getProfileMobility(form = {}) {
  if (form.mobilityScope === 'Toda Suiza') return 'Toda Suiza'
  if (form.mobilityScope === 'Mi canton y cantones cercanos' || form.mobilityScope === 'Mi cantón y cantones cercanos') {
    return [form.homeCanton, ...(form.nearbyCantons || [])].filter(Boolean).join(', ') || 'Canton y cercanos'
  }
  return [form.homeCanton, form.mobilityScope].filter(Boolean).join(' - ') || '-'
}

const EXPORT_TASK_SCORE = {
  seen:1,
  helped:2,
  guided:3,
  alone:4,
}

function getExportWorkKnowledge(form = {}, analysis = {}) {
  let scoreCount = 0
  let scoreTotal = 0
  let readyCount = 0

  for (const value of Object.values(form.tasks || {})) {
    const score = EXPORT_TASK_SCORE[value] ?? 0
    if (score <= 0) continue
    scoreCount += 1
    scoreTotal += score
    if (score >= 3) readyCount += 1
  }

  const average = scoreCount
    ? scoreTotal / scoreCount
    : 0
  const effectiveReady = Math.max(readyCount, analysis.canDo?.length || 0)

  if (!scoreCount && !effectiveReady) return 'No demostrado'
  if (effectiveReady >= 10 || average >= 3.35) return 'Alto'
  if (effectiveReady >= 5 || average >= 2.4) return 'Medio'
  return 'Bajo'
}

function getExportSafetyKnowledge(analysis = {}) {
  const dangerCount = Number(analysis.dangerCount || 0)
  const strongCount = Number(analysis.strongCount || 0)
  const weakCount = Number(analysis.weakCount || 0)
  const strengths = analysis.strengths || []

  if (analysis.key === 'notRecommended' || dangerCount >= 2) return 'Baja'
  if (dangerCount === 1 || weakCount > 1) return 'Media'
  if (
    strongCount >= 6 ||
    strengths.some(item => String(item).toLowerCase().includes('seguridad') || String(item).toLowerCase().includes('criterio'))
  ) return 'Alta'
  return 'Media'
}

export function exportCandidatesCsv(candidates = []) {
  const headers = ['Nombre', 'Sector', 'Perfil', 'Valoración', 'Trabajo', 'Seguridad', 'Disponible', 'Coche', 'Ciudad', 'Contacto', 'Estado']
  const rows = candidates.map(item => {
    const profile = item.profileSnapshot || {}
    const form = profile.form || {}
    const analysis = profile.analysis || {}
    return [
      item.candidate?.name || profile.candidateName || '',
      LABOR_SECTORS[item.sector]?.label || item.sector || '',
      analysis.profile || '',
      analysis.status || '',
      getExportWorkKnowledge(form, analysis),
      getExportSafetyKnowledge(analysis),
      form.start || '',
      form.transport === 'Coche propio' ? 'Sí' : 'No',
      item.candidate?.city || form.city || '',
      getCandidateContact(item.candidate),
      item.status || '',
    ]
  })
  const csv = [headers, ...rows]
    .map(row => row.map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type:'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `latido-candidatos-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
