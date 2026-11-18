// Original teaching drawings; neither product packaging nor artwork is copied.
const scene=(label,body)=>`<svg viewBox="0 0 220 140" width="220" height="140" role="img" aria-label="${label}"><rect width="220" height="140" rx="12" fill="#e0f2fe"/>${body}</svg>`
export const GLARUS_ZUG_IMG={
  'gl-rock-window':()=>scene('Abertura natural en una cresta y luz hacia una iglesia',`
    <path d="M0 56l22-20 22 16 27-39 27 28 21-22 28 31 22-18 51 37v71H0" fill="#8a9ba9"/><path d="M44 52l27-39 27 28-19-11-12 15z" fill="#c6d4db"/>
    <path d="M111 37l11 17h-21z" fill="#e0f2fe"/><path d="M111 45L35 126h27l51-74" fill="#ffe9a2" opacity=".8"/>
    <path d="M0 132q101-38 220-10v18H0" fill="#91b47f"/><path d="M31 114h47v22H31z" fill="#f3ead8" stroke="#8b8a79" stroke-width="1.5"/><path d="M27 115l28-19 27 19" fill="#a36654"/>
    <path d="M41 100h13v36H41z" fill="#f5edda" stroke="#8b8a79" stroke-width="1.5"/><path d="M39 100l9-22 9 22" fill="#737e86"/><path d="M45 110h5m12 12h6" stroke="#758c9d" stroke-width="4"/>`),
  'gl-green-cheese':()=>scene('Pequeño cono truncado de queso verde claro con hierbas',`
    <ellipse cx="111" cy="117" rx="91" ry="14" fill="#b88c59" stroke="#916a40" stroke-width="2"/><path d="M74 34h60l30 73q-58 26-115 0z" fill="#a5bc74" stroke="#6d8b53" stroke-width="3"/><ellipse cx="104" cy="34" rx="30" ry="10" fill="#c3d492" stroke="#6d8b53" stroke-width="3"/>
    <path d="M104 46l-17 64" fill="none" stroke="#c8d79e" stroke-width="6"/><g fill="#7b995d"><ellipse cx="77" cy="71" rx="3" ry="2"/><ellipse cx="119" cy="61" rx="2" ry="3"/><ellipse cx="133" cy="89" rx="3" ry="2"/><ellipse cx="102" cy="91" rx="2" ry="3"/><ellipse cx="70" cy="101" rx="3" ry="2"/></g>
    <path d="M165 121V87m0 13l-12-12m12 19l12-12" stroke="#5d915a" stroke-width="3"/><g fill="#98b764"><ellipse cx="151" cy="86" rx="7" ry="4"/><ellipse cx="178" cy="93" rx="7" ry="4"/></g><g fill="#80a7de"><circle cx="165" cy="80" r="5"/><circle cx="161" cy="84" r="4"/><circle cx="170" cy="85" r="4"/></g>`),
  'gl-printed-cloth':()=>scene('Paño cuadrado de algodón con estampado geométrico original',`
    <path d="M44 12l143 7-5 111-147-8z" fill="#cf5357" stroke="#a34049" stroke-width="3"/><path d="M52 22l126 6-4 92-130-6z" fill="none" stroke="#f5d6b4" stroke-width="4"/>
    <path d="M61 31l108 5-3 74-111-5z" fill="none" stroke="#f5d6b4" stroke-width="1.5"/>
    <g fill="#f9dfbf"><circle cx="110" cy="69" r="17"/><path d="M75 43l7 8-8 7-7-8zm68 3l7 8-8 7-7-8zM72 86l7 8-8 7-7-8zm69 3l7 8-8 7-7-8z"/></g><circle cx="110" cy="69" r="9" fill="#cf5357"/>
    <g fill="#ebaf87"><circle cx="111" cy="39" r="3"/><circle cx="109" cy="100" r="3"/><circle cx="78" cy="68" r="3"/><circle cx="144" cy="71" r="3"/></g><path d="M45 119l-10 3 8-108 6 1m133 14l5-10-5 111-8-3" fill="#b5454b"/>
    <path d="M33 130l154 7" stroke="#b3cbd8" stroke-width="3" stroke-linecap="round"/>`),
  'gl-rock-layers':()=>scene('Modelo didáctico de rocas antiguas por encima de rocas jóvenes',`
    <path d="M14 67l32-31 26 14 36-32 32 33 27-16 39 31v59H14z" fill="#a77b69" stroke="#866250" stroke-width="2"/>
    <path d="M14 78q53-15 99-4t93-3v54H14z" fill="#c6c9c0"/>
    <path d="M14 93q53-15 99-4t93-3v12q-45 15-93 3T14 106z" fill="#97a9ac"/>
    <path d="M14 78q53-15 99-4t93-3" fill="none" stroke="#ecd58a" stroke-width="5"/>
    <path d="M145 51h-32m9-7l-10 7 10 7" fill="none" stroke="#fff2cd" stroke-width="3"/>
    <g font-family="Arial,sans-serif" font-weight="bold" text-anchor="middle"><text x="74" y="65" font-size="17" fill="#fff">ALT</text><text x="111" y="116" font-size="17" fill="#243d50">JUNG</text></g>`),
  'gl-wildlife-notice':()=>scene('Panel ficticio: rutas señaladas y perros con correa',`
    <rect x="9" y="9" width="202" height="123" rx="8" fill="#fff" stroke="#8da78d" stroke-width="3"/>
    <g text-anchor="middle" font-family="Arial,sans-serif" fill="#243d50"><text x="110" y="29" font-size="15" font-weight="bold">Wildruhezone</text><text x="110" y="51" font-size="15">Markierte Routen</text><text x="110" y="73" font-size="15">Hunde an die Leine</text><text x="110" y="123" font-size="9" fill="#64748b">EJEMPLO · SIN VALIDEZ REAL</text></g>
    <path d="M40 110l17-29m-17 15h31m-7-6l7 6-7 6" fill="none" stroke="#7c9b68" stroke-width="4"/>
    <path d="M123 89h36v14h-36zm31-7h13v17h-13zm-27 21v9m27-9v9m-30-19l-8-9" fill="#526d7b" stroke="#526d7b" stroke-width="3"/><path d="M160 86l22-8" stroke="#cc9856" stroke-width="3"/>`),
  'zg-clock-tower':()=>scene('Torre esquemática con puerta, reloj y tejado azul y blanco',`
    <path d="M0 125h220v15H0" fill="#d8d3c2"/><path d="M74 39h72v91H74z" fill="#f0ddba" stroke="#9e8e77" stroke-width="2"/>
    <path d="M66 40l44-35 44 35z" fill="#5687ab" stroke="#52748b" stroke-width="2"/><path d="M80 29l8 7 9-15 10 9 10-18 9 16 10 3" fill="none" stroke="#eff5ee" stroke-width="6"/>
    <circle cx="110" cy="61" r="16" fill="#3f6077" stroke="#b9a264" stroke-width="3"/><path d="M110 49v12l8 5" fill="none" stroke="#f4dc94" stroke-width="2"/>
    <circle cx="110" cy="94" r="9" fill="#50758a" stroke="#b9a264" stroke-width="2"/><circle cx="110" cy="94" r="4" fill="#dbc98b"/>
    <path d="M96 130v-13q14-18 28 0v13" fill="#5b645f" stroke="#a18f75" stroke-width="2"/><path d="M89 86h4m34 0h4" stroke="#967f61" stroke-width="5"/>
    <path d="M23 130V83h39v47m99 0V94h35v36" fill="#dfb59a"/><path d="M18 83l25-20 24 20m88 11l23-19 24 19" fill="#bb7e66"/>
    <circle cx="110" cy="6" r="4" fill="#dab464"/>`),
  'zg-cave-drips':()=>scene('Cueva con estalactitas colgantes y estalagmitas desde el suelo',`
    <rect width="220" height="140" rx="12" fill="#385969"/><path d="M0 0h220v26l-16-5-10 13-18-10-17 9-14-12-19 12-18-7-19 9-18-12-21 9-19-12L0 32z" fill="#b6a387"/>
    <path d="M38 25l12 53 11-49m27 3l8 32 10-37m32-2l12 60 14-56m24-2l8 38 10-41" fill="#d8c3a0" stroke="#b6a387" stroke-width="2"/>
    <path d="M0 140v-17l23 4 19-8 28 9 31-13 24 10 27-7 20 9 24-8 24 4v17" fill="#9f8d74"/>
    <path d="M60 128l10-39 11 38m25-6l9-24 10 30m35-5l9-43 12 46" fill="#c7b18d" stroke="#aa9676" stroke-width="2"/>
    <path d="M50 85q-5 8 0 8t0-8m99 10q-4 7 0 7t0-7" fill="#9bd8e7"/><ellipse cx="44" cy="126" rx="24" ry="4" fill="#69aabf"/>`),
  'zg-cherry-race':()=>scene('Dos participantes transportan una escalera en una calle de Zug',`
    <path d="M0 113h220v27H0" fill="#d5c9b2"/><path d="M5 114V49h35v65m153 0V53h27v61" fill="#ead8ba"/><path d="M0 49l23-17 22 17m141 4l31-22 28 22" fill="#b47460"/>
    <g fill="#dbb18c"><circle cx="56" cy="61" r="9"/><circle cx="149" cy="61" r="9"/></g>
    <path d="M48 72h17l7 25H42z" fill="#5f9fc2"/><path d="M141 72h17l10 25h-30z" fill="#df7e70"/>
    <path d="M50 97l-17 25m28-25l13 17m70-17l-15 26m27-26l20 19" fill="none" stroke="#3b536c" stroke-width="6" stroke-linecap="round"/>
    <path d="M63 76l18 6m71-5l15 5" stroke="#dbb18c" stroke-width="6" stroke-linecap="round"/>
    <path d="M35 82h155m-155-13h155m-143 0v13m20-13v13m20-13v13m20-13v13m20-13v13m20-13v13m20-13v13" stroke="#ac8553" stroke-width="4"/>
    <path d="M84 21l16 9 19-15m-19 15v12m19-27v15" stroke="#608050" stroke-width="2"/><circle cx="99" cy="42" r="6" fill="#c64e52"/><circle cx="119" cy="32" r="6" fill="#c64e52"/><path d="M100 28q4-17 20-17-2 13-20 17" fill="#7b9c65"/>`),
  'zg-kirsch-cake':()=>scene('Tarta clara con bizcocho, crema y almendras en los lados',`
    <ellipse cx="109" cy="119" rx="95" ry="13" fill="#bacbd5"/><path d="M37 55h145v50q-72 29-145 0z" fill="#e8c8b3" stroke="#b79f87" stroke-width="2"/>
    <ellipse cx="109" cy="55" rx="73" ry="28" fill="#fff6df" stroke="#c8b79a" stroke-width="2"/>
    <path d="M49 44l76 36m-55-48l86 36M46 68l75-37m-39 51l82-40" stroke="#dfc9a8" stroke-width="1.5"/>
    <g fill="#e7bd7c" stroke="#c49a59" stroke-width="1"><ellipse cx="49" cy="89" rx="3" ry="8" transform="rotate(-22 49 89)"/><ellipse cx="62" cy="103" rx="3" ry="7" transform="rotate(25 62 103)"/><ellipse cx="73" cy="92" rx="3" ry="7"/><ellipse cx="88" cy="108" rx="3" ry="7" transform="rotate(-25 88 108)"/><ellipse cx="149" cy="100" rx="3" ry="7"/><ellipse cx="166" cy="88" rx="3" ry="7" transform="rotate(20 166 88)"/></g>
    <path d="M109 83l27-16 27 14v30q-30 15-54 5z" fill="#faf1d5" stroke="#c8b79a" stroke-width="1.5"/>
    <path d="M111 97l27-14 23 10v12l-25-9-25 13z" fill="#e8b8b2"/><path d="M111 112l25-13 25 9v5l-25-7-25 13z" fill="#d9b96f"/>`),
  'zg-pile-dwelling':()=>scene('Reconstrucción genérica de casas de madera sobre postes junto al lago',`
    <path d="M0 85q100-24 220-6v61H0" fill="#70bdd3"/><path d="M0 81q33-9 59 10l-9 49H0" fill="#91b27b"/>
    <path d="M67 103V47h62v56M67 72h62" fill="#c2a575" stroke="#876d45" stroke-width="2"/><path d="M59 48l40-28 40 28z" fill="#ad915d" stroke="#8a7448" stroke-width="2"/>
    <path d="M66 39l66 3m-53-13l39 7" stroke="#d2b781" stroke-width="3"/>
    <path d="M73 103v25m23-25v25m26-25v24M52 101h91m-91 0l-8 24m86-24l8 24" stroke="#846e4b" stroke-width="5"/>
    <path d="M87 100V76h18v24" fill="#5c5b49"/><path d="M111 58h11v12h-11" fill="#536c72"/>
    <path d="M147 83V55h40v28m-41 0v27m35-27v26" fill="#b9a079" stroke="#876d45" stroke-width="2"/><path d="M140 55l28-21 26 21z" fill="#bda66d"/>
    <path d="M54 128h31m52-10h46m-27 16h30" stroke="#b5e8ee" stroke-width="3"/><path d="M13 123V91m0 19l-8-11m8 3l9-17" stroke="#567c54" stroke-width="3"/>`),
}
export const GLARUS_ZUG_ART_LABELS={
  'gl-rock-window':'Martinsloch y luz sobre Elm, esquema',
  'gl-green-cheese':'Cono de queso verdoso con hierbas',
  'gl-printed-cloth':'Paño estampado, diseño original',
  'gl-rock-layers':'Capas antiguas sobre jóvenes, modelo didáctico',
  'gl-wildlife-notice':'Rutas y correa, panel ficticio',
  'zg-clock-tower':'Torre de puerta y reloj de Zug, esquema',
  'zg-cave-drips':'Formaciones calcáreas de una cueva',
  'zg-cherry-race':'Carrera con escalera y cerezas',
  'zg-kirsch-cake':'Tarta de bizcocho y crema con almendras',
  'zg-pile-dwelling':'Palafitos junto al lago, reconstrucción genérica',
}
