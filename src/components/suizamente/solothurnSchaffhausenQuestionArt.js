// Original schematic drawings: no photographs, commercial labels or copied murals.
const scene=(label,body)=>`<svg viewBox="0 0 220 140" width="220" height="140" role="img" aria-label="${label}"><rect width="220" height="140" rx="12" fill="#e0f2fe"/>${body}</svg>`
export const SOLOTHURN_SCHAFFHAUSEN_IMG={
 'so-eleven-clock':()=>scene('Reloj didáctico con once números',`
 <rect x="46" y="6" width="128" height="128" rx="16" fill="#ad9170"/><circle cx="110" cy="70" r="56" fill="#fff8e7" stroke="#755c45" stroke-width="3"/>
 <g font-family="Arial,sans-serif" font-size="12" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="#243c50"><text x="110" y="27">11</text><text x="133" y="34">1</text><text x="149" y="52">2</text><text x="153" y="77">3</text><text x="143" y="98">4</text><text x="122" y="111">5</text><text x="98" y="111">6</text><text x="77" y="98">7</text><text x="67" y="77">8</text><text x="71" y="52">9</text><text x="87" y="34">10</text></g>
 <path d="M110 70V43m0 27l21 15" fill="none" stroke="#375a74" stroke-width="4" stroke-linecap="round"/><circle cx="110" cy="70" r="5" fill="#d49a50"/>`),
 'so-stork-roof':()=>scene('Cigüeña blanca en un nido sobre un tejado',`
 <path d="M0 125h220v15H0" fill="#9fbb7b"/><path d="M41 111h139v29H41" fill="#efdfbc"/><path d="M23 114l89-43 86 43z" fill="#af705b"/><path d="M33 112l77-34 76 34m-120-2l15-19m28 19l1-31m26 31l-9-23m30 23l-13-15" fill="none" stroke="#c58e71" stroke-width="2"/>
 <ellipse cx="113" cy="76" rx="38" ry="9" fill="#947349"/><path d="M78 73l72 6m-66 4l60-11m-55 7l51-9m-54-1l57 13" stroke="#bc9a6c" stroke-width="2"/>
 <path d="M106 51l-3 24m15-23l4 23" stroke="#c35b43" stroke-width="3"/><ellipse cx="111" cy="46" rx="23" ry="13" fill="#fffdf0" stroke="#a9b6ba" stroke-width="1.5"/><path d="M91 43q5 22 35 9l-16-14z" fill="#354859"/>
 <path d="M127 43q12-4 10-21" fill="none" stroke="#fffdf0" stroke-width="10" stroke-linecap="round"/><circle cx="136" cy="20" r="7" fill="#fffdf0"/><circle cx="139" cy="18" r="1.5" fill="#23374b"/><path d="M142 21l25 6-25-1z" fill="#d26949"/><path d="M74 38q-10-8-18 0m-7-11q-8-6-14 0" fill="none" stroke="#9bb8c8" stroke-width="2"/>`),
 'so-hermit-gorge':()=>scene('Arroyo en una garganta boscosa hacia una ermita',`
 <path d="M0 0h42l19 33-12 31 12 28-15 48H0m220-140h-42l-19 33 12 31-12 28 15 48h46" fill="#9aa89c"/><path d="M0 18l25 13-6 23 22 17-20 37 7 32H0m220-122l-25 13 6 23-22 17 20 37-7 32h28" fill="#b4beb0"/>
 <path d="M100 83q21 5 10 18t-8 18l30 21H73l19-25q-7-17 12-23z" fill="#70b7c9"/><path d="M105 99l8 4m-21 24l24 6" stroke="#d9f1ec" stroke-width="2"/>
 <path d="M75 140l13-37 5-17" fill="none" stroke="#d7c6a1" stroke-width="9"/><path d="M98 83V58h38v25" fill="#f2e6c9" stroke="#9a8f76" stroke-width="1.5"/><path d="M93 59l25-20 25 20" fill="#8a7967"/><path d="M112 83V68q6-7 12 0v15" fill="#516a65"/>
 <path d="M45 71V17m128 53V12" stroke="#6e8053" stroke-width="6"/><g fill="#5d8f69"><ellipse cx="44" cy="15" rx="29" ry="20"/><ellipse cx="172" cy="12" rx="31" ry="22"/></g><g fill="#88aa75"><circle cx="56" cy="32" r="19"/><circle cx="161" cy="32" r="19"/></g>`),
 'so-leash-notice':()=>scene('Aviso didáctico de correa en bosque de abril a julio',`
 <rect x="8" y="7" width="204" height="127" rx="9" fill="#fff" stroke="#7b9b78" stroke-width="3"/>
 <g font-family="Arial,sans-serif" text-anchor="middle" fill="#233c50"><text x="110" y="30" font-size="17" font-weight="bold">1. April – 31. Juli</text><text x="110" y="53" font-size="16">Hunde an die Leine</text><text x="110" y="123" font-size="9" fill="#64748b">EJEMPLO · SIN VALIDEZ REAL</text></g>
 <path d="M53 80h46v17H53zm38-14h17v22H91zM57 96v14m34-14v14M53 85l-13-10" fill="#516d7b" stroke="#516d7b" stroke-width="4"/><path d="M104 69l29-10" stroke="#cf9a50" stroke-width="3"/><path d="M150 88l16-27 16 27h-8l13 22h-43l14-22z" fill="#71a078"/>`),
 'so-underground-bin':()=>scene('Contenedor soterrado y bolsa de ejemplo con tasa',`
 <path d="M0 102h220v38H0" fill="#c8d0cf"/><path d="M17 108l97-16 34 21-99 18z" fill="#9ba9ac" stroke="#82959e" stroke-width="2"/>
 <path d="M47 105V38l49-8 15 14v60l-55 10z" fill="#718d98" stroke="#4e6e7f" stroke-width="2"/><path d="M47 38l49-8 15 14-53 9z" fill="#9cabb1"/><path d="M57 58l41-7v18l-41 7z" fill="#263e50"/><path d="M58 88l39-6" stroke="#acc1c8" stroke-width="2"/>
 <path d="M159 63l-9-15 17 5 12-9 12 8-9 12m-23-1h23l16 45q5 12-9 12h-38q-13 0-9-12z" fill="#5c9f98" stroke="#437e7c" stroke-width="2"/><path d="M157 65h28" stroke="#f3e8c6" stroke-width="3"/>
 <g text-anchor="middle" font-family="Arial,sans-serif" fill="#fff"><text x="171" y="89" font-size="10" font-weight="bold">CON TASA</text><text x="171" y="103" font-size="8">EJEMPLO</text></g>`),
 'sh-round-fortress':()=>scene('Fortaleza circular esquemática con torre lateral',`
 <path d="M0 130q85-65 220-7v17H0" fill="#8cb17d"/><path d="M32 89q0-32 81-32t81 32v30q-83 32-162 0z" fill="#c4b99f" stroke="#8d8e7d" stroke-width="2"/><ellipse cx="113" cy="85" rx="81" ry="29" fill="#d7ccb2" stroke="#8d8e7d" stroke-width="2"/><ellipse cx="113" cy="86" rx="66" ry="20" fill="#a2a893"/>
 <path d="M152 91V32h30v70" fill="#d9ccb0" stroke="#929481" stroke-width="2"/><path d="M148 33l19-25 19 25z" fill="#987966"/><path d="M161 42h11v15h-11" fill="#567480"/><path d="M158 67h18" stroke="#ab9b7e" stroke-width="2"/>
 <path d="M44 100v11m23-5v12m23-8v13m25-12v14m24-15v13m25-18v13m19-19v11" stroke="#89917d" stroke-width="3"/>
 <path d="M56 119q53-13 95 0" fill="none" stroke="#b1a486" stroke-width="2"/><path d="M8 126l15-24 15 24m161 2l10-27 11 27" fill="#568666"/>`),
 'sh-rhine-falls':()=>scene('Catarata ancha con espuma y roca central',`
 <path d="M0 49h220v91H0" fill="#66b4ce"/><path d="M0 66q36-8 75-4t72-1 73 2v31q-51-12-107 2T0 92z" fill="#d8eef0"/>
 <path d="M15 66l-6 25m27-27l-3 29m25-30l-2 26m27-26v29m53-29l3 26m20-26l6 30m19-29l8 28m15-26l5 27" stroke="#f7fcf7" stroke-width="7" stroke-linecap="round"/>
 <path d="M92 78l7-43 13-15 14 23 6 36z" fill="#8c9c8a" stroke="#6e857a" stroke-width="2"/><path d="M100 36l9-11 5 31-10 15z" fill="#adbaa0"/>
 <path d="M0 38l31-5 19 17-5 16-45 8m220-36l-26-6-26 17 5 17 47 9" fill="#87aa78"/>
 <path d="M17 108q17-9 37 0m37 9q26-11 49 0m25-14q20-8 40 0M38 130h31m89-2h28" fill="none" stroke="#d5f0f0" stroke-width="3" stroke-linecap="round"/>`),
 'sh-bay-window':()=>scene('Mirador cerrado que sobresale de una fachada',`
 <path d="M41 12h140v128H41z" fill="#efd9b8"/><path d="M35 13h151" stroke="#b19070" stroke-width="5"/><path d="M58 23h22v26H58m85-26h22v26h-22" fill="#7fabbc" stroke="#a08c70" stroke-width="3"/>
 <path d="M69 61l33-14 50 12-15 14H86z" fill="#b48662" stroke="#8a7158" stroke-width="2"/>
 <path d="M70 64v46l28 14V54z" fill="#c9aa7a" stroke="#957c58" stroke-width="2"/><path d="M98 54l53 11v46l-53 13z" fill="#e1c599" stroke="#957c58" stroke-width="2"/>
 <path d="M78 69l13-6v44l-13-6zm28-6l16 4v43l-16 4zm23 5l14 3v33l-14 5z" fill="#a7d1dc" stroke="#8c957e" stroke-width="2"/>
 <path d="M78 85l13 3m15-2l16 1m7 0l14 2" stroke="#7f8d7c" stroke-width="2"/><path d="M74 111l24 20 47-18-47 11z" fill="#ad8f68"/><path d="M96 132v8" stroke="#a4825e" stroke-width="5"/>`),
 'sh-painted-houses':()=>scene('Casas medievales con decoraciones geométricas originales',`
 <path d="M0 124h220v16H0" fill="#c4c9c6"/><path d="M12 41h58v88H12m62-104h76v104H74m81-82h53v82h-53" fill="#eee1c1" stroke="#ab9e83" stroke-width="2"/>
 <path d="M5 41L41 9l35 32m-8-16l44-24 44 24m-7 22l32-34 33 34" fill="#a26e5c"/>
 <path d="M79 30h64v14H79zM79 75h64v13H79z" fill="#95aea0"/><g fill="#c7866d"><path d="M23 59l8-8 8 8-8 8zm22 0l8-8 8 8-8 8zM22 101l8-8 8 8-8 8zm22 0l8-8 8 8-8 8z"/></g>
 <path d="M160 52h41m-41 35h41m-41 34V52m41 69V52m-41 0l41 35m0-35l-41 35" fill="none" stroke="#92775e" stroke-width="3"/>
 <g fill="#7397aa" stroke="#f7edda" stroke-width="2"><path d="M86 51h16v18H86zm35 0h16v18h-16zM24 74h15v17H24zm22 0h15v17H46zM165 94h12v17h-12zm20 0h12v17h-12z"/></g><path d="M97 129v-27q13-19 26 0v27" fill="#8e8471"/>`),
 'sh-laundry-friday':()=>scene('Aviso ficticio de lavadero para viernes de 16 a 18 horas',`
 <rect x="9" y="9" width="202" height="122" rx="9" fill="#fff" stroke="#94a7ba" stroke-width="3"/>
 <g text-anchor="middle" font-family="Arial,sans-serif" fill="#243c50"><text x="110" y="32" font-size="18" font-weight="bold">Waschplan</text><text x="140" y="68" font-size="18">Freitag</text><text x="140" y="96" font-size="18" font-weight="bold">16–18 Uhr</text><text x="110" y="122" font-size="9" fill="#64748b">EJEMPLO · TURNO FICTICIO</text></g>
 <rect x="23" y="48" width="48" height="61" rx="5" fill="#d2e2e9" stroke="#6d879c" stroke-width="2"/><circle cx="47" cy="84" r="16" fill="#7fc4df" stroke="#6d879c" stroke-width="2"/><path d="M32 58h9m12 0h8m-27 31q12 9 25-2" fill="none" stroke="#f0faf9" stroke-width="3"/>`),
}
export const SOLOTHURN_SCHAFFHAUSEN_ART_LABELS={
 'so-eleven-clock':'Reloj didáctico de once horas',
 'so-stork-roof':'Cigüeña de Altreu',
 'so-hermit-gorge':'Garganta de Verena',
 'so-leash-notice':'Aviso de correa de Solothurn',
 'so-underground-bin':'Contenedor soterrado municipal',
 'sh-round-fortress':'Fortaleza del Munot',
 'sh-rhine-falls':'Rheinfall',
 'sh-bay-window':'Mirador Erker',
 'sh-painted-houses':'Casas evocando Stein am Rhein',
 'sh-laundry-friday':'Turno de lavadero del viernes',
}
