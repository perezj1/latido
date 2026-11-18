// Original educational scenes. Notices are fictional and have no legal force.
const scene=(label,body)=>`<svg viewBox="0 0 220 140" width="220" height="140" role="img" aria-label="${label}"><rect width="220" height="140" rx="12" fill="#e0f2fe"/>${body}</svg>`
export const UNTERWALDEN_IMG={
  'ow-centre-marker':()=>scene('Pirámide de triangulación en un entorno alpino',`
    <path d="M0 76L37 25l35 44 33-45 49 53 34-46 32 49v60H0" fill="#9cabbc"/><path d="M23 44l14-19 17 22-15-7-7 9m60-8l13-17 20 22-17-9-9 11" fill="#fff"/>
    <path d="M0 107q110-35 220 0v33H0" fill="#9db77b"/>
    <ellipse cx="110" cy="117" rx="63" ry="13" fill="#b8b5a7" stroke="#858e83" stroke-width="3"/><path d="M48 115v9q62 25 124 0v-9" fill="#a5a496"/>
    <path d="M109 19L70 116h80L109 19l-3 108-36-11m36 11l44-11M88 71h44m-34-30h23" fill="none" stroke="#4c6574" stroke-width="4" stroke-linejoin="round"/>
    <rect x="96" y="91" width="28" height="18" rx="2" fill="#e5d9b9" stroke="#6b7b7b" stroke-width="2"/><path d="M102 97h16m-16 5h11" stroke="#7c8b87" stroke-width="2"/>`),
  'ow-alpine-descent':()=>scene('Vacas adornadas descendiendo desde pastos de altura',`
    <path d="M0 81L44 23l52 68 48-52 76 55v46H0" fill="#8fb791"/><path d="M0 110q109-60 220-13v43H0" fill="#a7c87b"/><path d="M73 140q61-32 87-65" fill="none" stroke="#decfa5" stroke-width="18"/>
    <g stroke="#735244" stroke-width="3" stroke-linejoin="round"><path d="M88 76h54v30H88zM89 100v27m15-26v27m25-27v21m12-21v20" fill="#996b4e"/><path d="M133 72l20-5 8 28-19 8z" fill="#b58b6a"/><path d="M140 72l-5-10m17 6l9-8M88 81L76 72" fill="none"/></g>
    <path d="M139 94l17 1-4 13-10-1z" fill="#b99b43" stroke="#8a773e" stroke-width="2"/><path d="M137 72l20-5" stroke="#4c945f" stroke-width="8"/><g fill="#f7cd58"><circle cx="137" cy="71" r="4"/><circle cx="148" cy="68" r="4"/><circle cx="158" cy="65" r="4"/></g><g fill="#f07872"><circle cx="141" cy="65" r="3"/><circle cx="153" cy="62" r="3"/></g>
    <path d="M37 58h35v21H37zm1 20v15m12-15v15m15-15v11m6-11v11m-2-35h13v22H69" fill="#faf5e6" stroke="#8b7762" stroke-width="2"/><path d="M75 55l-6-6m10 6l5-6" stroke="#8b7762" stroke-width="2"/>`),
  'ow-carnival-mask':()=>scene('Máscara festiva inventada y tambor con confeti',`
    <path d="M40 30l18-18 19 18 23-15 16 23 24-9-4 31 11 13-20 18-56-2-27-21z" fill="#f7bd43" stroke="#c98728" stroke-width="2"/>
    <path d="M46 46q44-25 88 0l-5 35q-37 37-76 0z" fill="#a388d6" stroke="#6d5d9c" stroke-width="3"/>
    <path d="M57 57q10-12 23 0l-13 8zm41 0q10-12 23 0l-13 8z" fill="#213653"/><path d="M87 59l-7 18 17-2" fill="#f2c879"/><path d="M71 86q19 17 37-2" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    <path d="M137 90h60v35q-30 18-60 0z" fill="#e57569" stroke="#a64c4e" stroke-width="2"/><ellipse cx="167" cy="90" rx="30" ry="10" fill="#fff2cd" stroke="#a64c4e" stroke-width="2"/><path d="M140 98l12 27 15-25 14 25 13-27" fill="none" stroke="#f6d56e" stroke-width="3"/>
    <path d="M151 80l-16-28m44 28l19-28" stroke="#96724f" stroke-width="4" stroke-linecap="round"/>
    <path d="M14 22l8 5m151-6l6-8m26 18l-8 6M20 84l6-8m88 49l-8 6" stroke="#28a5b7" stroke-width="5"/><path d="M14 112l8 4m135-70l7 5m31 80l10-4" stroke="#ec6c78" stroke-width="5"/>`),
  'ow-water-saw':()=>scene('Agua que mueve una rueda de madera conectada a una sierra',`
    <path d="M0 117h220v23H0" fill="#8db17f"/><path d="M0 52h50v13H0z" fill="#b6a68a"/><path d="M0 54h40v12q0 22 23 29" fill="none" stroke="#4db7d1" stroke-width="9"/>
    <circle cx="65" cy="86" r="36" fill="none" stroke="#986b3e" stroke-width="8"/><circle cx="65" cy="86" r="27" fill="none" stroke="#c4a26c" stroke-width="3"/>
    <path d="M65 49v74M29 86h73M39 60l52 52m-52 0l52-52" stroke="#ad8954" stroke-width="4"/><circle cx="65" cy="86" r="7" fill="#725132"/>
    <path d="M65 86h47l14-25h40" fill="none" stroke="#715e48" stroke-width="4"/><path d="M118 28h80v91m-80 0V28M112 122h92" fill="none" stroke="#9e7749" stroke-width="7"/>
    <rect x="132" y="74" width="66" height="15" rx="5" fill="#c4a571" stroke="#8e7049" stroke-width="2"/><path d="M160 38v68l6-7-6-6 6-6-6-6 6-6-6-6 6-6-6-6" fill="#cbd5e1" stroke="#698093" stroke-width="2"/>
    <path d="M8 125h39m-14 8h38" stroke="#a9e3ed" stroke-width="3"/>`),
  'ow-viewing-notice':()=>scene('Anuncio ficticio de visita de vivienda con cita acordada',`
    <rect x="12" y="10" width="196" height="121" rx="8" fill="#fff" stroke="#a9bacd" stroke-width="2"/>
    <path d="M30 66l26-24 26 24-6 0v35H37V66z" fill="#a8c9df"/><path d="M27 65l29-27 30 27" fill="none" stroke="#d87969" stroke-width="5"/><path d="M51 101V82h14v19" fill="#fff"/>
    <g text-anchor="middle" font-family="Arial,sans-serif" fill="#172743"><text x="137" y="49" font-size="15" font-weight="bold">Besichtigung</text><text x="137" y="72" font-size="15">nach</text><text x="137" y="94" font-size="15">Vereinbarung</text><text x="110" y="121" font-size="9" fill="#64748b">EJEMPLO · SIN VALIDEZ REAL</text></g>`),
  'nw-open-deck':()=>scene('Teleférico de dos niveles con cubierta superior abierta',`
    <path d="M0 25L220 5m-88 8v26m15-27v27" stroke="#637d90" stroke-width="3"/><path d="M118 39h43v16h-43" fill="none" stroke="#8b9ea9" stroke-width="5"/>
    <path d="M50 58h125v51q-62 29-125 0z" fill="#e8eef3" stroke="#7d929e" stroke-width="3"/>
    <path d="M59 75h107v29H59z" fill="#58a9c7"/><path d="M85 75v29m28-29v29m27-29v29" stroke="#fff" stroke-width="3"/>
    <path d="M50 58V40m125 18V40M50 43h125m-100 0v15m25-15v15m25-15v15m25-15v15" stroke="#7d929e" stroke-width="3"/>
    <g fill="#e5b58a"><circle cx="79" cy="32" r="5"/><circle cx="114" cy="31" r="5"/><circle cx="148" cy="33" r="5"/></g><path d="M73 43V39q6-8 12 0v4m23 0V38q6-8 12 0v5m22 0V40q6-8 12 0v3" fill="#dd785b"/>
    <path d="M0 140l33-30 26 19 31-10 38 21m11 0l30-20 19 8 32-31v43" fill="#98b9a0"/>`),
  'nw-cliff-lift':()=>scene('Ascensor exterior con pasarela junto a una pared rocosa sobre el lago',`
    <path d="M0 65l58-15 20-31 32 4v106H0" fill="#9da39c"/><path d="M0 91l58-29 18-34 14 3v98H0" fill="#7e8f8b"/><path d="M0 122h220v18H0" fill="#56b6d2"/>
    <path d="M135 19v104m18-104v104m-18-104h18m-18 25l18-25m-18 25l18 23m-18 0l18-23m-18 23l18 24m-18 0l18-24m-18 24l18 28m-18 0l18-28" fill="none" stroke="#647f8d" stroke-width="3"/>
    <path d="M78 23h83m-83 0V11m83 12V11M78 13h83m-63 0v10m21-10v10m21-10v10" stroke="#6e8794" stroke-width="3"/>
    <rect x="131" y="67" width="26" height="23" rx="3" fill="#d4e8ef" stroke="#6e8794" stroke-width="2"/><path d="M144 68v21" stroke="#6e8794" stroke-width="2"/>
    <path d="M172 125h31m-27 9h37" stroke="#bdebf3" stroke-width="3"/><path d="M13 36l37-10 28-12" stroke="#b7c694" stroke-width="6"/>`),
  'nw-glass-blowing':()=>scene('Trabajo de soplado de vidrio caliente junto a un horno',`
    <path d="M152 117V44q0-32 30-32t30 32v73" fill="#9b897a" stroke="#756857" stroke-width="3"/><path d="M164 80V46q0-21 18-21t18 21v34z" fill="#ef9949"/><path d="M171 72V49q0-15 11-15t11 15v23z" fill="#f9d87f"/>
    <circle cx="44" cy="37" r="12" fill="#d9b392"/><path d="M31 32q5-19 22-9l4 11" fill="#577c96"/><path d="M34 50h21l14 43H25z" fill="#5994aa"/><path d="M32 91l-2 39m26-39l7 39" stroke="#465b72" stroke-width="9"/>
    <path d="M52 57l24 16 21-10m-57 1l22 22 27-10" fill="none" stroke="#d9b392" stroke-width="7" stroke-linecap="round"/>
    <path d="M53 38l96 47" stroke="#536877" stroke-width="3"/><path d="M145 80q23-10 28 11 2 18-17 18-20-4-11-29" fill="#f48b36" stroke="#df6728" stroke-width="2"/><path d="M153 86q13-3 12 13" fill="none" stroke="#ffd77a" stroke-width="4"/>
    <path d="M92 117h47m-36 0v20m25-20v20" stroke="#8a7760" stroke-width="5"/>`),
  'nw-paper-calendar':()=>scene('Calendario ficticio: Mittwoch, Papier und Karton',`
    <rect x="12" y="9" width="196" height="123" rx="8" fill="#fff" stroke="#a9bacd" stroke-width="2"/><path d="M12 37h196V18q0-9-9-9H21q-9 0-9 9z" fill="#6c9ab3"/>
    <g text-anchor="middle" font-family="Arial,sans-serif"><text x="110" y="28" font-size="17" font-weight="bold" fill="#fff">Mittwoch</text><text x="110" y="60" font-size="17" fill="#172743">Papier und Karton</text><text x="110" y="123" font-size="9" fill="#64748b">EJEMPLO · SIN VALIDEZ REAL</text></g>
    <path d="M36 106l4-33 48 5-3 32z" fill="#e0e7ef" stroke="#8e9fb2" stroke-width="2"/><path d="M46 84l35 4m-36 3l34 4m-35 3l33 3" stroke="#9ba9b6" stroke-width="2"/>
    <path d="M117 86l29-16 35 15v23h-64z" fill="#d5b88b" stroke="#9b7d53" stroke-width="2"/><path d="M117 86l32 14 32-15m-32 15v9" fill="none" stroke="#9b7d53" stroke-width="2"/>`),
  'nw-clean-after-use':()=>scene('Aviso ficticio de lavadero: limpiar después de usar',`
    <rect x="10" y="9" width="200" height="123" rx="8" fill="#fff" stroke="#a9bacd" stroke-width="2"/>
    <g text-anchor="middle" font-family="Arial,sans-serif" fill="#172743"><text x="110" y="31" font-size="16" font-weight="bold">Nach Gebrauch</text><text x="110" y="52" font-size="16" font-weight="bold">reinigen</text><text x="110" y="123" font-size="9" fill="#64748b">EJEMPLO · SIN VALIDEZ REAL</text></g>
    <rect x="35" y="62" width="59" height="48" rx="4" fill="#d3e0ed" stroke="#708ca5" stroke-width="2"/><circle cx="64" cy="88" r="16" fill="#80c9e2" stroke="#708ca5" stroke-width="2"/><path d="M44 68h8m26 0h8" stroke="#708ca5" stroke-width="3"/>
    <path d="M128 88h43l-5 22h-32z" fill="#71bacd" stroke="#5c8e9d" stroke-width="2"/><path d="M132 89q17-40 36 0" fill="none" stroke="#5c8e9d" stroke-width="2"/><path d="M107 73l23-9 14 12-24 10z" fill="#e1c574" stroke="#b2984e" stroke-width="2"/>`),
}
export const UNTERWALDEN_ART_LABELS={
  'ow-centre-marker':'Pirámide de triangulación en Älggialp',
  'ow-alpine-descent':'Regreso del ganado desde los pastos alpinos',
  'ow-carnival-mask':'Máscara festiva y tambor, dibujo original',
  'ow-water-saw':'Sierra de madera movida por agua, esquema',
  'ow-viewing-notice':'Visita de vivienda con cita, aviso ficticio',
  'nw-open-deck':'Teleférico con cubierta superior abierta, esquema',
  'nw-cliff-lift':'Ascensor exterior junto a una pared rocosa',
  'nw-glass-blowing':'Oficio del soplado de vidrio caliente',
  'nw-paper-calendar':'Recogida de papel y cartón, calendario ficticio',
  'nw-clean-after-use':'Limpiar después del uso, aviso ficticio',
}
