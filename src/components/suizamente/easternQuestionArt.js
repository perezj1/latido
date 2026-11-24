// Original schematic drawings. No external photographs, fonts or copied designs.
const scene=(label,body)=>`<svg viewBox="0 0 220 140" width="220" height="140" role="img" aria-label="${label}"><rect width="220" height="140" rx="12" fill="#e0f2fe"/>${body}</svg>`
export const EASTERN_IMG={
  'sg-library':()=>scene('Sala histórica de biblioteca con galerías de libros y bóveda',`
    <path d="M12 124V46Q110-25 208 46v78z" fill="#f4e6cf" stroke="#a98b65" stroke-width="3"/>
    <path d="M39 36q71-37 142 0l-17 19q-54-26-108 0z" fill="#b4c7c1" stroke="#b99b77" stroke-width="2"/>
    <path d="M67 124V66q43-25 86 0v58" fill="#e1d4bb" stroke="#c3ad87" stroke-width="3"/>
    <path d="M10 127l56-24h88l56 24" fill="#c39b6f"/>
    <g fill="#815636" stroke="#62432e" stroke-width="2"><path d="M16 55h44v65H16zm144 0h44v65h-44zM76 68h68v37H76z"/></g>
    <g stroke="#e9cf96" stroke-width="3"><path d="M22 61v16m7-16v16m8-16v16m8-16v16m8-16v16M22 86v23m8-23v23m7-23v23m8-23v23m8-23v23M167 61v16m7-16v16m8-16v16m8-16v16m7-16v16m-30 9v23m8-23v23m8-23v23m8-23v23m7-23v23M83 73v23m8-23v23m8-23v23m8-23v23m8-23v23m8-23v23m8-23v23m8-23v23"/></g>
    <path d="M13 82h50m94 0h50" stroke="#d4b275" stroke-width="6"/><path d="M83 123l27-12 27 12" fill="#f2dec0"/>
    <ellipse cx="110" cy="30" rx="19" ry="9" fill="#e6bc74"/><path d="M110 40v14m-8-6h16" stroke="#b99351" stroke-width="2"/>`),
  'sg-bratwurst':()=>scene('Salchicha clara a la parrilla con panecillo',`
    <ellipse cx="111" cy="103" rx="97" ry="29" fill="#fff" stroke="#c7d5e2" stroke-width="3"/>
    <path d="M36 94q56-51 132-14 15 9 3 22-9 8-23 1-55-26-94 9-14 11-22-2-6-8 4-16" fill="#f2dec1" stroke="#c1a17b" stroke-width="3"/>
    <path d="M56 85l13 17m12-28l10 17m18-21l5 17m20-15l-1 17m20-11l-7 16" stroke="#9d7046" stroke-width="4" stroke-linecap="round"/>
    <path d="M121 54q2-26 36-27 34-1 39 26-4 18-37 19-31 2-38-18" fill="#ba7b35" stroke="#8e5f2d" stroke-width="2"/>
    <path d="M131 43l17 15m7-23l15 23m8-19l10 13" stroke="#ebc58a" stroke-width="5" stroke-linecap="round"/>`),
  'sg-embroidery':()=>scene('Aro de bordado con aguja e hilo',`
    <circle cx="100" cy="77" r="55" fill="#fdf9ef" stroke="#aa7b46" stroke-width="8"/><circle cx="100" cy="77" r="48" fill="none" stroke="#d9b47d" stroke-width="3"/>
    <path d="M89 19v-9h23v9" fill="none" stroke="#718096" stroke-width="4"/><path d="M100 106V58m0 28L80 72m20 23l21-18" fill="none" stroke="#31986d" stroke-width="3" stroke-dasharray="3 2"/>
    <g fill="#e98b9b"><ellipse cx="100" cy="49" rx="6" ry="12"/><ellipse cx="90" cy="58" rx="12" ry="6"/><ellipse cx="110" cy="58" rx="12" ry="6"/><ellipse cx="100" cy="67" rx="6" ry="12"/></g>
    <circle cx="100" cy="58" r="6" fill="#f3bd42"/><path d="M78 72q-18-13-22 2 12 14 22-2m45 7q17-13 21-1-8 13-21 1" fill="#82bd8a"/>
    <path d="M152 30l38 57" stroke="#64748b" stroke-width="3"/><ellipse cx="156" cy="36" rx="2" ry="5" transform="rotate(-34 156 36)" fill="#f8fafc"/>
    <path d="M156 36q-20-15-23 1t35 26q36 10 20 32t-37 13" fill="none" stroke="#5489d8" stroke-width="2"/>`),
  'sg-wooden-walkway':()=>scene('Pasarela descubierta de madera sobre un lago',`
    <path d="M0 57h220v83H0" fill="#62bad2"/><path d="M0 59l55-24 35 8 33-16 43 23 54-18v30H0" fill="#8fb5a2"/>
    <path d="M15 140l92-85h15l-63 85" fill="#c3935f" stroke="#876443" stroke-width="2"/>
    <path d="M39 116l38 10m-21-27l34 9M73 83l29 8m-13-23l22 6m-13-17l18 4" stroke="#986d46" stroke-width="2"/>
    <path d="M18 121l91-73m-51 73l65-73" stroke="#8a633e" stroke-width="3"/>
    <path d="M25 115v23m25-43v26m24-46v22m21-39v20m18-32v16m-36 39v30m21-54v24m16-42v19m7-28v14" stroke="#8a633e" stroke-width="3"/>
    <path d="M138 104h36m-35 23h55M8 78h31m143 2h22" stroke="#b8e6ee" stroke-width="3"/>`),
  'sg-shop-hours':()=>scene('Cartel ficticio de horarios de una tienda',`
    <rect x="14" y="14" width="192" height="112" rx="8" fill="#fff" stroke="#94a3b8" stroke-width="3"/>
    <g fill="#172743" font-family="Arial,sans-serif" text-anchor="middle"><text x="110" y="43" font-size="19" font-weight="bold">Öffnungszeiten</text><text x="110" y="72" font-size="16">Montag geschlossen</text><text x="110" y="96" font-size="15">Dienstag–Samstag</text><text x="110" y="117" font-size="16">9–18 Uhr</text></g>`),
  'gr-landwasser':()=>scene('Viaducto de piedra de seis arcos con tren y túnel',`
    <path d="M0 113l66-25 37 22 63-47 54 32v45H0" fill="#9eb49f"/>
    <path d="M8 48h180v87H8z" fill="#c4b49a" stroke="#998975" stroke-width="2"/>
    <g fill="#b4d6de" stroke="#998975" stroke-width="2"><path d="M16 135V88a10 17 0 0 1 20 0v47zm28 0V88a10 17 0 0 1 20 0v47zm28 0V88a10 17 0 0 1 20 0v47zm28 0V88a10 17 0 0 1 20 0v47zm28 0V88a10 17 0 0 1 20 0v47zm28 0V88a10 17 0 0 1 20 0v47z"/></g>
    <path d="M5 50h185M8 57h180" stroke="#8f826f" stroke-width="3"/>
    <path d="M185 0l25 8 10-5v137h-31l-8-35 8-28-9-16z" fill="#7b8790"/><path d="M181 48V36q13-17 25 0v12" fill="#263644" stroke="#c0b6a4" stroke-width="3"/>
    <path d="M24 30h124v16H24z" fill="#d94548"/><path d="M29 34h12v6H29zm20 0h12v6H49zm20 0h12v6H69zm20 0h12v6H89zm20 0h12v6h-12zm20 0h12v6h-12z" fill="#e9f6fc"/>
    <path d="M154 28h29l8 8v10h-37z" fill="#d94548"/><path d="M159 32h13v7h-13" fill="#d9eff7"/><path d="M47 47h-5m40 0h-5m40 0h-5m56 0h-5" stroke="#344451" stroke-width="3"/>`),
  'gr-nusstorte':()=>scene('Tarta de nueces con una porción que muestra el relleno',`
    <ellipse cx="110" cy="115" rx="97" ry="18" fill="#fff" stroke="#cbd5e1" stroke-width="2"/>
    <path d="M28 64q68-37 132-1v37q-63 40-132 1z" fill="#c18b4a" stroke="#98652d" stroke-width="3"/>
    <ellipse cx="94" cy="63" rx="66" ry="29" fill="#e2b56f" stroke="#ad7d40" stroke-width="3"/>
    <path d="M132 64l-34 28 38 16V78z" fill="#f3cf8c"/>
    <path d="M142 85l47-11 10 32-57 15z" fill="#d5a357" stroke="#98652d" stroke-width="2"/>
    <path d="M146 94l44-10 5 17-49 13z" fill="#9f653a"/>
    <g fill="#deb378" stroke="#ad8353" stroke-width="1"><path d="M152 98q3-8 8-2t-4 9q-5-1-4-7m13-4q4-7 8 0t-4 10q-5-2-4-10m15-3q4-5 8 1t-4 9q-5-2-4-10"/></g>
    <path d="M42 63q48-28 103 0M47 72q46-22 94-1" fill="none" stroke="#efcd96" stroke-width="2"/>`),
  'gr-ibex':()=>scene('Íbice alpino sobre una roca con cuernos curvos anillados',`
    <path d="M15 132l28-29 26 12 33-15 34 17 29-8 40 23z" fill="#94a3ad"/>
    <path d="M67 102l-9 22m27-20l5 20m32-23l8 23m11-39l6 31" stroke="#725a43" stroke-width="7"/>
    <ellipse cx="100" cy="83" rx="41" ry="25" fill="#9e8262"/><path d="M126 87l8-34 21 5-4 37" fill="#a78a67"/>
    <path d="M131 53l9-15 23 2 7 12-8 9-25 1" fill="#ad9170"/><path d="M136 44l-12-8 5 15m23 10l3 15 6-17" fill="#715a43"/>
    <path d="M143 41q-29-23-6-31 32-8 38 25m-22 5q-15-20-1-26 23-8 28 15" fill="none" stroke="#5f5143" stroke-width="8" stroke-linecap="round"/>
    <path d="M131 24l8-4m0-8l2 7m8-9l-1 7m11-3l-4 7m13 0l-5 5m10 3l-6 3" stroke="#bba284" stroke-width="2"/>
    <circle cx="158" cy="47" r="2" fill="#202e38"/><path d="M62 76l-13-7" stroke="#927252" stroke-width="6"/>`),
  'gr-sgraffito':()=>scene('Fachada engadinesa con motivos esgrafiados originales',`
    <rect x="19" y="9" width="182" height="122" fill="#eee2cb" stroke="#b3a58c" stroke-width="2"/>
    <path d="M69 110V54q41-36 82 0v56z" fill="#8c8c7e"/>
    <path d="M79 106V58q31-24 62 0v48z" fill="#b4cfda" stroke="#fffaf0" stroke-width="5"/>
    <path d="M110 45v63m-32-30h65" stroke="#fffaf0" stroke-width="4"/>
    <g stroke="#858571" stroke-width="2" fill="none"><path d="M27 16h166M27 121h166M32 34l10-9 10 9-10 9zM168 34l10-9 10 9-10 9zM34 52v52m9-49v43m-9-29l12-10m-12 25l12-9m120-20v49m10-52v52m-10-33l12-10m-12 25l12-9"/><circle cx="110" cy="22" r="8"/><path d="M102 22h16m-8-8v16M56 110l-8 5 8 5m108-10l8 5-8 5"/></g>`),
  'gr-capuns':()=>scene('Rollitos de hojas de acelga con salsa y queso',`
    <ellipse cx="110" cy="92" rx="97" ry="38" fill="#fff" stroke="#c5d4e0" stroke-width="3"/><ellipse cx="109" cy="93" rx="78" ry="23" fill="#f4e5ba"/>
    <g stroke="#3f7047" stroke-width="2"><path d="M45 79q6-12 31-10l22 9q10 14-4 23l-31-1q-18-2-18-21" fill="#6c9b5c"/><path d="M104 72q7-12 31-9l24 8q12 12-3 24l-31-1q-20-1-21-22" fill="#7baa66"/><path d="M92 94q5-10 28-8l24 7q12 11 0 21l-32-1q-17 1-20-19" fill="#608e50"/></g>
    <g fill="none" stroke="#a1bb79" stroke-width="2"><path d="M52 78l34 18m-22-22l9 22m40-22l34 17m-22-23l9 22m-34 4l32 15m-20-18l8 18"/></g>
    <g stroke="#f8edc9" stroke-width="3"><path d="M61 79l12 5m-2 3l11-4m42-9l10 4m2 4l11-4m-35 20l10 4m2 4l11-5"/></g>`),
}
export const EASTERN_ART_LABELS={
  'sg-library':'Biblioteca histórica esquemática','sg-bratwurst':'Bratwurst con panecillo','sg-embroidery':'Bordado original','sg-wooden-walkway':'Pasarela descubierta sobre el lago','sg-shop-hours':'Horario ficticio de una tienda',
  'gr-landwasser':'Viaducto de Landwasser esquemático','gr-nusstorte':'Tarta de nueces','gr-ibex':'Íbice alpino','gr-sgraffito':'Fachada esgrafiada original','gr-capuns':'Capuns esquemáticos',
}
