// Original schematic teaching scenes. No external photographs or copied marks.
const scene=(label,body)=>`<svg viewBox="0 0 220 140" width="220" height="140" role="img" aria-label="${label}"><rect width="220" height="140" rx="12" fill="#e4f2f8"/>${body}</svg>`
const notice=(title,body,footer)=>scene(title,`<rect x="9" y="10" width="202" height="120" rx="10" fill="#fff" stroke="#9caec6" stroke-width="3"/><g text-anchor="middle" font-family="Arial,sans-serif" fill="#253952">${body}<text x="110" y="122" font-size="8" fill="#64748b">${footer}</text></g>`)
export const NEUCHATEL_JURA_IMG={
 'ne-rock-cirque':()=>scene('Circo rocoso esquemático en forma de anfiteatro',`
 <path d="M0 88q110-100 220 0v52H0" fill="#97b58b"/><path d="M9 65Q110-24 211 65l-17 45Q110 25 26 110z" fill="#c4c2af" stroke="#92988d" stroke-width="2"/>
 <path d="M9 65Q110-24 211 65l-8 10Q110-5 17 75z" fill="#e0ddc9"/>
 <path d="M32 52l7 43m14-54l6 40m17-47l4 38m27-43v35m25-32l-3 36m23-30l-6 39m25-29l-7 39m23-28l-9 41" stroke="#8f958a" stroke-width="2"/>
 <path d="M0 120q98-60 220 0v20H0" fill="#8daa76"/><path d="M105 140q-3-25 23-40" fill="none" stroke="#e6d4ad" stroke-width="5"/>
 <path d="M19 117l8-20 9 20zm160 8l10-25 11 25z" fill="#527a5c"/>`),
 'ne-watch-bench':()=>scene('Banco de trabajo con mecanismo de reloj, lupa y pinzas',`
 <path d="M10 109h200v12H10z" fill="#b68d63"/><path d="M23 121v19m174-19v19" stroke="#82694b" stroke-width="9"/>
 <ellipse cx="111" cy="90" rx="36" ry="12" fill="#ead7b5"/><circle cx="110" cy="77" r="28" fill="#f9f3de" stroke="#9ca7a9" stroke-width="5"/>
 <g fill="#c4a25f" stroke="#927c51" stroke-width="2"><circle cx="99" cy="73" r="10"/><circle cx="121" cy="78" r="11"/><circle cx="108" cy="91" r="7"/></g>
 <path d="M99 58v30m-15-15h30m7-10v30m-15-15h30" stroke="#b29254" stroke-width="2"/>
 <circle cx="49" cy="44" r="22" fill="#cbe7ee" fill-opacity=".7" stroke="#517187" stroke-width="5"/><path d="M64 61l17 23" stroke="#517187" stroke-width="7" stroke-linecap="round"/>
 <path d="M162 49l-8 51 13-31m13-21l-13 52" fill="none" stroke="#7e959f" stroke-width="3"/>
 <path d="M25 93h34m-12-7v15" stroke="#d6b572" stroke-width="4"/><circle cx="187" cy="91" r="7" fill="#d6b572"/>`),
 'ne-pile-dwelling':()=>scene('Casa lacustre reconstruida sobre postes junto al agua',`
 <path d="M0 99h220v41H0" fill="#7fbdcf"/><path d="M0 99q24-20 57-4l-9 45H0" fill="#9fb47b"/>
 <path d="M69 62h101v42H69z" fill="#bea076" stroke="#8e7554" stroke-width="2"/><path d="M56 64l61-47 67 47z" fill="#d7be80" stroke="#ad955e" stroke-width="2"/>
 <path d="M69 72h101m-101 10h101m-101 10h101m-94 13v25m34-25v23m51-23v25" stroke="#8d7354" stroke-width="4"/>
 <path d="M105 104V78h24v26" fill="#5d6759"/><path d="M65 64l52-40 57 40m-97-2l39-31 44 31m-31-3l-13-25" fill="none" stroke="#c2a368" stroke-width="2"/>
 <path d="M53 109h125m-128 4l-24 25m29-20H39m9 9H31" stroke="#a4875f" stroke-width="4"/><path d="M92 134h22m55-11h30" stroke="#c7e7e8" stroke-width="3"/>`),
 'ne-river-gorge':()=>scene('Río encajado entre paredes de una garganta',`
 <path d="M0 16l79 13-28 51 20 60H0z" fill="#aaaFA1"/><path d="M220 13l-77 21 26 41-18 65h69z" fill="#b9bcb0"/>
 <path d="M0 16l79 13-10 15L0 35zm220-3l-77 21 9 15 68-16" fill="#93ad7d"/>
 <path d="M89 41q21 22 9 46t-27 53h80q-33-36-18-65t-5-34z" fill="#67b6c9"/>
 <path d="M101 57q18 14 7 30m3 22l-11 15m32-4l8 9" fill="none" stroke="#d2f0ee" stroke-width="3"/>
 <path d="M8 49l51 10m-53 33l47-8m-35 37l35-7m117-59l40-10m-31 41l35-9m-40 39l39-9" stroke="#838f82" stroke-width="3"/>
 <path d="M21 34V7m-7 13h17m160 15V7m-8 12h16" stroke="#648163" stroke-width="4"/>`),
 'ne-french-class':()=>notice('Aviso ficticio de curso de francés un martes a las dieciocho',`<text x="110" y="40" font-size="19" font-weight="bold">Cours de français</text><text x="110" y="72" font-size="24">mardi</text><text x="110" y="103" font-size="26" font-weight="bold">18 h</text>`,'AVISO FICTICIO · EJERCICIO'),
 'ju-horse-carriage':()=>scene('Caballo unido a un pequeño carruaje en una pradera',`
 <path d="M0 109q104-20 220 0v31H0" fill="#a7be85"/>
 <path d="M39 75q16-15 48 0l7 23H45zM76 75l3-32 13-11 14 13-7 17-8-3-2 24" fill="#aa7a54" stroke="#7e604a" stroke-width="2"/>
 <path d="M80 44l-1-14 8 8m4-5l6-11 3 16M43 95l-2 30m13-28l4 28m22-29l-3 29m13-30l6 30M39 79q-16 5-12 23" fill="none" stroke="#7e604a" stroke-width="5"/>
 <path d="M79 43l-7 30m22-30h12m-7 15l-8-5" stroke="#4f554d" stroke-width="3"/><circle cx="96" cy="43" r="2" fill="#34444b"/>
 <path d="M143 77h53l-6 29h-41z" fill="#a88e67" stroke="#73684f" stroke-width="3"/><path d="M146 78v-9h45v9M89 82l61 22m-59-9l56 14" fill="none" stroke="#73684f" stroke-width="3"/>
 <g fill="#d4c6a4" stroke="#58615a" stroke-width="4"><circle cx="153" cy="116" r="14"/><circle cx="188" cy="116" r="14"/></g><path d="M153 103v26m-13-13h26m22-13v26m-13-13h26" stroke="#73684f" stroke-width="2"/>`),
 'ju-medieval-bridge':()=>scene('Puente de piedra sobre un río y pueblo histórico esquemático',`
 <path d="M0 90h220v50H0" fill="#76b7c7"/><path d="M0 83l25-7 27 10 168-7v17H0" fill="#9fb584"/>
 <g fill="#e7dcc1" stroke="#b3a78d" stroke-width="1.5"><path d="M22 36h31v48H22zm35 9h30v39H57zm40-10h37v50H97zm42 14h41v36h-41z"/></g>
 <path d="M17 36l21-16 20 16m-6 9l21-18 20 18m-1-10l23-19 24 19m-5 14l27-18 26 18" fill="#9c735e"/>
 <path d="M108 34V13h14v21" fill="#c9c4ac"/><path d="M105 13l10-12 10 12" fill="#78877a"/>
 <path d="M14 92h194v34h-11v-9a17 17 0 0 0-34 0v9h-12v-9a17 17 0 0 0-34 0v9h-12v-9a17 17 0 0 0-34 0v9H59v-9a17 17 0 0 0-34 0v9H14z" fill="#c6b99c" stroke="#9f9985" stroke-width="2"/>
 <path d="M11 88h200v8H11z" fill="#ded0b2"/><path d="M32 48h7v10h-7zm33 7h8v10h-8zm43-5h8v12h-8zm42 10h8v12h-8z" fill="#7b9397"/>
 <path d="M39 134h36m65-3h44" stroke="#c2e7e8" stroke-width="3"/>`),
 'ju-peat-bog':()=>scene('Estanque y turbera con musgos y pasarela de madera',`
 <path d="M0 61q96-30 220 3v76H0" fill="#7e9e72"/><ellipse cx="121" cy="86" rx="85" ry="25" fill="#587f83"/>
 <path d="M27 140l42-36 13-1-27 37" fill="#b69a70" stroke="#877858" stroke-width="2"/><path d="M42 128h23m-15-10h21m-12-8h18" stroke="#877858" stroke-width="2"/>
 <g fill="#a2b979"><ellipse cx="24" cy="88" rx="19" ry="10"/><ellipse cx="198" cy="113" rx="22" ry="11"/><ellipse cx="96" cy="120" rx="20" ry="9"/></g>
 <path d="M30 68V23m153 41V17m-16 44V31" stroke="#697558" stroke-width="4"/><path d="M12 44l18-35 18 35zm155-4l16-34 18 34zm-14 11l15-29 15 29z" fill="#52785c"/>
 <path d="M103 75h33m15 15h26m-81 10h22" stroke="#b2d5ce" stroke-width="2"/><path d="M16 118l-3-17m8 15l4-19m171-5l3-18m7 21l4-15" stroke="#c2b879" stroke-width="2"/>`),
 'ju-cream-tart':()=>scene('Pastel redondo de crema con borde de masa',`
 <ellipse cx="110" cy="107" rx="91" ry="24" fill="#b1c1c8"/><ellipse cx="110" cy="102" rx="91" ry="24" fill="#f5f5e8" stroke="#c3cfd0" stroke-width="2"/>
 <path d="M36 69v29q74 42 148 0V69" fill="#bc8c51" stroke="#997347" stroke-width="2"/>
 <ellipse cx="110" cy="69" rx="75" ry="32" fill="#d8b370" stroke="#b58e53" stroke-width="3"/><ellipse cx="110" cy="67" rx="63" ry="23" fill="#f5e3af" stroke="#e4cb8b" stroke-width="3"/>
 <path d="M43 58l5 8m9-21l5 10m14-17l3 10m17-12l1 9m19-9l-1 9m20-7l-3 10m21-4l-5 11m18-2l-7 9m-11 24l-5-8m-17 15l-2-9m-20 13v-10m-21 9l2-9m-22 5l5-8m-22 0l7-8" stroke="#b58e53" stroke-width="2"/>
 <g fill="#ddc18d"><ellipse cx="83" cy="66" rx="8" ry="3"/><ellipse cx="128" cy="76" rx="11" ry="3"/><ellipse cx="137" cy="57" rx="7" ry="2"/></g>`),
 'ju-lost-property':()=>notice('Cartel ficticio de objetos encontrados con unas llaves',`<text x="110" y="38" font-size="23" font-weight="bold">Objets trouvés</text><circle cx="87" cy="75" r="15" fill="none" stroke="#889bad" stroke-width="6"/><path d="M98 85l30 25m-10-9l8-8m-19-2l8-8" stroke="#b69b60" stroke-width="7" stroke-linecap="round"/><circle cx="136" cy="72" r="10" fill="none" stroke="#b69b60" stroke-width="6"/><path d="M136 82v24m0-6h10" stroke="#b69b60" stroke-width="6"/>`,'CARTEL FICTICIO · EJERCICIO'),
}
export const NEUCHATEL_JURA_ART_LABELS={
 'ne-rock-cirque':'Circo rocoso del Creux du Van',
 'ne-watch-bench':'Banco de trabajo relojero',
 'ne-pile-dwelling':'Reconstrucción de vivienda lacustre del Laténium',
 'ne-river-gorge':'Garganta del Areuse',
 'ne-french-class':'Aviso ficticio de francés un martes',
 'ju-horse-carriage':'Caballo y carruaje de las Franches-Montagnes',
 'ju-medieval-bridge':'Puente y paisaje histórico de Saint-Ursanne',
 'ju-peat-bog':'Turbera de la Gruère',
 'ju-cream-tart':'Pastel toétché del Jura',
 'ju-lost-property':'Cartel de objetos encontrados',
}
