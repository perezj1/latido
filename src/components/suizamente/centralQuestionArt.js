// Original educational drawings and explicitly fictional notices.
const scene=(label,body)=>`<svg viewBox="0 0 220 140" width="220" height="140" role="img" aria-label="${label}"><rect width="220" height="140" rx="12" fill="#e0f2fe"/>${body}</svg>`
export const CENTRAL_IMG={
  'ur-aurochs-shield':()=>scene('Escudo amarillo con cabeza negra de uro, lengua y aro nasal rojos',`
    <path d="M60 8h100v57q0 43-50 67-50-24-50-67z" fill="#facc15" stroke="#172743" stroke-width="3"/>
    <path d="M89 48Q63 44 68 18q-19 26 6 44l17 3m40-17q26-4 21-30 19 26-6 44l-17 3" fill="#fff" stroke="#1f2937" stroke-width="3"/>
    <path d="M83 57l-15-5 8 18 11 3m50-16l15-5-8 18-11 3" fill="#171717"/>
    <path d="M86 45q24-13 48 0l-2 28-10 11v21q-12 10-24 0V84L88 73z" fill="#171717"/>
    <path d="M93 62l8 4m26-4l-8 4" stroke="#fff" stroke-width="3"/>
    <path d="M106 99v19q4 7 8 0V99" fill="#ef4444"/><ellipse cx="110" cy="102" rx="10" ry="9" fill="none" stroke="#ef4444" stroke-width="4"/>
    <ellipse cx="101" cy="88" rx="3" ry="2" fill="#6b7280"/><ellipse cx="119" cy="88" rx="3" ry="2" fill="#6b7280"/>`),
  'ur-crossbow':()=>scene('Ballesta genérica de madera con arco transversal y cuerda',`
    <path d="M47 28l115 84-10 14L38 42z" fill="#a67845" stroke="#704f32" stroke-width="3"/>
    <path d="M112 18Q91 62 39 97" fill="none" stroke="#704f32" stroke-width="7" stroke-linecap="round"/>
    <path d="M112 18l-1 67-72 12" fill="none" stroke="#c4a16e" stroke-width="2"/>
    <path d="M42 33l92 67" stroke="#64748b" stroke-width="4"/><path d="M35 28l14 2-8 12z" fill="#64748b"/>
    <path d="M117 96q-8 13 4 15l11-4" fill="none" stroke="#172743" stroke-width="3"/><path d="M145 105l13 8" stroke="#d2b78c" stroke-width="6"/>
    <circle cx="180" cy="40" r="14" fill="#ef5350"/><path d="M179 26l3-10m0 10q13-14 20-2-11 8-20 2" fill="#4d8a47" stroke="#4d8a47" stroke-width="2"/>`),
  'ur-devils-bridge':()=>scene('Puente de arco de piedra sobre una profunda garganta',`
    <path d="M0 31l44 17 26 92H0m220-118l-44 28-27 90h71" fill="#8796a4"/><path d="M0 58l40 11 18 71H0m220-90l-37 21-17 69h54" fill="#647584"/>
    <path d="M98 79l11 16-9 17 17 28h25l-24-28 5-19-10-14" fill="#76c9e7"/>
    <path d="M34 50h151v20h-12Q110 1 47 70H34z" fill="#b7aaa0" stroke="#736e69" stroke-width="3"/>
    <path d="M34 46h151m-137 0v9m18-9v11m18-11v9m18-9v8m18-8v8m18-8v9m18-9v11m18-11v9" stroke="#e5d9c5" stroke-width="4"/>
    <path d="M8 13l28 11m155-10l22 9M19 90l19 8m151-12l15-8" stroke="#b6c4ce" stroke-width="3"/>`),
  'ur-wild-hay':()=>scene('Heno recogido y herramientas sobre una ladera alpina muy empinada',`
    <path d="M0 97L159 8l61 40v92H0" fill="#94be72"/><path d="M0 117l173-96 47 38v81H0" fill="#76a65a"/>
    <path d="M109 85l28-58m-29 57l-38-12" stroke="#9b764b" stroke-width="5" stroke-linecap="round"/><path d="M70 72Q36 72 23 87q24-7 47-10" fill="#cbd5e1" stroke="#667785" stroke-width="2"/>
    <path d="M152 114l30-60m-14-8l31 16m-30-16l-4 9m12-5l-4 9m12-5l-4 9m12-5l-4 9" stroke="#a87a47" stroke-width="4"/>
    <path d="M72 129l29-32 37 32z" fill="#e7c873"/><path d="M88 128l14-23m8 23l-5-23m20 23l-19-23" stroke="#bb9e51" stroke-width="2"/>
    <path d="M0 25l22-16 24 20-10 8-16-10L0 40" fill="#a5b4c8"/><path d="M13 16l9-7 13 12-12-5-7 6" fill="#fff"/>`),
  'ur-pass-closed':()=>scene('Panel ficticio Pass gesperrt junto a una barrera cerrada',`
    <path d="M0 116l76-30h64l80 30v24H0" fill="#a8b8c6"/><path d="M70 87h80v53H55z" fill="#697b8b"/>
    <path d="M33 133V92m155 41V92" stroke="#6b7280" stroke-width="6"/><path d="M32 94h157" stroke="#fff" stroke-width="10"/><path d="M44 94h18m22 0h18m22 0h18m22 0h18" stroke="#ef4444" stroke-width="10"/>
    <rect x="18" y="12" width="184" height="62" rx="8" fill="#fff" stroke="#9aaabb" stroke-width="3"/>
    <g text-anchor="middle" font-family="Arial,sans-serif" fill="#172743"><text x="110" y="40" font-size="20" font-weight="bold">Pass gesperrt</text><text x="110" y="62" font-size="10">EJEMPLO · SIN VALIDEZ</text></g>`),
  'sz-stoos-funicular':()=>scene('Cabinas redondas de funicular sobre raíles inclinados',`
    <path d="M0 132L211 16l9 10v114H0" fill="#91b777"/><path d="M17 132L210 25m-184 116L219 34" stroke="#64748b" stroke-width="5"/>
    <path d="M52 107l121-66" stroke="#d5dde5" stroke-width="7"/>
    <g fill="#fff" stroke="#d6dde5" stroke-width="3"><circle cx="67" cy="89" r="23"/><circle cx="108" cy="67" r="23"/><circle cx="149" cy="45" r="23"/></g>
    <g fill="#5a9dbc" stroke="#254a66" stroke-width="2"><path d="M49 90V82a18 18 0 0 1 36 0v8zM90 68V60a18 18 0 0 1 36 0v8zM131 46V38a18 18 0 0 1 36 0v8z"/></g>
    <path d="M57 101h20m21-22h20m21-22h20" stroke="#e86253" stroke-width="6"/><path d="M67 66v24m41-46v24m41-46v24" stroke="#fff" stroke-width="2"/>`),
  'sz-potato-bake':()=>scene('Fuente de horno con rodajas de patata, queso y cebolla',`
    <ellipse cx="109" cy="99" rx="96" ry="28" fill="#cbd5e1"/><path d="M36 60h148l-11 52q-62 30-124 0z" fill="#b5ccdb" stroke="#6e8799" stroke-width="3"/>
    <ellipse cx="110" cy="63" rx="75" ry="31" fill="#f2cd70" stroke="#7891a3" stroke-width="3"/>
    <g fill="#fbe4a6" stroke="#cfa75c" stroke-width="1.5"><ellipse cx="65" cy="56" rx="18" ry="10" transform="rotate(-22 65 56)"/><ellipse cx="101" cy="47" rx="18" ry="10"/><ellipse cx="145" cy="56" rx="19" ry="11" transform="rotate(18 145 56)"/><ellipse cx="92" cy="73" rx="19" ry="10"/><ellipse cx="134" cy="74" rx="18" ry="10"/></g>
    <g fill="none" stroke="#fff1ca" stroke-width="3"><ellipse cx="66" cy="69" rx="10" ry="5"/><ellipse cx="122" cy="54" rx="9" ry="5"/></g><g fill="#b77b36"><circle cx="80" cy="49" r="2"/><circle cx="158" cy="66" r="2"/><circle cx="106" cy="75" r="2"/><circle cx="123" cy="41" r="2"/></g>
    <path d="M38 69H19v18h22m141-18h19v18h-22" fill="none" stroke="#7891a3" stroke-width="6"/>`),
  'sz-cave-group':()=>scene('Grupo guiado con cascos y luces en una galería rocosa',`
    <rect width="220" height="140" rx="12" fill="#3d4d5b"/><path d="M0 82Q20 3 82 12l22 10 31-16q64-2 85 58V0H0z" fill="#81909a"/>
    <path d="M0 126l54-17 34 7 34-19 48 12 50-15v46H0" fill="#687781"/>
    <path d="M64 52l108-22-4 51z" fill="#fbe4a6" opacity=".18"/><path d="M105 70l89-26-5 49z" fill="#fbe4a6" opacity=".12"/>
    <g fill="#d3ac87"><circle cx="53" cy="58" r="9"/><circle cx="96" cy="77" r="8"/><circle cx="132" cy="89" r="7"/></g>
    <path d="M41 53q12-23 25 0m19 19q11-20 23 0m14 13q10-18 21 0" fill="#f3bc49"/><g fill="#fff3ad"><rect x="61" y="48" width="7" height="6" rx="2"/><rect x="104" y="68" width="6" height="5" rx="2"/></g>
    <path d="M43 70h20l4 31H40z" fill="#e07650"/><path d="M87 88h18l4 24H84z" fill="#62a5b9"/><path d="M125 99h15l3 20h-21z" fill="#96b671"/>
    <path d="M45 101l-8 30m22-30l8 30M90 112l-4 24m16-24l6 24m20-17l-2 18m12-18l5 18M61 74l21 12" stroke="#c2ccd5" stroke-width="5" stroke-linecap="round"/>`),
  'sz-library-notice':()=>scene('Panel ficticio de una biblioteca de abadía',`
    <rect x="10" y="11" width="200" height="118" rx="9" fill="#fff" stroke="#94a3b8" stroke-width="3"/>
    <path d="M77 49V27q18-7 33 2 15-9 33-2v22q-18-6-33 1-15-7-33-1z" fill="#dbeafe" stroke="#497a9c" stroke-width="2"/><path d="M110 29v21" stroke="#497a9c" stroke-width="2"/>
    <g text-anchor="middle" font-family="Arial,sans-serif" fill="#172743"><text x="110" y="78" font-size="19" font-weight="bold">Stiftsbibliothek</text><text x="110" y="118" font-size="9">EJEMPLO FICTICIO</text></g>
    <path d="M85 96h48m-10-7l10 7-10 7" fill="none" stroke="#d18e31" stroke-width="4" stroke-linejoin="round"/>`),
  'sz-paper-calendar':()=>scene('Calendario ficticio: Papier, Mittwoch, ab 7 Uhr',`
    <rect x="27" y="13" width="166" height="116" rx="10" fill="#fff" stroke="#94a3b8" stroke-width="3"/>
    <path d="M27 40h166V23q0-10-10-10H37q-10 0-10 10z" fill="#4793ad"/><path d="M65 8v17m90-17v17" stroke="#536a7c" stroke-width="5" stroke-linecap="round"/>
    <g text-anchor="middle" font-family="Arial,sans-serif"><text x="110" y="33" fill="#fff" font-size="17" font-weight="bold">Papier</text><text x="110" y="65" fill="#172743" font-size="20" font-weight="bold">Mittwoch</text><text x="110" y="93" fill="#2563eb" font-size="23">ab 7 Uhr</text><text x="110" y="116" fill="#536a7c" font-size="8">EJEMPLO · SIN VALIDEZ</text></g>`),
}
export const CENTRAL_ART_LABELS={
 'ur-aurochs-shield':'Escudo de Uri','ur-crossbow':'Ballesta esquemática','ur-devils-bridge':'Teufelsbrücke esquemática','ur-wild-hay':'Wildheuen en una ladera','ur-pass-closed':'Aviso ficticio de paso cerrado',
 'sz-stoos-funicular':'Funicular inspirado en Stoos','sz-potato-bake':'Ofenturli esquemático','sz-cave-group':'Expedición guiada en una cueva','sz-library-notice':'Panel ficticio de biblioteca','sz-paper-calendar':'Calendario ficticio de recogida',
}
