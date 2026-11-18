// Original educational scenes. No photographs or copies of local artists' designs.
const scene=(label,body)=>`<svg viewBox="0 0 220 140" width="220" height="140" role="img" aria-label="${label}"><rect width="220" height="140" rx="12" fill="#e0f2fe"/>${body}</svg>`
export const APPENZELL_IMG={
  'ar-hackbrett':()=>scene('Instrumento trapezoidal de cuerdas con dos pequeños mazos',`
    <path d="M18 113l26-72h133l26 72z" fill="#a16b40" stroke="#704d33" stroke-width="4"/><path d="M28 105l22-57h121l22 57z" fill="#d3aa70"/>
    <g stroke="#eee2bd" stroke-width="1.5"><path d="M48 53h125M46 59h129M44 65h133M42 71h137M40 77h141M38 83h145M36 89h149M34 95h153M32 101h157"/></g>
    <path d="M83 49l-8 58m64-58l7 58" stroke="#835b3d" stroke-width="4"/>
    <path d="M28 19l59 30m105-30l-59 30" stroke="#976c44" stroke-width="5" stroke-linecap="round"/><path d="M77 43l14 8m-14-5l9 6m53-9l-14 8m14-5l-9 6" stroke="#c3a17b" stroke-width="6" stroke-linecap="round"/>
    <circle cx="56" cy="115" r="3" fill="#493b2b"/><circle cx="167" cy="115" r="3" fill="#493b2b"/>`),
  'ar-naturchlaus':()=>scene('Figura festiva con máscara, traje de ramas y campanas',`
    <path d="M66 67l-18 54h124l-19-54z" fill="#637447" stroke="#3c573f" stroke-width="2"/><ellipse cx="110" cy="49" rx="25" ry="23" fill="#c8a66e"/>
    <path d="M75 37l12-13 11 5 12-18 13 18 12-5 12 14-10 14H83z" fill="#628456"/>
    <g fill="#a6b36d"><path d="M82 30l-13-13 5 22m27-15L92 9l2 22m39-1l14-14-5 23M62 75l-15-7 8 17m103-9l15-8-8 17M70 96l-16 3 16 6m80-9l16 3-16 6"/></g>
    <g fill="#263e32"><ellipse cx="100" cy="47" rx="4" ry="3"/><ellipse cx="120" cy="47" rx="4" ry="3"/></g><path d="M102 60q8 5 16-1" fill="none" stroke="#71563c" stroke-width="2"/>
    <path d="M77 69l64 40m0-40l-64 40" stroke="#b6945a" stroke-width="6"/><g fill="#d1a858" stroke="#8f743c" stroke-width="2"><path d="M82 81q-10 0-10 14v6h20v-6q0-14-10-14m56 0q-10 0-10 14v6h20v-6q0-14-10-14"/></g>
    <g fill="#917947"><ellipse cx="92" cy="23" rx="4" ry="6"/><ellipse cx="129" cy="24" rx="4" ry="6"/><ellipse cx="65" cy="91" rx="4" ry="7"/><ellipse cx="153" cy="91" rx="4" ry="7"/></g>
    <path d="M90 121l-6 13m46-13l6 13" stroke="#514638" stroke-width="8"/>`),
  'ar-bloch':()=>scene('Carro con un tronco adornado arrastrado por personas',`
    <path d="M0 116h220v24H0" fill="#a8c888"/><path d="M91 96h109v12H91z" fill="#936943"/><circle cx="107" cy="113" r="12" fill="#654b37"/><circle cx="184" cy="113" r="12" fill="#654b37"/>
    <path d="M102 69h89v27h-89z" fill="#a8784a" stroke="#6d5034" stroke-width="2"/><ellipse cx="102" cy="83" rx="11" ry="14" fill="#e0ba7b" stroke="#85613f" stroke-width="2"/><ellipse cx="102" cy="83" rx="6" ry="9" fill="none" stroke="#b68b57" stroke-width="2"/>
    <path d="M117 73l8 19m18-19l8 19m18-19l8 19" stroke="#6e943e" stroke-width="5"/><path d="M121 73l-12-15m12 7l15-13m10 15l-9-14m11 7l13-14m11 22l-10-16m11 7l13-13" stroke="#4a7648" stroke-width="4"/>
    <path d="M91 101L24 86m67 15L59 76" stroke="#a28f66" stroke-width="2"/>
    <g fill="#d2ab85"><circle cx="25" cy="69" r="7"/><circle cx="60" cy="59" r="7"/></g><path d="M20 78l10 2 4 26H17zm35-10l10 2 5 26H52z" fill="#795c47"/>
    <path d="M24 106l-9 22m14-22l10 21m21-31l-8 22m13-22l10 20M29 83l12 10m24-20l11 10" stroke="#546678" stroke-width="5"/>`),
  'ar-rack-rail':()=>scene('Rueda dentada engranada en la cremallera de una vía inclinada',`
    <path d="M10 126L196 31m-178 105L204 41" stroke="#64748b" stroke-width="5"/>
    <path d="M30 132l-8-15m33 2l-8-15m33 2l-8-15m33 2l-8-15m33 2l-8-15m33 2l-8-15m33 2l-8-15" stroke="#a18b70" stroke-width="4"/>
    <path d="M39 115l5-10 7 4 5-10 7 4 5-10 7 4 5-10 7 4 5-10 7 4 5-10 7 4 5-10 7 4 5-10 7 4 5-10 7 4 5-10 7 4 5-10 7 4" fill="none" stroke="#43586a" stroke-width="4"/>
    <g transform="translate(112 43) rotate(-27)"><path d="M-8-29H8v9l7 4 8-4 8 14-8 5v8l8 5-8 14-8-4-7 4v9H-8v-9l-7-4-8 4-8-14 8-5v-8l-8-5 8-14 8 4 7-4z" fill="#e9b14e" stroke="#ac7a30" stroke-width="2"/><circle r="10" fill="#fff" stroke="#ac7a30" stroke-width="3"/></g>
    <path d="M25 35l32-16" stroke="#ed8750" stroke-width="4"/><path d="M44 17l15 0-6 13" fill="none" stroke="#ed8750" stroke-width="4"/>`),
  'ar-detour-notice':()=>scene('Panel ficticio: Wanderweg, Umleitung y flecha de desvío',`
    <path d="M108 75v63" stroke="#7f8c97" stroke-width="7"/><rect x="15" y="17" width="190" height="91" rx="7" fill="#fff" stroke="#94a3b8" stroke-width="3"/>
    <g fill="#172743" font-family="Arial,sans-serif" text-anchor="middle"><text x="110" y="40" font-size="17">Wanderweg</text><text x="110" y="65" font-size="20" font-weight="bold">Umleitung</text><text x="110" y="100" font-size="9">EJEMPLO FICTICIO</text></g><path d="M67 82h78m-13-11l13 11-13 10" fill="none" stroke="#d88025" stroke-width="6" stroke-linejoin="round"/>`),
  'ai-open-assembly':()=>scene('Votación a mano alzada en una asamblea al aire libre',`
    <path d="M0 106h220v34H0" fill="#e8dbc0"/><path d="M76 54h122v11H76zm9 11h105v33H85z" fill="#aa7e54" stroke="#7b5839" stroke-width="2"/><path d="M78 52V34m117 18V34M77 35h120" stroke="#8d6847" stroke-width="3"/>
    <g fill="#d5b191"><circle cx="113" cy="38" r="8"/><circle cx="161" cy="38" r="8"/></g><path d="M104 48h18v12h-18m48-12h18v12h-18" fill="#4c6684"/>
    <g stroke="#567994" stroke-width="9" stroke-linecap="round"><path d="M27 133v-25m39 25v-28m42 28v-22m42 22v-24m42 24v-23"/></g>
    <g fill="#d7b58e"><circle cx="27" cy="100" r="9"/><circle cx="66" cy="97" r="9"/><circle cx="108" cy="103" r="9"/><circle cx="150" cy="101" r="9"/><circle cx="192" cy="102" r="9"/></g>
    <path d="M23 118L8 98V76m54 38l-13-22V68m55 51L91 97V77m55 40l-13-26V69m57 50l-13-23V76" fill="none" stroke="#d7b58e" stroke-width="6" stroke-linecap="round"/>`),
  'ai-cave-chapel':()=>scene('Capilla en una cueva rocosa con pequeño campanario de madera',`
    <path d="M0 0h220v140H0" fill="#b9c3cc"/><path d="M5 127V61q33-55 94-43 48-15 111 28v81z" fill="#63727b"/><path d="M0 0h220v23l-24 9-26-11-39 10-30-8-29 9-25-5-31 27L0 69z" fill="#94a2ad"/>
    <path d="M0 124l71-12 67 6 82-13v35H0" fill="#9fb28a"/><path d="M56 112V63h83v49z" fill="#f5f0df" stroke="#c6c4b9" stroke-width="2"/>
    <path d="M47 65l52-25 49 25z" fill="#bca47c"/><path d="M91 112V87q8-16 16 0v25" fill="#354955"/><path d="M65 81h11v16H65zm57 0h9v16h-9" fill="#7095a8"/>
    <path d="M149 112V55h23v57" fill="#a2794d"/><path d="M145 55l15-18 16 18z" fill="#77573b"/><path d="M155 62h11v17h-11z" fill="#354955"/><path d="M160 35v-12m-5 5h10" stroke="#e7dfc8" stroke-width="3"/>
    <path d="M41 140l54-22" stroke="#e4d8bf" stroke-width="9"/>`),
  'ai-embroidery-light':()=>scene('Mesa de bordado con esfera de vidrio llena de agua frente a una luz',`
    <path d="M20 107h180v11H20zm12 11v22m156-22v22" fill="#a77b54" stroke="#795d43" stroke-width="3"/><path d="M36 94l67-13 33 24-76 9z" fill="#fffaf0" stroke="#c1c5bc" stroke-width="2"/>
    <path d="M64 100l22-7 16 9m-24-4l6-6m6 10l7-5" fill="none" stroke="#a5b3b7" stroke-width="2" stroke-dasharray="2 2"/>
    <path d="M95 89l24-20" stroke="#718492" stroke-width="2"/><path d="M115 72q23-17 21 2t-23 9" fill="none" stroke="#7996bb" stroke-width="2"/>
    <path d="M162 104h21V69h-21z" fill="#f1cf86" stroke="#ba9250" stroke-width="2"/><path d="M173 67q-12-10 0-25 13 16 0 25" fill="#f8ac3f"/><path d="M173 62q-5-6 0-13 6 8 0 13" fill="#fff6ce"/>
    <path d="M145 91v13m-12 0h24" stroke="#97774a" stroke-width="4"/><circle cx="145" cy="68" r="25" fill="#e1f4ff" fill-opacity="0.8" stroke="#7b9cab" stroke-width="3"/><path d="M122 72q23 9 46 0-2 21-23 21-19 0-23-21" fill="#92cae4" fill-opacity="0.55"/><path d="M133 53q-8 4-7 12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`),
  'ai-cheese-pasta':()=>scene('Macarrones con queso y pequeños trozos de patata',`
    <ellipse cx="110" cy="92" rx="98" ry="34" fill="#fff" stroke="#bdcedc" stroke-width="3"/><ellipse cx="110" cy="86" rx="76" ry="26" fill="#e5cd8c"/>
    <g fill="none" stroke="#f6df98" stroke-width="10" stroke-linecap="round"><path d="M53 83q10-18 21-1m8-11q10-13 20 1m17 1q11-16 22 1m4 8q13-11 22 2M68 98q11-16 22-1m20 3q7-14 20-3m5-9q-2-13-13-9"/></g>
    <g fill="#f5e2a9" stroke="#c7ad6a" stroke-width="1.5"><path d="M50 96l9-5 9 6-9 7zM93 82l10-5 10 7-9 8zM145 99l10-6 10 7-10 6z"/></g>
    <g stroke="#fff2bb" stroke-width="3"><path d="M73 71l12 6m15 20l13-3m18-14l10 5m-7 18l10-1m-88-12l10-3m34-18l8 3"/></g>`),
  'ai-senn-costume':()=>scene('Traje festivo genérico con chaleco rojo y pantalones amarillos',`
    <path d="M0 121h220v19H0" fill="#aac994"/><circle cx="111" cy="39" r="15" fill="#d4ac86"/><path d="M85 26l10-4V10h31v12l12 4z" fill="#33443b"/>
    <path d="M96 14h29" stroke="#de8169" stroke-width="4"/><circle cx="124" cy="13" r="5" fill="#e8bb65"/><circle cx="131" cy="16" r="4" fill="#a3c180"/>
    <path d="M83 58l18-8h21l18 8 10 32-15 5-9-25H97L86 95l-15-5z" fill="#fffaf0" stroke="#c4c6bb" stroke-width="2"/>
    <path d="M95 54l16 11 16-11v38H95z" fill="#d65049" stroke="#a13735" stroke-width="2"/><path d="M111 66v24" stroke="#f2cf7a" stroke-width="2"/>
    <path d="M95 91h32l5 29h-17l-5-19-3 19H90z" fill="#ecc658" stroke="#c49d42" stroke-width="2"/><path d="M96 120v14m26-14v14" stroke="#fffaf0" stroke-width="9"/>
    <path d="M86 136h17m13 0h17" stroke="#5b4b3c" stroke-width="6" stroke-linecap="round"/><path d="M78 91l-3 13m68-13l4 13" stroke="#d4ac86" stroke-width="7" stroke-linecap="round"/>
    <path d="M98 71l-7-5m32 5l9-5" stroke="#e8d4a4" stroke-width="3"/>`),
}
export const APPENZELL_ART_LABELS={
  'ar-hackbrett':'Hackbrett esquemático','ar-naturchlaus':'Naturchlaus, diseño original','ar-bloch':'Bloch esquemático','ar-rack-rail':'Mecanismo de cremallera','ar-detour-notice':'Desvío, cartel ficticio',
  'ai-open-assembly':'Asamblea a mano alzada','ai-cave-chapel':'Wildkirchli esquemático','ai-embroidery-light':'Luz para el bordado','ai-cheese-pasta':'Macarrones, queso y patata','ai-senn-costume':'Traje festivo del Senn',
}
