import { GUIDE_REVISIONS } from './guideRevisions.js'
import { LIFE_EVENT_GUIDE_REVISIONS } from './guideLifeEvents.js'

const GUIDE_METADATA = [
  {
    "id": "d1",
    "emoji": "📄",
    "cat": "permisos",
    "title": "Tipos de permiso de residencia",
    "level": "Básico",
    "img": "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=900&h=600&fit=crop"
  },
  {
    "id": "d2",
    "emoji": "🧾",
    "cat": "impuestos",
    "title": "Quellensteuer vs Imposición ordinaria",
    "level": "Medio",
    "img": "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&h=600&fit=crop"
  },
  {
    "id": "d3",
    "emoji": "🏥",
    "cat": "salud",
    "title": "Cómo elegir tu Krankenkasse",
    "level": "Básico",
    "img": "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=900&h=600&fit=crop"
  },
  {
    "id": "d4",
    "emoji": "🏦",
    "cat": "banco",
    "title": "Abrir cuenta bancaria sin referencias",
    "level": "Básico",
    "img": "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=900&h=600&fit=crop"
  },
  {
    "id": "d5",
    "emoji": "🎓",
    "cat": "educacion",
    "title": "Guarderías (Kitas) y escuelas",
    "level": "Básico",
    "img": "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=900&h=600&fit=crop"
  },
  {
    "id": "d6",
    "emoji": "🇩🇪",
    "cat": "educacion",
    "title": "Dónde aprender alemán en Suiza",
    "level": "Básico",
    "img": "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&h=600&fit=crop"
  },
  {
    "id": "d7",
    "emoji": "👨‍👩‍👧",
    "cat": "permisos",
    "title": "Reagrupación familiar en Suiza",
    "level": "Medio",
    "img": "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=900&h=600&fit=crop"
  },
  {
    "id": "d8",
    "emoji": "💰",
    "cat": "impuestos",
    "title": "AHV/AVS: tu pensión y cómo funciona",
    "level": "Medio",
    "img": "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=900&h=600&fit=crop"
  },
  {
    "id": "d9",
    "emoji": "🏠",
    "cat": "vivienda",
    "title": "Cómo encontrar piso en Suiza",
    "level": "Básico",
    "img": "https://images.unsplash.com/photo-1501183638710-841dd1904471?w=900&h=600&fit=crop"
  },
  {
    "id": "d10",
    "emoji": "💼",
    "cat": "trabajo",
    "title": "Tus derechos laborales en Suiza",
    "level": "Básico",
    "img": "https://diamondasesores.com/wp-content/uploads/2022/08/Portada-Derecho-Laboral-principal-copia.jpg"
  },
  {
    "id": "d11",
    "emoji": "💸",
    "cat": "banco",
    "title": "Enviar dinero a España y Latinoamérica",
    "level": "Básico",
    "img": "https://images.unsplash.com/photo-1556740749-887f6717d7e4?w=900&h=600&fit=crop"
  },
  {
    "id": "d13",
    "emoji": "🚗",
    "cat": "permisos",
    "title": "Carnet de conducir en Suiza",
    "level": "Medio",
    "img": "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=900&h=600&fit=crop"
  },
  {
    "id": "d14",
    "emoji": "🏢",
    "cat": "trabajo",
    "title": "Empresas de trabajo temporal en Suiza",
    "level": "Básico",
    "img": "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900&h=600&fit=crop"
  },
  {
    "id": "d12",
    "emoji": "🎓",
    "cat": "educacion",
    "title": "Convalidar tu título universitario en Suiza",
    "level": "Medio",
    "img": "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=900&h=600&fit=crop"
  },
  { id:'d15', emoji:'💼', cat:'trabajo', title:'Desempleo y RAV en Suiza', level:'Básico', img:'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=900&h=600&fit=crop' },
  { id:'d16', emoji:'📦', cat:'vivienda', title:'Mudarte dentro de Suiza paso a paso', level:'Básico', img:'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&h=600&fit=crop' },
  { id:'d17', emoji:'🤰', cat:'salud', title:'Embarazo y nacimiento en Suiza', level:'Básico', img:'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=900&h=600&fit=crop' },
  { id:'d18', emoji:'✈️', cat:'permisos', title:'Salir de Suiza y volver a tu país', level:'Medio', img:'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=900&h=600&fit=crop' },
  { id:'d19', emoji:'👶', cat:'educacion', title:'Llegar a Suiza con niños', level:'Básico', img:'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=900&h=600&fit=crop' },
]

export const GUIDE_REVIEW_DATE = '2026-10-07'

export const GUIDES = GUIDE_METADATA.map(metadata => {
  const revision = GUIDE_REVISIONS[metadata.id] || LIFE_EVENT_GUIDE_REVISIONS[metadata.id]
  // Keep a plain-text version for global search and SEO prerendering.
  const content = revision.sections.map(section => [
    '**' + section.heading + '**',
    ...section.paragraphs,
    ...section.bullets.map(item => '• ' + item),
    section.note,
  ].filter(Boolean).join('\n\n')).join('\n\n')
  const wordCount = content.split(/\s+/).filter(Boolean).length
  return {
    ...metadata,
    ...revision,
    content,
    reviewedAt:revision.reviewedAt || GUIDE_REVIEW_DATE,
    time:Math.max(2, Math.ceil(wordCount / 180)) + ' min',
  }
})
