// Original schematic illustrations, without photographs or copied artwork.
const scene=(label,body)=>`<svg viewBox="0 0 220 140" width="220" height="140" role="img" aria-label="${label}"><rect width="220" height="140" rx="12" fill="#e0f2fe"/>${body}</svg>`
export const REGIONAL_IMG={
  cuchaule:()=>scene('Brioche redonda dorada con una rebanada de miga amarilla',`
    <ellipse cx="110" cy="116" rx="94" ry="15" fill="#fff" stroke="#cbd5e1" stroke-width="2"/>
    <path d="M28 91q0-64 73-65 72-1 72 64-12 28-73 28T28 91" fill="#c78a36" stroke="#9a6226" stroke-width="2"/>
    <path d="M45 69l78-29m-67 47l91-35m-77 49l87-32M65 42l69 58M43 58l57 48m-4-76l62 51" stroke="#efbc69" stroke-width="4" stroke-linecap="round"/>
    <path d="M120 72q32-35 69-3l9 44-69 7z" fill="#f7dc7d" stroke="#ad782f" stroke-width="4"/>
    <g fill="#d7b753"><ellipse cx="150" cy="84" rx="4" ry="3"/><ellipse cx="178" cy="96" rx="3" ry="4"/><ellipse cx="147" cy="107" rx="3" ry="2"/></g>`),
  'poya-panel':()=>scene('Tabla pintada con un rebaño subiendo por una ladera',`
    <rect x="8" y="12" width="204" height="115" rx="4" fill="#e8d2aa" stroke="#8f6743" stroke-width="6"/>
    <path d="M12 91l47-31 51 12 49-39 49 26v64H12" fill="#83af6d"/><path d="M16 112l184-55" stroke="#e7d7aa" stroke-width="7"/>
    <path d="M164 33h30v28h-30z" fill="#c48d55"/><path d="M157 33l22-17 23 17" fill="#8a533a"/>
    <g fill="#faf5e8" stroke="#5c5143" stroke-width="1.5"><path d="M27 94h25v12H27zm45-15h25v12H72zm44-15h25v12h-25z"/></g>
    <g fill="#655142"><path d="M44 91h11v13H44zm45-15h11v13H89zm44-15h11v13h-11zM30 106h3v8h-3zm15 0h3v8h-3zm30-15h3v8h-3zm15 0h3v8h-3zm29-15h3v8h-3zm15 0h3v8h-3z"/></g>
    <circle cx="154" cy="55" r="4" fill="#ceaa83"/><path d="M154 61v13m0 0l-6 9m6-9l7 6" stroke="#ad4e3d" stroke-width="4"/>`),
  'water-funicular':()=>scene('Dos cabinas conectadas en una pendiente y depósito de agua superior',`
    <path d="M8 126L185 23h27v117H8" fill="#a4bf87"/><path d="M14 119L190 20m-168 111L198 32" stroke="#64748b" stroke-width="3"/>
    <path d="M48 97L186 16q12-7 15 5 2 5-6 10L91 94" fill="none" stroke="#9ca3af" stroke-width="2"/>
    <path d="M35 82h45v25H35zM149 18h45v25h-45z" fill="#3e966c" stroke="#246545" stroke-width="2"/>
    <g fill="#e9f7ff"><path d="M40 87h12v10H40zm18 0h12v10H58zM154 23h12v10h-12zm18 0h12v10h-12z"/></g>
    <rect x="151" y="45" width="42" height="15" rx="3" fill="#fff" stroke="#64748b" stroke-width="2"/><path d="M153 51h38v7h-38" fill="#38bdf8"/>
    <g fill="#334155"><circle cx="43" cy="111" r="4"/><circle cx="71" cy="111" r="4"/><circle cx="157" cy="47" r="3"/><circle cx="185" cy="47" r="3"/></g>`),
  'bern-covered-bridge':()=>scene('Puente cubierto de madera sobre un río con pilar central',`
    <path d="M0 91h220v49H0" fill="#56b7cf"/><path d="M4 47h212v10H4z" fill="#925a40"/><path d="M0 47l20-18h180l20 18" fill="#784634"/>
    <path d="M9 55h202v31H9z" fill="#c28d5b"/><path d="M9 86h202" stroke="#704b36" stroke-width="5"/>
    <path d="M19 57h25v20H19zm38 0h25v20H57zm38 0h25v20H95zm38 0h25v20h-25zm38 0h25v20h-25z" fill="#714e3d"/>
    <path d="M101 88h18v31h-18z" fill="#aaada1" stroke="#7e887e" stroke-width="2"/><path d="M0 93h13v35H0m207-35h13v35h-13" fill="#91a57c"/>
    <path d="M22 124h43m82 6h43m-57-21h48" stroke="#bfebf2" stroke-width="3"/>`),
  'stained-glass':()=>scene('Vidriera geométrica original de colores entre líneas oscuras',`
    <path d="M49 126V56a61 47 0 0 1 122 0v70z" fill="#f8cf63" stroke="#46536b" stroke-width="7"/>
    <path d="M53 58l57-45v60z" fill="#50a0d3"/><path d="M110 15l56 43-56 16z" fill="#79b88d"/>
    <path d="M53 62l57 12-57 48z" fill="#ec7d73"/><path d="M110 74l56-13v61z" fill="#6b8ccb"/><path d="M53 123l57-49 56 49" fill="#7ebc91"/>
    <path d="M110 14v109M52 60l58 14 58-14m-58 14l-57 49m57-49l56 49" fill="none" stroke="#46536b" stroke-width="5"/>
    <circle cx="110" cy="74" r="19" fill="#f6ca61" stroke="#46536b" stroke-width="5"/>`),
  'bisse-channel':()=>scene('Canal de agua sostenido por madera en una ladera',`
    <path d="M0 15l151 40 69-16v101H0" fill="#a6ad96"/><path d="M0 108l220-43v75H0" fill="#78a76b"/>
    <path d="M7 86l201-47v15L7 101z" fill="#a17348" stroke="#6e563e" stroke-width="2"/><path d="M8 86l198-46-4 8L8 94z" fill="#56c6e1"/>
    <path d="M30 96v24m47-35v24m47-35v24m47-35v24" stroke="#795c3f" stroke-width="5"/><path d="M0 118l220-47" stroke="#dfd5b4" stroke-width="11"/>
    <path d="M25 56l-8-13m50 9l16-15m51 12l-6-18m57 7l14-16" stroke="#798476" stroke-width="2"/>`),
  'raclette-half':()=>scene('Media rueda de queso bajo calor y porción fundida servida',`
    <path d="M40 86a67 67 0 0 1 134 0z" fill="#f1cc6a" stroke="#bb8c39" stroke-width="5"/><path d="M39 87h137" stroke="#e2ad4d" stroke-width="7"/>
    <path d="M110 85q0 21 29 24" fill="none" stroke="#f6d46e" stroke-width="13" stroke-linecap="round"/>
    <ellipse cx="156" cy="117" rx="52" ry="16" fill="#fff" stroke="#94a3b8" stroke-width="2"/><ellipse cx="155" cy="114" rx="31" ry="9" fill="#f2ce68"/>
    <path d="M26 11h166v14H26z" fill="#64748b"/><path d="M34 28h150" stroke="#ef7657" stroke-width="4"/><path d="M59 33v11m44-11v9m44-9v11" stroke="#fbad71" stroke-width="3"/>`),
  apricot:()=>scene('Albaricoque naranja entero y medio fruto con hueso marrón',`
    <path d="M39 116q-23-20-11-53 11-28 43-21 30-11 45 16 17 34-6 57-34 27-71 1" fill="#f4a247" stroke="#d98736" stroke-width="2"/>
    <path d="M71 44q-7 38 1 75" fill="none" stroke="#d48536" stroke-width="2"/><path d="M70 39q15-29 36-21-8 25-36 21" fill="#6c9c57"/>
    <ellipse cx="149" cy="88" rx="44" ry="43" fill="#ffc170" stroke="#e5a250" stroke-width="4"/><ellipse cx="149" cy="88" rx="16" ry="24" fill="#9d693e"/>
    <path d="M144 71q12 17 1 34m10-32q-6 14 2 27" fill="none" stroke="#7e512e" stroke-width="2"/>`),
  'dixence-dam':()=>scene('Presa de hormigón entre montañas con embalse detrás',`
    <path d="M0 54l39-44 37 37 34-29 31 36 36-37 43 37v86H0" fill="#8794a3"/><path d="M44 52h133l-22 48H62z" fill="#58b5d3"/>
    <path d="M45 57q65 21 132-1l-12 64q-58 21-108-1z" fill="#c2c7cb" stroke="#7e8c97" stroke-width="2"/>
    <path d="M61 69l8 47m11-42l5 47m12-44l2 46m17-46v47m17-49l-3 48m21-53l-6 48" stroke="#9aa5ad" stroke-width="2"/>
    <path d="M44 54q65 20 134-1" fill="none" stroke="#e6e9ec" stroke-width="5"/><path d="M87 132l22-10 23 10" fill="#a3b294"/>`),
  'aletsch-glacier':()=>scene('Lengua de hielo azulado entre laderas de alta montaña',`
    <path d="M0 96l38-62 25 38 39-65 42 63 26-42 50 65v47H0" fill="#8996ab"/>
    <path d="M83 39l19-32 21 32-19-9-10 13zM25 55l13-21 14 22-14-7zM160 44l10-16 14 25-15-9z" fill="#fff"/>
    <path d="M98 48l21 2q-6 33 23 51 15 11 25 39H54q56-28 49-52-7-21-5-40" fill="#d5eff9" stroke="#a9c9df" stroke-width="2"/>
    <path d="M108 52q-9 28 10 43 21 21 5 43m-18-80q-1 29 8 39 18 23-13 43" fill="none" stroke="#97b9ce" stroke-width="3"/>
    <path d="M67 120l20-5m48 0l13 7m-43-22l14 5" stroke="#fff" stroke-width="3"/>`),
}
export const REGIONAL_ART_LABELS={cuchaule:'Cuchaule de azafrán','poya-panel':'Poya, escena original','water-funicular':'Funicular de contrapeso de agua','bern-covered-bridge':'Pont de Berne de Fribourg','stained-glass':'Vidriera geométrica original','bisse-channel':'Bisse / Suone','raclette-half':'Raclette',apricot:'Albaricoque','dixence-dam':'Grande Dixence esquemática','aletsch-glacier':'Glaciar de valle'}
