// Cada color de estado tiene dos papeles y no son intercambiables:
//   success/warn/danger      -> fondos, iconos y trazos (color pleno)
//   successText/warnText/... -> texto sobre el fondo claro correspondiente
// El tono pleno sobre su propio fondo claro no alcanza el contraste minimo
// (verde 2.41:1), asi que nunca debe usarse para tipografia.
export const C = {
  bg:'#F0F6FF', surface:'#FFFFFF', bgAlt:'#F8FAFF',
  primary:'#2563EB', primaryDark:'#1D4ED8', primaryLight:'#EFF6FF', primaryMid:'#BFDBFE',
  success:'#10B981', successLight:'#ECFDF5', successMid:'#6EE7B7', successText:'#047857',
  warn:'#F59E0B', warnLight:'#FFFBEB', warnMid:'#FCD34D', warnText:'#B45309',
  danger:'#EF4444', dangerLight:'#FEF2F2', dangerText:'#B91C1C',
  // light se usa en 372 sitios y siempre como texto: 4.99:1 sobre el fondo de
  // la app y 5.42:1 sobre blanco, conservando el sesgo azul-slate de la marca.
  text:'#0F172A', mid:'#475569', light:'#5A6B85',
  border:'#E2EAF4', borderLight:'#F1F5F9',
}

// Escala tipografica. Ocho pasos fijos: cualquier tamano fuera de esta lista es
// una excepcion que hay que justificar. El cuerpo es 15 porque por debajo de 12
// la lectura en movil deja de ser comoda.
export const T = Object.freeze({
  meta:12,       // fecha, canton, autor
  label:12,      // etiquetas y mayusculas pequenas
  small:13,      // texto secundario
  body:15,       // lectura
  cardTitle:17,  // titulo de tarjeta
  section:20,    // cabecera de seccion
  title:24,      // titulo de pantalla
  display:32,    // cifras y portada
  hero:44,       // titular de landing
})

// Tres pesos. El 900 queda reservado para cifras grandes del panel, donde el
// tamano ya crea la jerarquia y el peso solo aporta densidad.
export const W = Object.freeze({
  body:400,
  medium:600,
  bold:800,
  display:900,
})

// Cinco radios y cuatro elevaciones. Sustituyen a los 23 radios y 74 sombras
// que habia declarados sueltos por las pantallas.
export const R = Object.freeze({
  sm:10,    // etiquetas, cajas de icono
  md:14,    // botones, campos
  lg:18,    // tarjetas
  xl:24,    // hojas y cabeceras
  pill:999,
})

export const E = Object.freeze({
  sm:'0 8px 20px rgba(15,23,42,.04)',
  md:'0 14px 32px rgba(15,23,42,.05)',
  lg:'0 18px 44px rgba(15,23,42,.06)',
  overlay:'0 24px 74px rgba(15,23,42,.24)',
})

// Minimo de area tactil: 44 px es el suelo de Apple, 48 el de Google.
export const TAP_MIN = 44

// Paleta de marca de Latido. Las variantes claras se usan en superficies para
// mantener el color reconocible sin perder legibilidad ni competir con el
// contenido. Cualquier pantalla que represente una sección o categoría debe
// tomar el tono desde SECTION_COLORS/getLatidoCategoryTheme.
export const LATIDO_PALETTE = Object.freeze({
  mint:'#24E2C9',
  teal:'#03AA98',
  orange:'#F9A719',
  red:'#FA2F35',
  blue:'#4A76EF',
  cyan:'#24BFE2',
  // Tonos complementarios para secciones que necesitan identidad propia.
  purple:'#8757E8',
  fuchsia:'#D946EF',
  lime:'#84CC16',
})

export const SECTION_COLORS = Object.freeze({
  anuncios:Object.freeze({
    color:LATIDO_PALETTE.blue,
    ink:'#3157B9',
    soft:'#EEF3FF',
    border:'#CEDAFF',
    gradient:`linear-gradient(150deg, #5B84F3 0%, ${LATIDO_PALETTE.blue} 100%)`,
  }),
  empleo:Object.freeze({
    color:LATIDO_PALETTE.teal,
    ink:'#04796E',
    soft:'#E9FCF8',
    border:'#B5F1E7',
    gradient:`linear-gradient(150deg, ${LATIDO_PALETTE.mint} 0%, ${LATIDO_PALETTE.teal} 100%)`,
  }),
  negocios:Object.freeze({
    color:LATIDO_PALETTE.orange,
    ink:'#9A5D00',
    soft:'#FFF6E5',
    border:'#FFE0A0',
    gradient:`linear-gradient(150deg, #FFB83F 0%, ${LATIDO_PALETTE.orange} 100%)`,
  }),
  creadores:Object.freeze({
    color:LATIDO_PALETTE.purple,
    ink:'#6730BE',
    soft:'#F4EEFF',
    border:'#DECEFF',
    gradient:'linear-gradient(150deg, #9A70F0 0%, #7541D6 100%)',
  }),
  contenido:Object.freeze({
    color:LATIDO_PALETTE.fuchsia,
    ink:'#9A20AA',
    soft:'#FDF0FF',
    border:'#F2C5F8',
    gradient:`linear-gradient(150deg, #E879F9 0%, ${LATIDO_PALETTE.fuchsia} 100%)`,
    on:'#57125F',
  }),
  guias:Object.freeze({
    color:LATIDO_PALETTE.lime,
    ink:'#4D7C0F',
    soft:'#F7FEE7',
    border:'#D9F99D',
    gradient:`linear-gradient(150deg, #A3E635 0%, ${LATIDO_PALETTE.lime} 100%)`,
    on:'#365314',
  }),
  eventos:Object.freeze({
    color:LATIDO_PALETTE.red,
    ink:'#C8252B',
    soft:'#FFF0F1',
    border:'#FFCBCD',
    gradient:`linear-gradient(150deg, #FF5B60 0%, ${LATIDO_PALETTE.red} 100%)`,
  }),
  grupos:Object.freeze({
    color:LATIDO_PALETTE.cyan,
    // Oscurecido de #087E99: aquel se quedaba en 4.43:1 sobre su fondo claro.
    ink:'#07738C',
    soft:'#EAFBFF',
    border:'#BCEEF7',
    gradient:`linear-gradient(150deg, #39CBE8 0%, ${LATIDO_PALETTE.cyan} 100%)`,
  }),
})

const CATEGORY_THEME_ALIASES = Object.freeze({
  anuncio:'anuncios',
  listing:'anuncios',
  vivienda:'anuncios',
  documentos:'anuncios',
  empleo:'empleo',
  trabajo:'empleo',
  servicios:'empleo',
  negocio:'negocios',
  negocios:'negocios',
  venta:'negocios',
  regalo:'negocios',
  contenido:'contenido',
  contenidos:'contenido',
  contenido_creadores:'contenido',
  guia:'guias',
  guide:'guias',
  guias:'guias',
  creador:'creadores',
  creadores:'creadores',
  cuidados:'eventos',
  evento:'eventos',
  eventos:'eventos',
  comunidad:'grupos',
  comunidades:'grupos',
  grupo:'grupos',
  grupos:'grupos',
})

export function getLatidoCategoryTheme(id='') {
  const normalized = String(id || '').trim().toLowerCase()
  return SECTION_COLORS[CATEGORY_THEME_ALIASES[normalized] || normalized] || SECTION_COLORS.anuncios
}

export const CAT_COLORS = {
  vivienda:   { bg:SECTION_COLORS.anuncios.soft, tc:SECTION_COLORS.anuncios.ink },
  cuidados:   { bg:SECTION_COLORS.eventos.soft, tc:SECTION_COLORS.eventos.ink },
  documentos: { bg:SECTION_COLORS.anuncios.soft, tc:SECTION_COLORS.anuncios.ink },
  venta:      { bg:SECTION_COLORS.negocios.soft, tc:SECTION_COLORS.negocios.ink },
  servicios:  { bg:SECTION_COLORS.empleo.soft, tc:SECTION_COLORS.empleo.ink },
  empleo:     { bg:SECTION_COLORS.empleo.soft, tc:SECTION_COLORS.empleo.ink },
  regalo:     { bg:SECTION_COLORS.negocios.soft, tc:SECTION_COLORS.negocios.ink },
}
export const PP = "'Poppins', system-ui, sans-serif"
