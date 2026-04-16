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
  { id:'vivienda',   emoji:'🏠', label:'Vivienda',   sub:['Se busca piso','Se ofrece habitación','Compañero/a piso','Sublet temporal'] },
  { id:'hogar',      emoji:'🧹', label:'Hogar',       sub:['Limpieza','Cocina','Reparaciones','Mudanza'] },
  { id:'cuidados',   emoji:'👶', label:'Cuidados',    sub:['Cuidado niños','Cuidado mayores','Au pair','Asistencia'] },
  { id:'documentos', emoji:'📋', label:'Docs & Admin',sub:['Cartas','Trámites','Traducción','Asesoría'] },
  { id:'venta',      emoji:'🛒', label:'Venta',       sub:['Electrónica','Ropa','Muebles','Comida','Otro'] },
  { id:'servicios',  emoji:'💼', label:'Servicios',   sub:['Clases','Peluquería','Mecánico','Informática','Otro'] },
  { id:'regalo',     emoji:'🎁', label:'Se regala',   sub:['Ropa','Muebles','Libros','Juguetes','Otro'] },
]

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
  { id:'a2', cat:'cuidados',   sub:'Cuidado niños',         title:'Ofrezco cuidado de niños tardes',          desc:'Maestra con 8 años de exp. Lunes a viernes 15:00–19:00. Referencias disponibles.',               user:'Ana R.',     canton:'BE', plz:'3001', price:'CHF 22/h',         type:'ofrece', privacy:'public',  verified:true,  ts:'Hace 4h',   img:null },
  { id:'a3', cat:'venta',      sub:'Electrónica',           title:'iPhone 13 128GB — perfecto estado',        desc:'Caja original, cargador incluido. Sin golpes ni rayones. Precio negociable.',                    user:'Carlos M.',  canton:'GE', plz:'1201', price:'CHF 450',           type:'vende',  privacy:'public',  verified:false, ts:'Hace 5h',   img:'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&h=260&fit=crop' },
  { id:'a4', cat:'hogar',      sub:'Limpieza',              title:'Limpieza profesional de pisos',             desc:'Servicio de limpieza profunda o mantenimiento semanal. Productos incluidos.',                    user:'Rosa P.',    canton:'BS', plz:'4001', price:'CHF 30/h',         type:'ofrece', privacy:'private', verified:true,  ts:'Hace 6h',   img:null },
  { id:'a5', cat:'documentos', sub:'Cartas',                title:'Ayudo con cartas en alemán suizo',          desc:'Traduzco y explico cartas oficiales suizas. 6 años viviendo aquí. Respondo en 24h.',             user:'Diego F.',   canton:'ZH', plz:'8050', price:'CHF 15/carta',     type:'ofrece', privacy:'public',  verified:false, ts:'Ayer',      img:null },
  { id:'a6', cat:'regalo',     sub:'Muebles',               title:'Regalo sofá 3 plazas — Bern',               desc:'Sofá gris en buen estado. Solo para recoger esta semana. Primera persona que responda.',          user:'Lucia T.',   canton:'BE', plz:'3011', price:'Gratis',           type:'regala', privacy:'public',  verified:true,  ts:'Ayer',      img:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=260&fit=crop' },
  { id:'a7', cat:'servicios',  sub:'Clases',                title:'Clases de español para suizos',             desc:'Profesora nativa. Principiantes y avanzados. Online o presencial en Lausana.',                  user:'Valentina B.',canton:'VD',plz:'1000', price:'CHF 40/h',         type:'ofrece', privacy:'private', verified:true,  ts:'Hace 2d',   img:null },
  { id:'a8', cat:'vivienda',   sub:'Se ofrece habitación',  title:'Habitación en piso compartido Ginebra',    desc:'2 latinos, ambiente tranquilo. Incluye wifi y acceso a cocina. Disponible 1 de mayo.',            user:'Pablo G.',   canton:'GE', plz:'1204', price:'CHF 800/mes',      type:'ofrece', privacy:'public',  verified:false, ts:'Hace 2d',   img:null },
  { id:'a9', cat:'cuidados',   sub:'Cuidado mayores',       title:'Busco cuidadora para mi madre (73)',        desc:'Mi madre necesita compañía y ayuda diaria. Español esencial. Zona Zug.',                         user:'Roberto L.', canton:'ZG', plz:'6300', price:'CHF 25/h',         type:'busca',  privacy:'private', verified:true,  ts:'Hace 3d',   img:null },
  { id:'a10',cat:'hogar',      sub:'Reparaciones',          title:'Hago reparaciones del hogar',               desc:'Plomería, electricidad básica, pintura. 10 años de experiencia en Suiza.',                      user:'Jorge S.',   canton:'AG', plz:'5001', price:'CHF 50/h',         type:'ofrece', privacy:'public',  verified:false, ts:'Hace 3d',   img:null },
]

export const MOCK_COMMUNITIES = [
  { id:'c1', name:'Colombianos en Zürich',      cat:'pais',       city:'Zürich',     members:342, emoji:'🇨🇴', verified:true,  desc:'La comunidad más grande de colombianos en Suiza.', contact:'https://chat.whatsapp.com/ejemplo' },
  { id:'c2', name:'Mamás Latinas Suiza',        cat:'mamas',      city:'Toda Suiza', members:891, emoji:'👩‍👧', verified:true,  desc:'Red de madres latinoamericanas. Crianza y apoyo mutuo.', contact:'https://t.me/mamaslatinasch' },
  { id:'c3', name:'Venezolanos en Suiza',       cat:'pais',       city:'Toda Suiza', members:523, emoji:'🇻🇪', verified:true,  desc:'Comunidad venezolana unida. Asesoría, trabajo y vivienda.', contact:'https://t.me/venezusuiza' },
  { id:'c4', name:'Fútbol Latino Ginebra',      cat:'deporte',    city:'Ginebra',    members:156, emoji:'⚽', verified:false, desc:'Liga amateur de fútbol para latinos. Partidos cada domingo.', contact:'https://chat.whatsapp.com/ejemplo' },
  { id:'c5', name:'Profesionales Latinos CH',   cat:'profesional',city:'Toda Suiza', members:267, emoji:'💼', verified:true,  desc:'Red de profesionales latinoamericanos. Networking y mentoring.', contact:'https://chat.whatsapp.com/ejemplo' },
  { id:'c6', name:'Aprende Alemán con Latinos', cat:'idioma',     city:'Zürich',     members:198, emoji:'🇩🇪', verified:false, desc:'Práctica de alemán para hispanohablantes. Clases peer-to-peer.', contact:'https://t.me/alemanlatinoch' },
  { id:'c7', name:'Fe Latina Suiza',            cat:'fe',         city:'Toda Suiza', members:445, emoji:'🙏', verified:true,  desc:'Comunidad cristiana latina. Cultos y grupos de estudio.', contact:'https://chat.whatsapp.com/ejemplo' },
  { id:'c8', name:'Gastronomía Latina CH',      cat:'gastronomia',city:'Toda Suiza', members:334, emoji:'🍳', verified:false, desc:'Recetas, ingredientes latinos y cenas comunitarias.', contact:'https://t.me/gastrolatinosuiza' },
]

export const MOCK_DOCS = [
  { id:'d1', emoji:'📄', cat:'permisos',  title:'Tipos de permiso de residencia',       summary:'Diferencias entre L, B, C y G. Cómo renovarlos.',                     time:'8 min', level:'Básico',
    content:'**Permiso B** — El más común para recién llegados con contrato de trabajo. Válido 1 año, renovable. Después de 5 años puedes pedir el C.\n\n**Permiso C** — Residencia permanente. Tras 5–10 años con B. No vinculado al empleador.\n\n**Permiso L** — Corta duración, menos de 1 año.\n\n**Permiso G** — Para fronterizos. Vives en país vecino y trabajas en Suiza.\n\n**¿Dónde tramitarlo?**\nEn el Migrationsamt de tu cantón. Lleva pasaporte, contrato y Anmeldung.' },
  { id:'d2', emoji:'🧾', cat:'impuestos', title:'Quellensteuer vs Imposición ordinaria', summary:'¿Estás pagando impuestos de más? Descúbrelo aquí.',                       time:'6 min', level:'Medio',
    content:'**Quellensteuer** — Se descuenta automáticamente de tu salario si tienes permiso B.\n\n**¿Cuándo conviene la imposición ordinaria?**\n• Salario anual > CHF 120.000\n• Tienes gastos deducibles importantes\n• Tu cónyuge también trabaja\n\n**Cómo solicitarlo**\nAntes del 31 de marzo en el Steueramt de tu cantón.\n\n⚠️ Miles de latinos en Suiza pagan de más sin saberlo.' },
  { id:'d3', emoji:'🏥', cat:'salud',     title:'Cómo elegir tu Krankenkasse',           summary:'Obligatorio. Ahorra hasta CHF 1.000/año eligiendo bien.',                time:'5 min', level:'Básico',
    content:'El seguro médico es **obligatorio** dentro de los 3 meses de llegar.\n\n**Primas:** CHF 250–550+/mes según cantón y aseguradora.\n\n**Franquicia (Franchise):** Cuanto mayor, menor prima. Opciones: CHF 300, 500, 1000, 1500, 2000, 2500.\n\n**Comparadores:** Priminfo.ch · Comparis.ch · Bonus.ch\n\n**Reducción de prima:** Si tu ingreso es bajo, ¡solicítala en tu cantón!' },
  { id:'d4', emoji:'🏦', cat:'banco',     title:'Abrir cuenta bancaria sin referencias', summary:'El banco más fácil y alternativas digitales para recién llegados.',       time:'4 min', level:'Básico',
    content:'**PostFinance** — El más accesible. Solo necesitas permiso + pasaporte.\n\n**Alternativas digitales (sin burocracia):**\n• Neon — 100% digital, sin comisiones\n• Wise — Para enviar dinero a casa sin comisiones\n• Yuh — Para principiantes\n\n**Documentos típicos:** Pasaporte · Permiso de residencia · Anmeldung (registro municipal)' },
  { id:'d5', emoji:'🎓', cat:'educacion', title:'Guarderías (Kitas) y escuelas',          summary:'Cómo acceder, costes, subvenciones y listas de espera.',                  time:'7 min', level:'Básico',
    content:'**Kinderkrippe (Kita):** Para 0–4 años. CHF 80–180 por día según cantón e ingresos.\n\n**Cómo inscribir:**\n1. Busca Kitas en kitas.ch o el sitio de tu municipio\n2. Apúntate en lista de espera cuanto antes (6–12 meses)\n3. Solicita reducción de tarifa según tu salario\n\n**Escuelas bilingües:** Algunos cantones ofrecen programas español-alemán/francés. Pregunta en la Schulamt de tu canton.' },
]

export const MOCK_PROVIDERS = [
  { id:'p1', name:'DJ Sebastián Vega',      cat:'dj',        city:'ZH', description:'DJ especializado en salsa, reggaetón y cumbia. 10 años en Suiza.', services:['Salsa','Reggaetón','Cumbia','Bachata'], price_range:'medio', whatsapp:'+41791234567', instagram:'@djsebastianvega', verified:true,  featured:true,  photo_url:'https://images.unsplash.com/photo-1571266028243-3716f02d2d50?w=400&h=300&fit=crop' },
  { id:'p2', name:'Foto & Film Latino',     cat:'fotografia',city:'GE', description:'Especialistas en quinceañeras y bodas. Álbum digital + video.', services:['Fotografía','Video','Drone'],             price_range:'alto',  whatsapp:'+41798765432', instagram:'@fotofilmlatino',  verified:true,  featured:false, photo_url:'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=400&h=300&fit=crop' },
  { id:'p3', name:'Sabor Latino Catering',  cat:'catering',  city:'ZH', description:'Cocina latinoamericana auténtica. Ceviche, tamales, lechón.', services:['Colombiana','Peruana','Mexicana'],           price_range:'medio', whatsapp:'+41791122334', instagram:'@saborlatino_ch', verified:true,  featured:true,  photo_url:'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop' },
  { id:'p4', name:'Dulces de mi Tierra',    cat:'reposteria', city:'BS', description:'Pasteles y postres latinoamericanos artesanales. Tortas, churros.', services:['Tortas','Tres leches','Churros'],      price_range:'bajo',  whatsapp:'+41794455667', instagram:'@dulcesmitierra', verified:false, featured:false, photo_url:'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop' },
  { id:'p5', name:'Banda Caliente Zürich',  cat:'musica',    city:'ZH', description:'Banda en vivo de música latina. Salsa, cumbia, vallenato.', services:['Salsa','Cumbia','Vallenato'],                   price_range:'alto',  whatsapp:'+41796677889', instagram:'@bandacalientezh', verified:true,  featured:true,  photo_url:'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop' },
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
