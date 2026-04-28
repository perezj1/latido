// ── CANTONS ────────────────────────────────────────────────────
export const CANTONS = [
  { code:'AG', name:'Aargau' },       { code:'AI', name:'Appenzell I.' },
  { code:'AR', name:'Appenzell A.' }, { code:'BE', name:'Bern' },
  { code:'BL', name:'Basel-Land' },   { code:'BS', name:'Basel-Stadt' },
  { code:'FR', name:'Fribourg' },     { code:'GE', name:'Genève' },
  { code:'GL', name:'Glarus' },       { code:'GR', name:'Graubünden' },
  { code:'JU', name:'Jura' },         { code:'LU', name:'Luzern' },
  { code:'NE', name:'Neuchâtel' },    { code:'NW', name:'Nidwalden' },
  { code:'OW', name:'Obwalden' },     { code:'SG', name:'St. Gallen' },
  { code:'SH', name:'Schaffhausen' }, { code:'SO', name:'Solothurn' },
  { code:'SZ', name:'Schwyz' },       { code:'TG', name:'Thurgau' },
  { code:'TI', name:'Ticino' },       { code:'UR', name:'Uri' },
  { code:'VD', name:'Vaud' },         { code:'VS', name:'Valais' },
  { code:'ZG', name:'Zug' },          { code:'ZH', name:'Zürich' },
]

// ── AD CATEGORIES ──────────────────────────────────────────────
export const AD_CATS = [
  { id:'vivienda',   emoji:'🏠', label:'Vivienda',   desc:'Pisos, habitaciones y compañeros',  types:['busca','ofrece'],           sub:['Se busca piso','Se busca habitación','Se ofrece piso','Se ofrece habitación','Compañero/a piso','Sublet temporal'] },
  { id:'servicios',  emoji:'🔧', label:'Servicios',   desc:'Limpieza, clases, mudanzas y más',  types:['busca','ofrece'],           sub:['Limpieza','Cocina','Reparaciones','Mudanza','Clases','Peluquería','Mecánico','Informática','Otro'] },
  { id:'cuidados',   emoji:'❤️', label:'Cuidados',    desc:'Niños, mayores, au pair y asistencia', types:['busca','ofrece'],        sub:['Cuidado niños','Cuidado mayores','Au pair','Asistencia'] },
  { id:'venta',      emoji:'🛍️', label:'Mercado',     desc:'Compra, vende o regala artículos',  types:['busca','ofrece','regala'],  sub:['Electrónica','Ropa','Muebles','Comida','Otro'] },
  { id:'documentos', emoji:'📋', label:'Legal',       desc:'Trámites, traducción y asesoría',   types:['busca','ofrece'],           sub:['Cartas','Trámites','Traducción','Asesoría'] },
  { id:'empleo',     emoji:'💼', label:'Empleo',      desc:'Ofertas y búsqueda de trabajo',     types:['busca','ofrece'],           sub:['Full-time','Part-time','Freelance','Prácticas'] },
]

export function normalizeAdCat(cat='') {
  return cat === 'hogar' ? 'servicios' : cat
}

export function getAdCat(cat='') {
  return AD_CATS.find(item => item.id === normalizeAdCat(cat))
}

export const AD_TYPES = [
  { id:'busca',  emoji:'🔍', label:'Busco / Necesito',  desc:'Estás buscando algo o a alguien' },
  { id:'ofrece', emoji:'✨', label:'Ofrezco / Tengo',    desc:'Ofreces un servicio o producto' },
  { id:'vende',  emoji:'🏷️', label:'Vendo',              desc:'Quieres vender algo' },
  { id:'regala', emoji:'🎁', label:'Regalo',             desc:'Das algo gratis' },
]

// ── COMMUNITY CATEGORIES ───────────────────────────────────────
export const COMMUNITY_CATS = [
  { id:'pais',         emoji:'🌎', label:'Por país de origen' },
  { id:'mamas',        emoji:'👩‍👧', label:'Mamás latinas' },
  { id:'deporte',      emoji:'⚽', label:'Deportes' },
  { id:'profesional',  emoji:'💼', label:'Profesionales' },
  { id:'idioma',       emoji:'🗣️', label:'Idiomas' },
  { id:'fe',           emoji:'🙏', label:'Fe & Espiritualidad' },
  { id:'gastronomia',  emoji:'🍳', label:'Gastronomía' },
  { id:'voluntariado', emoji:'❤️', label:'Voluntariado' },
]

// ── EVENT CATEGORIES ───────────────────────────────────────────
export const EVENT_CATS = [
  { id:'dj',         emoji:'🎵', label:'DJ & Música' },
  { id:'fotografia', emoji:'📸', label:'Fotografía & Video' },
  { id:'catering',   emoji:'🍽️', label:'Catering & Comida' },
  { id:'reposteria', emoji:'🎂', label:'Repostería' },
  { id:'decoracion', emoji:'🎪', label:'Decoración' },
  { id:'animacion',  emoji:'💃', label:'Animación & Shows' },
  { id:'musica',     emoji:'🎸', label:'Música en Vivo' },
  { id:'transporte', emoji:'🚐', label:'Transporte' },
]

export const PRICE_RANGES = [
  { id:'bajo',  label:'Económico',  desc:'Hasta CHF 500',  color:'bg-green-100 text-green-700' },
  { id:'medio', label:'Moderado',   desc:'CHF 500–1500',   color:'bg-yellow-100 text-yellow-700' },
  { id:'alto',  label:'Premium',    desc:'CHF 1500+',      color:'bg-purple-100 text-purple-700' },
]

export const EVENT_TYPES = [
  'Quinceañera','Boda','Bautizo','Cumpleaños','Fiesta de empresa',
  'Graduación','Reunión cultural','Otro',
]

// ── MOCK DATA ──────────────────────────────────────────────────
export const MOCK_ADS = [
  { id:'a1', cat:'vivienda',   sub:'Se busca piso',         title:'Busco habitación en Zürich',              desc:'Mujer 32 años, trabajo estable, no fumo. Zona Zürich o alrededores. Máximo CHF 950.',              user:'María C.',   canton:'ZH', plz:'8001', price:'hasta CHF 950/mes', type:'busca',  privacy:'private', verified:true,  ts:'Hace 2h',   img:null },
  { id:'a2', cat:'cuidados',   sub:'Cuidado niños',         title:'Ofrezco cuidado de niños tardes',          desc:'Maestra con 8 años de exp. Lunes a viernes 15:00–19:00. Referencias disponibles.',               user:'Ana R.',     canton:'BE', plz:'3001', price:'CHF 22/h',         type:'ofrece', privacy:'public',  verified:true,  ts:'Hace 4h',   img:null,  contact_phone:'+41 79 234 56 78' },
  { id:'a3', cat:'venta',      sub:'Electrónica',           title:'iPhone 13 128GB — perfecto estado',        desc:'Caja original, cargador incluido. Sin golpes ni rayones. Precio negociable.',                    user:'Carlos M.',  canton:'GE', plz:'1201', price:'CHF 450',           type:'vende',  privacy:'public',  verified:false, ts:'Hace 5h',   img:'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&h=260&fit=crop', contact_phone:'+41 78 345 67 89' },
  { id:'a4', cat:'servicios',  sub:'Limpieza',              title:'Limpieza profesional de pisos',             desc:'Servicio de limpieza profunda o mantenimiento semanal. Productos incluidos.',                    user:'Rosa P.',    canton:'BS', plz:'4001', price:'CHF 30/h',         type:'ofrece', privacy:'private', verified:true,  ts:'Hace 6h',   img:null },
  { id:'a5', cat:'documentos', sub:'Cartas',                title:'Ayudo con cartas en alemán suizo',          desc:'Traduzco y explico cartas oficiales suizas. 6 años viviendo aquí. Respondo en 24h.',             user:'Diego F.',   canton:'ZH', plz:'8050', price:'CHF 15/carta',     type:'ofrece', privacy:'public',  verified:false, ts:'Ayer',      img:null,  contact_email:'tramites.diego@gmail.com' },
  { id:'a6', cat:'regalo',     sub:'Muebles',               title:'Regalo sofá 3 plazas — Bern',               desc:'Sofá gris en buen estado. Solo para recoger esta semana. Primera persona que responda.',          user:'Lucia T.',   canton:'BE', plz:'3011', price:'Gratis',           type:'regala', privacy:'public',  verified:true,  ts:'Ayer',      img:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=260&fit=crop', contact_phone:'+41 76 456 78 90' },
  { id:'a7', cat:'servicios',  sub:'Clases',                title:'Clases de español para suizos',             desc:'Profesora nativa. Principiantes y avanzados. Online o presencial en Lausana.',                  user:'Valentina B.',canton:'VD',plz:'1000', price:'CHF 40/h',         type:'ofrece', privacy:'private', verified:true,  ts:'Hace 2d',   img:null },
  { id:'a8', cat:'vivienda',   sub:'Se ofrece habitación',  title:'Habitación en piso compartido Ginebra',    desc:'2 latinos, ambiente tranquilo. Incluye wifi y acceso a cocina. Disponible 1 de mayo.',            user:'Pablo G.',   canton:'GE', plz:'1204', price:'CHF 800/mes',      type:'ofrece', privacy:'public',  verified:false, ts:'Hace 2d',   img:null },
  { id:'a9', cat:'cuidados',   sub:'Cuidado mayores',       title:'Busco cuidadora para mi madre (73)',        desc:'Mi madre necesita compañía y ayuda diaria. Español esencial. Zona Zug.',                         user:'Roberto L.', canton:'ZG', plz:'6300', price:'CHF 25/h',         type:'busca',  privacy:'private', verified:true,  ts:'Hace 3d',   img:null },
  { id:'a10',cat:'servicios',  sub:'Reparaciones',          title:'Hago reparaciones del hogar',               desc:'Plomería, electricidad básica, pintura. 10 años de experiencia en Suiza.',                      user:'Jorge S.',   canton:'AG', plz:'5001', price:'CHF 50/h',         type:'ofrece', privacy:'public',  verified:false, ts:'Hace 3d',   img:null },
]

export const MOCK_COMMUNITIES = [
  { id:'c1', name:'Colombianos en Zürich',      cat:'pais',       city:'Zürich',     members:342, emoji:'🇨🇴', verified:true,  desc:'La comunidad más grande de colombianos en Suiza.', contact:'https://chat.whatsapp.com/ejemplo' },
  { id:'c2', name:'Mamás Latinas Suiza',        cat:'mamas',      city:'Toda Suiza', members:891, emoji:'👩‍👧', verified:true,  desc:'Red de madres latinoamericanas. Crianza y apoyo mutuo.', contact:'https://t.me/mamaslatinasch' },
  { id:'c3', name:'Venezolanos en Suiza',       cat:'pais',       city:'Toda Suiza', members:523, emoji:'🇻🇪', verified:true,  desc:'Comunidad venezolana unida. Asesoría, trabajo y vivienda.', contact:'https://t.me/venezusuiza' },
  { id:'c4', name:'Fútbol Latino Ginebra',      cat:'deporte',    city:'Ginebra',    members:156, emoji:'⚽', verified:false, desc:'Liga amateur de fútbol para latinos. Partidos cada domingo.', contact:'https://chat.whatsapp.com/ejemplo' },
  { id:'c5', name:'Profesionales Latinos CH',   cat:'profesional',city:'Toda Suiza', members:267, emoji:'💼', verified:true,  desc:'Red de profesionales latinoamericanos. Networking y mentoring.', contact:'https://chat.whatsapp.com/ejemplo' },
  { id:'c6', name:'Aprende Alemán con Latinos', cat:'idioma',     city:'Zürich',     members:198, emoji:'🇩🇪', verified:false, desc:'Práctica de alemán para hispanohablantes. Clases peer-to-peer.', contact:'https://t.me/alemanlatinoch' },
  { id:'c7', name:'Fe Latina Suiza',            cat:'fe',         city:'Toda Suiza', members:445, emoji:'🙏', verified:true,  desc:'Comunidad cristiana latina. Cultos y grupos de estudio.', contact:'https://chat.whatsapp.com/ejemplo' },
  { id:'c8', name:'Gastronomía Latina CH',      cat:'gastronomia',city:'Toda Suiza', members:334, emoji:'🍳', verified:false, desc:'Recetas, ingredientes latinos y cenas comunitarias.', contact:'https://t.me/gastrolatinoch' },
]

export const MOCK_DOCS = [
  { id:'d1', emoji:'📄', cat:'permisos',  title:'Tipos de permiso de residencia',       summary:'Diferencias entre L, B, C y G, y ventajas especiales si eres ciudadano UE.',  time:'8 min', level:'Básico', img:'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=900&h=600&fit=crop',
    content:'**¿Eres ciudadano de la UE/AELE (p.ej. España)?**\nEstás cubierto por el Acuerdo de Libre Circulación de Personas (ALCP) entre Suiza y la UE. Proceso más sencillo:\n• Permiso B UE/AELE — Válido 5 años si tienes contrato de trabajo (o 1 año si buscas empleo). Renovable automáticamente mientras trabajes.\n• Permiso C — Tras 5 años continuados con permiso B. Se concede casi automáticamente sin exigir nivel de idioma ni prueba de integración.\n• No necesitas demostrar conocimientos de alemán para renovar ni para pasar al C.\n\n**¿Eres ciudadano de fuera de la UE/AELE (países latinoamericanos)?**\nEl proceso es más estricto:\n• Permiso B — Válido 1 año, renovable. Necesitas contrato de trabajo vigente. Después de 5 años puedes pedir el C, pero se exige nivel de idioma (A2–B1 según el cantón) y prueba de integración.\n• Permiso C — Residencia permanente. Tras 5–10 años con B. No vinculado al empleador.\n• Permiso L — Corta duración, menos de 1 año. Para contratos temporales.\n• Permiso G — Para trabajadores fronterizos. Vives en país vecino (Francia, Italia, Austria, Alemania) y trabajas en Suiza.\n\n**¿Dónde tramitarlo?**\nEn el Migrationsamt (o Amt für Migration) de tu cantón. Lleva pasaporte, contrato de trabajo y Anmeldung (registro municipal).' },
  { id:'d2', emoji:'🧾', cat:'impuestos', title:'Quellensteuer vs Imposición ordinaria', summary:'¿Estás pagando impuestos de más? Descúbrelo aquí.',                       time:'6 min', level:'Medio', img:'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&h=600&fit=crop',
    content:'**Quellensteuer** — Se descuenta automáticamente de tu salario si tienes permiso B.\n\n**¿Cuándo conviene la imposición ordinaria?**\n• Salario anual > CHF 120.000\n• Tienes gastos deducibles importantes\n• Tu cónyuge también trabaja\n\n**Cómo solicitarlo**\nAntes del 31 de marzo en el Steueramt de tu cantón.\n\n⚠️ Muchos hispanohablantes en Suiza pagan de más sin saberlo.' },
  { id:'d3', emoji:'🏥', cat:'salud',     title:'Cómo elegir tu Krankenkasse',           summary:'Obligatorio. Ahorra hasta CHF 1.000/año eligiendo bien.',                time:'5 min', level:'Básico', img:'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=900&h=600&fit=crop',
    content:'El seguro médico es **obligatorio** dentro de los 3 meses de llegar.\n\n**Primas:** CHF 250–550+/mes según cantón y aseguradora.\n\n**Franquicia (Franchise):** Cuanto mayor, menor prima. Opciones: CHF 300, 500, 1000, 1500, 2000, 2500.\n\n**Comparadores:** Priminfo.ch · Comparis.ch · Bonus.ch\n\n**Reducción de prima:** Si tu ingreso es bajo, ¡solicítala en tu cantón!' },
  { id:'d4', emoji:'🏦', cat:'banco',     title:'Abrir cuenta bancaria sin referencias', summary:'El banco más fácil y alternativas digitales para recién llegados.',       time:'4 min', level:'Básico', img:'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=900&h=600&fit=crop',
    content:'**PostFinance** — El más accesible. Solo necesitas permiso + pasaporte.\n\n**Alternativas digitales (sin burocracia):**\n• Neon — 100% digital, sin comisiones\n• Wise — Para enviar dinero a casa sin comisiones\n• Yuh — Para principiantes\n\n**Documentos típicos:** Pasaporte · Permiso de residencia · Anmeldung (registro municipal)' },
  { id:'d5', emoji:'🎓', cat:'educacion', title:'Guarderías (Kitas) y escuelas',          summary:'Cómo acceder, costes, subvenciones y listas de espera.',                  time:'7 min', level:'Básico', img:'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=900&h=600&fit=crop',
    content:'**Kinderkrippe (Kita):** Para 0–4 años. CHF 80–180 por día según cantón e ingresos.\n\n**Cómo inscribir:**\n1. Busca Kitas en kitas.ch o el sitio de tu municipio\n2. Apúntate en lista de espera cuanto antes (6–12 meses)\n3. Solicita reducción de tarifa según tu salario\n\n**Escuelas bilingües:** Algunos cantones ofrecen programas español-alemán/francés. Pregunta en la Schulamt de tu canton.' },

  { id:'d6', emoji:'🇩🇪', cat:'educacion', title:'Dónde aprender alemán en Suiza', summary:'Las mejores escuelas, apps y cursos gratis o baratos para hispanohablantes.', time:'8 min', level:'Básico', img:'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&h=600&fit=crop',
    content:'Aprender alemán es clave para integrarse, renovar permisos y acceder a mejores empleos. Nivel A2–B1 suele exigirse para el permiso C.\n\n**Escuelas presenciales más recomendadas**\n\n• **Migros Klubschule** (klubschule.ch) — La opción más popular en Suiza. Cursos A1 a C2 en casi todas las ciudades. Precios: CHF 400–900 por semestre (~40 horas). Horarios flexibles, mañana y noche. Muy recomendada.\n\n• **Volkshochschule (VHS)** — Centros públicos de educación de adultos. Precios más bajos: CHF 200–500 por semestre. Busca la VHS de tu cantón en volkshochschule.ch.\n\n• **inlingua** (inlingua.ch) — Escuela privada con sedes en Zürich, Bern, Ginebra. Ideal si necesitas intensivos o preparación para exámios oficiales (Goethe, TELC, ÖSD).\n\n• **Berlitz** (berlitz.ch) — Presencia en ciudades principales. Más caro (CHF 800–2.000+) pero con tutores personalizados.\n\n**Cursos de integración subvencionados**\nMuchos cantones ofrecen cursos gratuitos o con subsidio para titulares de permiso B/C recién llegados. Consulta la Fachstelle Integration de tu cantón.\n\n**Opciones gratuitas online**\n• Deutsche Welle — dw.com/de/deutsch-lernen — Cursos A1–C1 gratuitos con audio, vídeo y ejercicios.\n• Duolingo — Gratuito. Bueno para empezar.\n• Babbel — CHF 6–10/mes. Más estructurado.\n\n**Consejo práctico:** Combina una escuela local (para practicar con gente real) con Deutsche Welle (para casa). En 6 meses de constancia, alcanzarás el A2.' },

  { id:'d7', emoji:'👨‍👩‍👧', cat:'permisos', title:'Reagrupación familiar en Suiza', summary:'Cómo traer a tu pareja e hijos a Suiza. Diferencias entre ciudadanos UE y no UE.', time:'9 min', level:'Medio', img:'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=900&h=600&fit=crop',
    content:'La reagrupación familiar permite traer a tu cónyuge e hijos menores de 18 años a Suiza. Las condiciones varían mucho según tu nacionalidad.\n\n**Si eres ciudadano UE/AELE (p.ej. España)**\nTienes derecho a la reagrupación desde el primer día, sin espera de 1 año. Solo necesitas:\n• Demostrar que dispones de vivienda adecuada\n• Que el familiar tenga relación documentada contigo (matrimonio, filiación)\nNo se exige nivel de ingresos mínimo como requisito formal, aunque la vivienda adecuada es obligatoria. El proceso es más ágil: 1–3 meses normalmente.\n\n**Si eres ciudadano de fuera de la UE/AELE (países latinoamericanos)**\nEl proceso es más exigente:\n• Titulares de permiso B: deben llevar al menos 1 año en Suiza y demostrar ingresos suficientes (aprox. CHF 2.500–3.500/mes neto para familia de 3, varía por cantón).\n• Titulares de permiso C: pueden solicitarla en cualquier momento, sin espera.\n• Plazo de respuesta: 3–6 meses.\n\n⚠️ Los hijos mayores de 12 años provenientes de fuera de la UE pueden necesitar demostrar capacidad de integración según el cantón.\n\n**Documentos necesarios (todos)**\n• Acta de matrimonio o nacimiento\n• Si son de fuera de la UE: con Apostilla de La Haya + traducción oficial al alemán/francés\n• Si son de España (UE): el apostillado simplifica el trámite\n• Pasaportes vigentes\n• Contrato de arrendamiento\n• Últimas 3 nóminas\n\n**¿Dónde solicitarlo?**\nEn el Migrationsamt de tu cantón.' },

  { id:'d8', emoji:'💰', cat:'impuestos', title:'AHV/AVS: tu pensión y cómo funciona', summary:'Cotizaciones obligatorias, jubilación y cómo recuperar tu dinero si te vas.', time:'7 min', level:'Medio', img:'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=900&h=600&fit=crop',
    content:'El sistema de pensiones suizo tiene 3 pilares. El primero es la AHV (Alters- und Hinterlassenenversicherung / AVS en francés): obligatorio para todos.\n\n**¿Cuánto cotizas?**\nLa cotización total AHV/IV/EO es del 10,6% de tu salario bruto. El empleador paga el 5,3% y tú el otro 5,3%. Se descuenta automáticamente de tu nómina.\n\n**¿Desde cuándo cotizas?**\n• Si trabajas: desde los 17 años.\n• Si no trabajas (o trabajas menos de CHF 2.300/año): desde los 21 años debes cotizar como "no empleado".\n\n**Jubilación**\nEdad de jubilación: 65 años para hombres y mujeres (desde 2028 tras la reforma AHV 21). La pensión mínima en 2024 es CHF 1.225/mes; la máxima CHF 2.450/mes.\n\n**¿Puedo recuperar mis cotizaciones si me voy?**\n• Si eres de Latinoamérica y regresas a tu país: sí, en la mayoría de casos puedes pedir el reembolso a la ZAS (Zentrale Ausgleichsstelle) en Ginebra. Excepción: Chile tiene acuerdo bilateral con Suiza y sus ciudadanos no pueden pedir el reembolso.\n• Si eres de España (UE/AELE): NO puedes recuperar las cotizaciones al irte. Se mantienen como derechos de pensión futura (se coordina con la Seguridad Social española).\n\n**Segundo y tercer pilar (3a)**\nSon voluntarios/ocupacionales y complementan la AHV. El 3a te permite ahorrar con ventaja fiscal hasta CHF 7.056/año (2024).' },

  { id:'d9', emoji:'🏠', cat:'vivienda', title:'Cómo encontrar piso en Suiza', summary:'Plataformas, el dossier que necesitas y errores comunes a evitar.', time:'8 min', level:'Básico', img:'https://images.unsplash.com/photo-1501183638710-841dd1904471?w=900&h=600&fit=crop',
    content:'Encontrar piso en Suiza es competitivo, especialmente en Zürich, Ginebra y Basilea. Con un buen dossier, tus posibilidades aumentan mucho.\n\n**Plataformas principales**\n• homegate.ch — La más usada en Suiza\n• immoscout24.ch — Gran oferta en ciudades\n• flatfox.ch — Buena interfaz, popular entre jóvenes\n• comparis.ch — También agrega anuncios de otras webs\n• wgzimmer.ch — Para habitaciones en pisos compartidos\n\n**El dossier (lo más importante)**\nLos arrendadores suizos exigen un dossier completo:\n1. Carta de presentación breve (en alemán si es cantón alemán)\n2. Copia del pasaporte y permiso de residencia\n3. Últimas 3 nóminas\n4. Betreibungsauszug (extracto del registro de deudas) — cuesta CHF 17–25, se obtiene en tu municipio. Es el documento más importante. Sin deudas = candidato serio.\n5. Referencia del arrendador anterior (si tienes)\n\n**Depósito de garantía**\nMáximo 3 meses de renta. Se ingresa en una cuenta bancaria bloqueada a tu nombre (Mietkautionskonto). Puedes usar PostFinance.\n\n**Costes adicionales (Nebenkosten)**\nCalefacción, agua y a veces electricidad se cobran aparte: CHF 100–250/mes según el piso.\n\n**Consejo:** Postúlate el mismo día que sale el anuncio. El primer visitante con dossier completo suele ganar.' },

  { id:'d10', emoji:'💼', cat:'trabajo', title:'Tus derechos laborales en Suiza', summary:'Vacaciones, despido, bajas por enfermedad y salario mínimo — todo lo que debes saber.', time:'9 min', level:'Básico', img:'https://diamondasesores.com/wp-content/uploads/2022/08/Portada-Derecho-Laboral-principal-copia.jpg',
    content:'Suiza protege bien al trabajador, pero hay que conocer los derechos para exigirlos.\n\n**Vacaciones**\nMínimo legal: 4 semanas (20 días) al año. 5 semanas si eres menor de 20 años. Muchos convenios colectivos ofrecen 5 semanas a todos.\n\n**Periodos de preaviso (Kündigungsfrist)**\n• Primer año: 1 mes\n• Años 2–9: 2 meses\n• A partir del año 10: 3 meses\nDurante el periodo de prueba (máx. 3 meses): 7 días.\n\n**Baja por enfermedad**\nEl empleador debe pagar el salario durante la enfermedad. La duración aumenta con los años de servicio (escala de Bern): 3 semanas el primer año, hasta varios meses en empleados veteranos. Muchas empresas tienen seguro colectivo que cubre hasta 720 días (80% del salario).\n\n**Salario mínimo**\nNo existe salario mínimo federal. Pero sí hay mínimos cantonales: Ginebra CHF 24/h (el más alto del mundo, 2024), Ticino CHF 19,75/h, Neuchâtel CHF 20,80/h, Basilea-Ciudad CHF 21/h, Jura CHF 20,60/h, Valais CHF 18,27/h.\n\n**13.° sueldo**\nEs muy habitual en Suiza. Si tu contrato lo incluye (pregunta siempre), cobras un mes extra repartido o en diciembre.\n\n**Horas extraordinarias**\nDeben compensarse con tiempo libre o con un 25% de recargo si hay acuerdo escrito.\n\n⚠️ Si tienes problemas laborales, el Arbeitsgericht (tribunal laboral) es gratuito para reclamaciones.' },

  { id:'d11', emoji:'💸', cat:'banco', title:'Enviar dinero a España y Latinoamérica', summary:'SEPA para España (casi gratis) y las mejores remesas para Latinoamérica en 2024.', time:'5 min', level:'Básico', img:'https://images.unsplash.com/photo-1556740749-887f6717d7e4?w=900&h=600&fit=crop',
    content:'Los bancos tradicionales suizos son la peor opción para enviar dinero. Hay alternativas mucho más baratas según el destino.\n\n**Si envías a España (zona Euro — SEPA)**\nEspaña forma parte del área SEPA, igual que Suiza. Esto significa que una transferencia bancaria normal de CHF a EUR es casi gratuita o muy barata:\n• Con Neon, Wise o PostFinance: transferencias SEPA por CHF 0–2.\n• El tipo de cambio CHF/EUR es muy competitivo (diferencia mínima).\n• Llega en 1 día hábil.\nConsejo: si tienes cuenta en Neon o Wise, enviar a un IBAN español es prácticamente gratis.\n\n**Si envías a Latinoamérica**\nNo hay SEPA — necesitas servicios especializados:\n\n• **Wise** (recomendado) — Tasa de cambio interbancaria real + comisión baja: CHF 2–8 por transferencia. El más transparente. wise.com\n\n• **Remitly** — Especializado en Latinoamérica. Buenas tasas y envío en minutos. Primera transferencia suele ser sin comisión. remitly.com\n\n• **Western Union / MoneyGram** — Accesibles (también en oficinas PostFinance físicas). Comisiones más altas (2–5%) y peor cambio. Útil si el destinatario no tiene cuenta bancaria.\n\n• **Transferencia bancaria SWIFT (evitar)** — Los bancos suizos cobran CHF 15–40 fijos + mal tipo de cambio. Solo úsala si es obligatorio.\n\n**Comparador en tiempo real:** monito.com — compara todos los servicios antes de enviar.\n\nConsejo: envía cantidades mayores y menos frecuentes para amortizar las comisiones fijas. CHF 500 de una vez sale más barato que 5 × CHF 100.' },

  { id:'d13', emoji:'🚗', cat:'permisos', title:'Carnet de conducir en Suiza', summary:'Canje directo si eres de la UE, proceso completo si eres de Latinoamérica — todo explicado.', time:'10 min', level:'Medio', img:'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=900&h=600&fit=crop',
    content:'El proceso para obtener el carnet suizo depende de dónde viene tu carnet actual.\n\n━━━━━━━━━━━━━━━━━━━━━━\n🇪🇺 SI TIENES CARNET ESPAÑOL (UE/AELE)\n━━━━━━━━━━━━━━━━━━━━━━\n\nPuedes canjear tu carnet español directamente por uno suizo sin hacer ningún examen. Es un trámite administrativo.\n\n**¿Cuánto tiempo tienes?**\nPuedes conducir con tu carnet español mientras sea válido. Una vez residente en Suiza, se recomienda canjearlo en el Strassenverkehrsamt de tu cantón en cuanto puedas.\n\n**Cómo hacer el canje**\n1. Ve al Strassenverkehrsamt de tu cantón con: carnet español original, pasaporte o DNI, permiso de residencia y Anmeldung.\n2. Entregas tu carnet español (lo devuelven a las autoridades españolas).\n3. Recibes el carnet suizo en 1–2 semanas.\nCoste: ~CHF 60–120 según cantón.\n\n⚠️ Una vez canjeado, el carnet suizo tiene período de prueba de 3 años si llevas menos de 3 años con el carnet español.\n\n━━━━━━━━━━━━━━━━━━━━━━\n🌎 SI TIENES CARNET LATINOAMERICANO\n━━━━━━━━━━━━━━━━━━━━━━\n\nLos países latinoamericanos no tienen acuerdo de canje con Suiza. Debes hacer el proceso completo.\n\n**¿Cuánto tiempo puedes conducir con tu carnet extranjero?**\n12 meses desde la fecha de tu Anmeldung. Después, tu carnet deja de ser válido en Suiza. Planifica con tiempo.\n\n⚠️ Si tu carnet no está en alemán, francés o inglés, lleva siempre un Permiso Internacional de Conducir (IDP). Se obtiene en el Strassenverkehrsamt por ~CHF 25.\n\n**El proceso completo paso a paso**\n\n1. Nothelferkurs (Primeros Auxilios) — 6 horas. Cruz Roja u autoescuelas. CHF 100–200. Válido 6 años.\n\n2. Test de visión — En cualquier óptica. ~CHF 15.\n\n3. Lernfahrausweis (Permiso de Aprendizaje) — En el Strassenverkehrsamt. Documentos: pasaporte, permiso, Anmeldung, certificado Nothelferkurs, foto, test de visión. CHF 60–120. Plazo: 1–2 semanas.\n\n4. Theorieprüfung (Examen de Teoría) — 50 preguntas en ordenador, 45 min. Nota mínima 135/150. Disponible en inglés. Coste: ~CHF 35. Practica gratis en itheorie.ch.\n\n5. VKU (Educación Vial, 8h) — Curso obligatorio en autoescuela sobre conducción defensiva. Sin examen, solo asistencia. CHF 150–250.\n\n6. Clases prácticas — Con instructor certificado. Habitualmente 40–60 horas. CHF 80–120/lección de 45 min.\n\n7. Führerprüfung (Examen Práctico) — ~50 min con examinador oficial. CHF 120–135.\n\n8. Führerausweis auf Probe (Carnet de Prueba) — Válido 3 años. Alcohol cero (0,0‰). Una infracción grave = suspensión mínima de 1 año.\n\n9. WAB (Curso Avanzado, 1 día) — Obligatorio dentro de los 12 meses tras aprobar el práctico. CHF 290–550. Sin él, no obtienes el carnet definitivo.\n\n10. Carnet definitivo — Tras 3 años sin infracciones graves, se convierte automáticamente. Válido 15 años.\n\n**Coste total estimado (proceso completo)**\n• Mínimo: CHF 3.200 · Media: CHF 4.500–5.500 · Máximo: CHF 7.000+\n\n**Consejos**\n• Empieza dentro de los 3 primeros meses — no esperes al mes 11.\n• Busca autoescuelas con instructores que hablen español (las hay en Zürich, Ginebra y Basilea).\n• El Strassenverkehrsamt de tu cantón es la autoridad competente para todo.' },

  { id:'d14', emoji:'🏢', cat:'trabajo', title:'Empresas de trabajo temporal en Suiza', summary:'Cómo registrarte, qué agencias buscar y cómo conseguir tu primer trabajo en Suiza.', time:'9 min', level:'Básico', img:'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900&h=600&fit=crop',
    content:'Las empresas de trabajo temporal (Temporärbüros) son una de las vías más rápidas para conseguir tu primer empleo en Suiza, especialmente si aún no tienes experiencia local o referencias suizas.\n\n**¿Cómo funcionan?**\nTe registras en la agencia, ellos buscan empresas que necesitan personal y te proponen misiones (encargos temporales). Tú trabajas para la empresa cliente, pero la agencia es tu empleador oficial: te paga el sueldo, descuenta la AHV/ALV y gestiona el contrato.\n\nLas misiones pueden durar días, semanas o meses. Muchas acaban en contrato fijo si gustas al cliente.\n\n**¿Qué permiso necesito?**\n• Permiso B, C o L — Todas las agencias serias trabajan contigo.\n• Permiso F o N (solicitantes de asilo) — Algunas agencias especializadas trabajan con estos permisos según el cantón.\n• Sin permiso — No es posible trabajar legalmente. La agencia te pedirá siempre el permiso antes de colocarte.\n\n**Las principales agencias en Suiza**\n\n• **Adecco** (adecco.ch) — La más grande de Suiza. Oficinas en todas las ciudades. Todos los sectores: logística, industria, administración, hostelería, IT. Registro online o presencial.\n\n• **Randstad** (randstad.ch) — Segunda agencia en volumen. Fuerte en industria, logística y oficina. Muy activa en Zürich, Berna y Basilea.\n\n• **Manpower** (manpower.ch) — Internacional con fuerte presencia en Suiza. Buena para perfiles técnicos y de manufactura.\n\n• **Unique** (unique.ch) — Agencia suiza. Muy activa en hostelería, limpieza, logística y cuidados. Una de las más accesibles para recién llegados.\n\n• **Gi Group** (gigroup.ch) — Especializada en industria, almacén y producción. Tiene equipos que hablan varios idiomas.\n\n• **Synergie** (synergie.ch) — Especialmente fuerte en Suiza romanda (Ginebra, Lausana, Neuchâtel). Buena para perfiles de hostelería y servicios.\n\n• **Kelly Services** (kellyservices.ch) — Enfocada en administración, finanzas y ciencias. Perfil más oficinista.\n\n• **Hays** (hays.ch) — Especializada en IT, ingeniería, finanzas y sanidad. Para perfiles cualificados.\n\n• **Careerplus** (careerplus.ch) — Agencia suiza con buena red de PMEs locales.\n\n**Portal oficial del Estado:**\n• **RAV / ORP** — Las Oficinas Regionales de Colocación cantonales (Regionale Arbeitsvermittlung) son gratuitas y ayudan a buscar empleo. También gestionan el paro (ALV). Encuéntrate la tuya en trouvetravail.ch.\n\n**Sectores con más demanda para hispanohablantes**\n• Hostelería y restauración (Gastgewerbe)\n• Limpieza y facility services\n• Logística, almacén y producción\n• Cuidados y trabajo social (con diploma)\n• Construcción y reformas\n• Servicios domésticos\n• Atención al cliente (si hablas alemán/francés)\n\n**Cómo registrarte paso a paso**\n1. Prepara: pasaporte o DNI, permiso de residencia vigente, CV en alemán o francés (1 página), diploma o certificados si los tienes.\n2. Busca la oficina más cercana en la web de la agencia o regístrate online.\n3. En la primera entrevista te evaluarán: idiomas, experiencia, disponibilidad horaria.\n4. Queda disponible: cuanto más flexible seas (horarios, ubicación, sectores), más rápido te colocan.\n5. Una vez en misión: cumple los horarios, comunica problemas a la agencia (no al cliente), y registra tus horas en la hoja oficial que te dan.\n\n**Derechos como trabajador temporal**\nAunque seas temporal, tienes los mismos derechos básicos que cualquier empleado suizo:\n• Salario igual al del sector (los CCT — Convenios Colectivos de Trabajo — se aplican también a temporales).\n• AHV, ALV, accidente y enfermedad cubiertos desde el primer día.\n• Vacaciones proporcionales a los días trabajados.\n• Protección contra despido abusivo.\n\n⚠️ Desconfía de agencias que te piden dinero por registrarte o colocarte. En Suiza esto es ilegal. Las agencias legales cobran solo a las empresas, nunca al trabajador.\n\n**Consejo práctico:** Regístrate en 3–4 agencias a la vez para multiplicar tus posibilidades. Actualiza tu disponibilidad regularmente y responde rápido cuando te llamen — las misiones se llenan en horas.' },

  { id:'d12', emoji:'🎓', cat:'educacion', title:'Convalidar tu título universitario en Suiza', summary:'UE vs. Latinoamérica: quién tiene reconocimiento automático y quién debe tramitarlo.', time:'8 min', level:'Medio', img:'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=900&h=600&fit=crop',
    content:'Suiza no tiene un sistema único de reconocimiento: depende de si tu título es de la UE o de fuera, y de si tu profesión está regulada o no.\n\n**Si tu título es de España (UE)**\nLos títulos universitarios de la UE tienen reconocimiento facilitado en Suiza gracias a los acuerdos bilaterales CH-UE. Para profesiones no reguladas, el empleador suele aceptarlos directamente. Para profesiones reguladas, el proceso es más rápido y con menos documentación que para países fuera de la UE.\n\n**Si tu título es de Latinoamérica (fuera de la UE)**\nNo hay reconocimiento automático. El proceso depende del tipo de profesión.\n\n**Profesiones NO reguladas (la mayoría)**\nInformática, marketing, administración, diseño, comunicación… El empleador decide si acepta tu título. No necesitas trámite oficial.\n\n**Profesiones reguladas (requieren reconocimiento oficial)**\n• Medicina y odontología → MedReg (medregom.admin.ch)\n• Enfermería → Cruz Roja Suiza (sbk-asi.ch)\n• Farmacia → Swissmedic\n• Arquitectura e ingeniería → Colegios profesionales cantonales\n• Docencia → Cantón (Erziehungsdirektion)\n• Derecho → No reconocible directamente (sistema jurídico muy diferente en ambos casos)\n\n**¿Dónde empezar?**\nPlataforma oficial: enic-naric.net → selecciona Suiza → te guía según país de origen y profesión.\n\n**Documentos para títulos de fuera de la UE**\n• Título original + traducción jurada al alemán/francés/italiano\n• Expediente académico completo\n• Descripción del plan de estudios\n• Apostilla de La Haya en todos los documentos\n\n**Documentos para títulos españoles (UE)**\n• Título original (o copia compulsada)\n• Traducción al alemán/francés si el cantón lo exige\n• Apostilla no siempre necesaria entre países UE-Suiza\n\n**Plazo:** 2–4 meses para títulos UE · 3–6 meses para títulos latinoamericanos.\n\n⚠️ Los títulos de medicina (tanto latinoamericanos como españoles) requieren examen de equivalencia (Eignungsprüfung) si no hay reconocimiento automático cantonal.' },
]

export const MOCK_PROVIDERS = [
  { id:'p1', name:'Foto & Film Latino',     cat:'fotografia',city:'GE', description:'Especialistas en quinceañeras y bodas. Álbum digital + video.', services:['Fotografía','Video','Drone'],             price_range:'alto',  whatsapp:'+41798765432', instagram:'@fotofilmlatino',  verified:true,  featured:false, photo_url:'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=400&h=300&fit=crop' },
  { id:'p2', name:'Sabor Latino Catering',  cat:'catering',  city:'ZH', description:'Cocina latinoamericana auténtica. Ceviche, tamales, lechón.', services:['Colombiana','Peruana','Mexicana'],           price_range:'medio', whatsapp:'+41791122334', instagram:'@saborlatino_ch', verified:true,  featured:true,  photo_url:'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop' },
  { id:'p3', name:'Dulces de mi Tierra',    cat:'reposteria', city:'BS', description:'Pasteles y postres latinoamericanos artesanales. Tortas, churros.', services:['Tortas','Tres leches','Churros'],      price_range:'bajo',  whatsapp:'+41794455667', instagram:'@dulcesmitierra', verified:false, featured:false, photo_url:'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop' },
  { id:'p4', name:'Banda Caliente Zürich',  cat:'musica',    city:'ZH', description:'Banda en vivo de música latina. Salsa, cumbia, vallenato.', services:['Salsa','Cumbia','Vallenato'],                   price_range:'alto',  whatsapp:'+41796677889', instagram:'@bandacalientezh', verified:true,  featured:true,  photo_url:'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop' },
]

export const MOCK_POSTS = [
  { id:'f1', emoji:'🎓', title:'¿Cómo convalidar mi título universitario en Suiza?', cat:'documentos', author:'Miguel · Bolivia',  time:'Hace 2h',  replies:12, solved:false },
  { id:'f2', emoji:'💬', title:'Grupos de WhatsApp venezolanos en Zürich',           cat:'comunidad',  author:'Luisa García',     time:'Hace 4h',  replies:28, solved:true  },
  { id:'f3', emoji:'👶', title:'¿Guarderías que hablen español en Ginebra?',         cat:'familias',   author:'Valentina Mora',   time:'Ayer',     replies:7,  solved:true  },
  { id:'f4', emoji:'🧾', title:'Pagar AHV como autónomo — dudas frecuentes',        cat:'impuestos',  author:'Carlos Pineda',    time:'Hace 2d',  replies:19, solved:false },
  { id:'f5', emoji:'🏠', title:'¿Hipoteca siendo permiso B? ¿Alguien lo logró?',   cat:'vivienda',   author:'Ana Reyes',        time:'Hace 3d',  replies:34, solved:false },
  { id:'f6', emoji:'🍽️', title:'Mejores restaurantes latinos en Basilea',           cat:'gastronomia',author:'Diego Ramírez',    time:'Hace 4d',  replies:22, solved:false },
]

export const MOCK_CAREGIVERS = [
  { id:'cg1', name:'María González', type:'Cuidadora niños',  city:'ZH', price:'CHF 22/h', ages:'0–6 años',    langs:['Español','Alemán'],   verified:true,  emoji:'👩🏽', desc:'10 años de experiencia con bebés. Permiso B vigente.' },
  { id:'cg2', name:'Ana Ruiz',       type:'Cuidadora mayores',city:'GE', price:'CHF 28/h', ages:'Adultos',     langs:['Español','Francés'],  verified:true,  emoji:'👩🏻', desc:'Enfermera auxiliar en Colombia. Acompañamiento paciente.' },
  { id:'cg3', name:'Sofia Torres',   type:'Niñera / Tutora',  city:'BS', price:'CHF 20/h', ages:'2–12 años',   langs:['Español','Inglés'],   verified:false, emoji:'👩🏼‍🦰', desc:'Maestra de primaria. Ayudo también con tareas.' },
]

export const MOCK_FAMILY_GROUPS = [
  { id:'fg1', name:'Mamás Latinas Zürich',     city:'Zürich',  members:184, emoji:'👩‍👧',     desc:'Grupo de apoyo para madres latinas con quedadas, recomendaciones y ayuda mutua.', contact:'https://chat.whatsapp.com/ejemplo-mamas-zh' },
  { id:'fg2', name:'Familias Latinas Ginebra', city:'Ginebra', members:126, emoji:'👨‍👩‍👧', desc:'Planes familiares, actividades de fin de semana y orientación para recién llegados.', contact:'https://t.me/familiaslatinasge' },
  { id:'fg3', name:'Papás y Mamás Basel',      city:'Basilea', members:93,  emoji:'🧸',          desc:'Red cercana para compartir guarderías, escuelas y contactos de confianza.', contact:'https://chat.whatsapp.com/ejemplo-familias-bs' },
  { id:'fg4', name:'Crianza Latina Lausanne',  city:'Lausana', members:77,  emoji:'🍀',          desc:'Comunidad para acompañarse en crianza bilingüe, lactancia y reagrupación familiar.', contact:'https://t.me/crianzalatina-vd' },
]

export const MOCK_JOBS = [
  { id:'j1', emoji:'👨‍🍳', title:'Cocinero/a latino/a',         company:'El Rincón Latino',  city:'ZH', type:'Full-time',  salary:'CHF 4.200–4.800/mes', lang:'Español + alemán básico' },
  { id:'j2', emoji:'👶', title:'Cuidadora de niños',           company:'Familia particular', city:'BS', type:'Part-time',  salary:'CHF 25/hora',         lang:'Español' },
  { id:'j3', emoji:'💻', title:'Técnico/a IT soporte usuario', company:'Tech Company',       city:'ZH', type:'Full-time',  salary:'CHF 6.000–7.500/mes', lang:'Inglés + alemán' },
  { id:'j4', emoji:'💇', title:'Peluquera especialista',       company:'Salón AfroLatino',   city:'BE', type:'Full-time',  salary:'CHF 3.500 + comisión', lang:'Español' },
]

export const NEGOCIO_TYPES = [
  { id:'',            label:'Todos' },
  { id:'restaurante', label:'🍽️ Restaurante' },
  { id:'barberia',    label:'✂️ Barbería' },
  { id:'tienda',      label:'🛒 Tienda' },
  { id:'pasteleria',  label:'🍰 Pastelería' },
  { id:'belleza',     label:'💇 Belleza' },
  { id:'servicios',   label:'🔧 Servicios' },
]

export const MOCK_NEGOCIOS = [
  { id:'n1', emoji:'🍽️', name:'El Rincón Colombiano',  type:'restaurante', city:'Zürich',  canton:'ZH', desc:'Bandeja paisa, arepas y sancocho auténtico. Cocina casera colombiana de lunes a domingo.', phone:'+41791234567', email:'hola@rinconcolombiano.ch', website:'rinconcolombiano.ch', instagram:'@rinconcolombiano_zh', verified:true,  featured:true  },
  { id:'n2', emoji:'✂️', name:'Barber Latino ZH',        type:'barberia',    city:'Zürich',  canton:'ZH', desc:'Cortes al estilo caribeño. Fades, diseños y barba. Solo con cita previa vía WhatsApp.',     phone:'+41792345678', email:'citas@barberlatinozh.ch', instagram:'@barberlatino_zh',     verified:true,  featured:false },
  { id:'n3', emoji:'🛒', name:'Tienda Latina Bern',       type:'tienda',      city:'Berna',   canton:'BE', desc:'Productos latinoamericanos importados: frijoles, masa, chiles, bebidas típicas y más.',      phone:'+41793456789', website:'tiendalatinabern.ch', instagram:'@tiendalatina_bern',   verified:true,  featured:true  },
  { id:'n4', emoji:'🍰', name:'Dulces de mi Tierra',      type:'pasteleria',  city:'Basilea', canton:'BS', desc:'Pasteles artesanales: tres leches, torta de queso, buñuelos. Pedidos con anticipación.',      phone:'+41794567890', email:'pedidos@dulcesmitierra.ch', instagram:'@dulcesmitierra_bs',   verified:false, featured:false },
  { id:'n5', emoji:'💇', name:'Afro & Latino Hair',        type:'belleza',     city:'Ginebra', canton:'GE', desc:'Especialistas en cabello afro y latino. Trenzas, extensiones y relaxado permanente.',         phone:'+41795678901', website:'afrolatinohair.ch', instagram:'@afrolatinohair_ge',   verified:true,  featured:false },
  { id:'n6', emoji:'🌮', name:'Tacos & Más',               type:'restaurante', city:'Lausana', canton:'VD', desc:'Tacos, burritos y enchiladas mexicanas auténticas. Para llevar o comer en local.',             phone:'+41796789012', email:'hola@tacosymas.ch', instagram:'@tacosymas_lsn',       verified:false, featured:false },
  { id:'n7', emoji:'💸', name:'Latino Transfer ZH',        type:'servicios',   city:'Zürich',  canton:'ZH', desc:'Envío de dinero a Latinoamérica. Mejores tasas, sin comisiones ocultas. Atención en español.', phone:'+41797890123', website:'latinotransfer.ch', instagram:'@latinotransfer_zh',   verified:true,  featured:false },
  { id:'n8', emoji:'🥩', name:'Carnicería El Gaucho',      type:'tienda',      city:'Ginebra', canton:'GE', desc:'Cortes de carne al estilo latinoamericano. Chorizos, morcillas y especias importadas.',         phone:'+41798901234', email:'pedidos@elgaucho.ch', instagram:'@elgaucho_ge',         verified:false, featured:false },
]

export const MOCK_NEGOCIO_SERVICES = {
  n1:['Arepas', 'Menú casero', 'Delivery'],
  n2:['Fade', 'Barba', 'Diseños'],
  n3:['Abarrotes', 'Harinas', 'Bebidas latinas'],
  n4:['Tres leches', 'Tortas', 'Pedidos por encargo'],
  n5:['Trenzas', 'Extensiones', 'Cabello afro'],
  n6:['Tacos', 'Burritos', 'Take away'],
  n7:['Envíos', 'Cambio', 'Asesoría'],
  n8:['Cortes premium', 'Chorizos', 'Parrilla'],
}

export const MOCK_NEGOCIO_REVIEWS = {
  n1: [
    { id:'nr1', author:'Paula M.', canton:'ZH', stars:5, date:'Hace 4 días', text:'Las arepas y el sancocho saben a casa. Atención súper cercana y local muy limpio.' },
    { id:'nr2', author:'Andrés C.', canton:'AG', stars:4, date:'Hace 2 semanas', text:'Muy rico todo. El menú del día sale bien de precio para Zürich.' },
    { id:'nr3', author:'Lucía R.', canton:'ZH', stars:5, date:'Hace 1 mes', text:'Perfecto para llevar a amigos suizos a probar comida colombiana auténtica.' },
  ],
  n2: [
    { id:'nr4', author:'Kevin S.', canton:'ZH', stars:5, date:'Hace 6 días', text:'Fade limpio y rápido. Muy buen ambiente y hablan español, que se agradece.' },
    { id:'nr5', author:'Jhon P.', canton:'ZH', stars:5, date:'Hace 2 semanas', text:'La mejor barbería latina que he probado en Zürich. Reservé por WhatsApp sin problema.' },
  ],
  n3: [
    { id:'nr6', author:'María G.', canton:'BE', stars:5, date:'Hace 1 semana', text:'Encontré harina PAN, ají amarillo y galletas que no veía desde hace años.' },
    { id:'nr7', author:'César D.', canton:'FR', stars:4, date:'Hace 3 semanas', text:'Muy surtida y la dueña te ayuda a encontrar productos parecidos si no hay stock.' },
  ],
  n4: [
    { id:'nr8', author:'Sofía T.', canton:'BS', stars:5, date:'Hace 5 días', text:'Le encargamos una torta tres leches y quedó espectacular. Muy recomendable.' },
  ],
  n5: [
    { id:'nr9', author:'Laura V.', canton:'GE', stars:5, date:'Hace 1 semana', text:'Por fin un salón que entiende cabello afro y latino de verdad. Trenzas impecables.' },
    { id:'nr10', author:'Nadia F.', canton:'GE', stars:4, date:'Hace 3 semanas', text:'Muy buen trato y consejos honestos para cuidar el pelo en invierno.' },
  ],
  n6: [
    { id:'nr11', author:'Miguel R.', canton:'VD', stars:4, date:'Hace 4 días', text:'Los tacos al pastor están buenísimos y el local tiene ambiente muy agradable.' },
  ],
  n7: [
    { id:'nr12', author:'Carolina P.', canton:'ZH', stars:5, date:'Hace 2 semanas', text:'Me explicaron todo en español y el envío llegó rápido. Transparencia total.' },
  ],
  n8: [
    { id:'nr13', author:'Esteban L.', canton:'GE', stars:5, date:'Hace 1 semana', text:'La carne para asado estaba excelente. También tienen chorizo muy bueno.' },
  ],
}

export const MOCK_NEGOCIO_PHOTOS = {
  n1: [
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?w=900&h=600&fit=crop',
  ],
  n2: [
    'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=900&h=600&fit=crop',
  ],
  n3: [
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1579113800032-c38bd7635818?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?w=900&h=600&fit=crop',
  ],
  n4: [
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=900&h=600&fit=crop',
  ],
  n5: [
    'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=900&h=600&fit=crop',
  ],
  n6: [
    'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=900&h=600&fit=crop',
  ],
  n7: [
    'https://images.unsplash.com/photo-1556740749-887f6717d7e4?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&h=600&fit=crop',
  ],
  n8: [
    'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=900&h=600&fit=crop',
    'https://images.unsplash.com/photo-1529692236671-f1dc31c4a87d?w=900&h=600&fit=crop',
  ],
}

export const EVENTO_TYPES = [
  { id:'', label:'Todos' },
  { id:'concierto', label:'🎵 Concierto' },
  { id:'festival', label:'🎪 Festival' },
  { id:'quedada', label:'🤝 Quedada' },
  { id:'fiesta', label:'💃 Fiesta' },
  { id:'networking', label:'💼 Networking' },
  { id:'familia', label:'👨‍👩‍👧 Familiar' },
]

export const MOCK_EVENTOS_LATINOS = [
  { id:'e1', type:'festival', emoji:'🎪', title:'Festival Latino de Primavera', city:'Zürich', canton:'ZH', venue:'Rote Fabrik', day:'18', month:'MAY', time:'14:00', price:'Desde CHF 12', host:'Asociación Latina Zürich', featured:true, desc:'Comida, música en vivo, talleres y zona familiar para toda la comunidad.', img:'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=900&h=600&fit=crop', link:'https://latido.ch/eventos/festival-primavera' },
  { id:'e2', type:'quedada', emoji:'🤝', title:'Quedada de nuevos en Suiza', city:'Berna', canton:'BE', venue:'Rosengarten Café', day:'24', month:'MAY', time:'17:30', price:'Gratis', host:'Latido Comunidad', featured:false, desc:'Encuentro informal para hacer contactos, resolver dudas y conocer gente latina en tu ciudad.', img:'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=900&h=600&fit=crop', link:'https://latido.ch/eventos/quedada-berna' },
  { id:'e3', type:'concierto', emoji:'🎵', title:'Noche de salsa en Lausanne', city:'Lausana', canton:'VD', venue:'Le Romandie', day:'31', month:'MAY', time:'21:00', price:'CHF 18', host:'Salsa Vaud', featured:true, desc:'Banda en vivo, DJ invitado y clases cortas antes del concierto para todos los niveles.', img:'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=900&h=600&fit=crop', link:'https://latido.ch/eventos/salsa-lausanne' },
  { id:'e4', type:'networking', emoji:'💼', title:'Networking latino profesional', city:'Ginebra', canton:'GE', venue:'Impact Hub', day:'06', month:'JUN', time:'19:00', price:'CHF 10', host:'Profesionales Latinos CH', featured:false, desc:'Afterwork para emprendedores, recién llegados y profesionales que quieren ampliar su red en Suiza.', img:'https://images.unsplash.com/photo-1511578314322-379afb476865?w=900&h=600&fit=crop', link:'https://latido.ch/eventos/networking-geneva' },
  { id:'e5', type:'familia', emoji:'👨‍👩‍👧', title:'Picnic familiar latino', city:'Basilea', canton:'BS', venue:'Kannenfeldpark', day:'09', month:'JUN', time:'12:00', price:'Gratis', host:'Mamás Latinas Suiza', featured:false, desc:'Planes con niños, comida compartida y actividades al aire libre para familias latinas.', img:'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=900&h=600&fit=crop', link:'https://latido.ch/eventos/picnic-familiar' },
  { id:'e6', type:'fiesta', emoji:'💃', title:'Fiesta reggaetón & perreo old school', city:'Zürich', canton:'ZH', venue:'Club Zukunft', day:'14', month:'JUN', time:'23:00', price:'CHF 20', host:'Latido Nights', featured:true, desc:'Sesión larga con hits clásicos, trap latino y ambientazo para bailar hasta tarde.', img:'https://images.unsplash.com/photo-1521334884684-d80222895322?w=900&h=600&fit=crop', link:'https://latido.ch/eventos/perreo-zurich' },
]

export const MOCK_HOUSING = [
  { id:'h1', emoji:'🛏️', type:'Habitación',     price:'CHF 850/mes',  city:'ZH', plz:'8001', available:'Ya disponible', rooms:'Compartido 3 pers.', desc:'En piso con latinos. Cerca del transporte.' },
  { id:'h2', emoji:'🏠', type:'Piso completo',   price:'CHF 1.650/mes',city:'GE', plz:'1204', available:'1 de mayo',     rooms:'2 habitaciones',    desc:'En Carouge. No se requieren referencias previas.' },
  { id:'h3', emoji:'🏡', type:'Sublet temporal', price:'CHF 600/mes',  city:'BS', plz:'4001', available:'Ya disponible', rooms:'Estudio',           desc:'3 meses. Ideal para recién llegados. Incluye internet.' },
]

// ── MOCK REVIEWS ───────────────────────────────────────────────
export const MOCK_REVIEWS = {
  p1: [
    { id:'r1', author:'María C.',  canton:'ZH', stars:5, date:'Hace 3 días',  text:'DJ increíble. Puso salsa, reggaetón y hasta cumbia vallenata. Todos bailaron hasta las 3am. Muy profesional y puntual.' },
    { id:'r2', author:'Diego F.',  canton:'BE', stars:5, date:'Hace 1 semana', text:'Para la quinceañera de mi hija fue perfecto. Conocía todos los temas que pedimos. Super recomendado.' },
    { id:'r3', author:'Ana R.',    canton:'GE', stars:4, date:'Hace 2 semanas', text:'Muy buena música y equipo de sonido potente. Solo le falta un poco más de variedad en música andina.' },
    { id:'r4', author:'Carlos M.', canton:'ZH', stars:5, date:'Hace 1 mes',    text:'Segundo evento con él y siempre cumple. Precio justo para la calidad que da.' },
  ],
  p2: [
    { id:'r5', author:'Valentina B.', canton:'GE', stars:5, date:'Hace 5 días',  text:'Las fotos de nuestra boda son espectaculares. Capturaron momentos que ni notamos en el momento. Álbum precioso.' },
    { id:'r6', author:'Roberto L.',   canton:'VD', stars:5, date:'Hace 2 semanas', text:'Video editado profesionalmente, música perfecta, entrega en 2 semanas. Muy satisfechos.' },
    { id:'r7', author:'Paula G.',     canton:'GE', stars:4, date:'Hace 1 mes',    text:'Muy buenos fotógrafos. El drone le da un toque especial. Un poquito caros pero vale la pena.' },
  ],
  p3: [
    { id:'r8',  author:'Jorge S.',   canton:'ZH', stars:5, date:'Hace 2 días',  text:'El lechón al palo fue la estrella de la fiesta. Llegaron puntual con todo el equipo. 100% recomendado.' },
    { id:'r9',  author:'Lucia T.',   canton:'BE', stars:5, date:'Hace 1 semana', text:'Ceviche y bandeja paisa auténticos. Mis amigos suizos quedaron fascinados. Servicio impecable.' },
    { id:'r10', author:'Patricia M.',canton:'ZH', stars:4, date:'Hace 3 semanas', text:'Muy rica la comida, buena cantidad. El servicio podría mejorar un poco en la puntualidad al servir.' },
    { id:'r11', author:'Andrés C.',  canton:'AG', stars:5, date:'Hace 1 mes',    text:'Para nuestra reunión de colombianos en Suiza fue perfecta. Trajeron hasta chicha y buñuelos.' },
  ],
  p4: [
    { id:'r12', author:'Sofía R.',   canton:'BS', stars:5, date:'Hace 1 semana', text:'El tres leches estaba para llorar de lo rico. Igualito al de mi abuela en Colombia. Muy recomendada.' },
    { id:'r13', author:'Miguel F.',  canton:'BE', stars:4, date:'Hace 2 semanas', text:'Los churros con chocolate estaban deliciosos. La torta de quinceañera quedó hermosa.' },
  ],
  p5: [
    { id:'r14', author:'Elena P.',   canton:'ZH', stars:5, date:'Hace 4 días',  text:'La banda en vivo es otro nivel. Tocaron desde vallenato hasta salsa cali. Increíble energía.' },
    { id:'r15', author:'Tomás A.',   canton:'ZH', stars:5, date:'Hace 2 semanas', text:'Para nuestra boda fue el complemento perfecto. Muy profesionales y buen repertorio.' },
    { id:'r16', author:'Carmen L.',  canton:'GE', stars:4, date:'Hace 1 mes',    text:'Muy buena banda. Tal vez un poco alto el volumen al inicio pero ajustaron rápido.' },
  ],
}

// Extra gallery photos per provider
export const MOCK_PROVIDER_PHOTOS = {
  p1: [
    'https://images.unsplash.com/photo-1571266028243-3716f02d2d50?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1504680177321-2e6a879aac86?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=600&h=400&fit=crop',
  ],
  p2: [
    'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1537907510278-d49e2afc89a4?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&h=400&fit=crop',
  ],
  p3: [
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&h=400&fit=crop',
  ],
  p4: [
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1488477304112-4944851de03d?w=600&h=400&fit=crop',
  ],
  p5: [
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1468164016595-6108e4c60753?w=600&h=400&fit=crop',
  ],
}
