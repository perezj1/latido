// Original teaching scenes, without brands, copied artworks or external images.
const scene=(label,body)=>`<svg viewBox="0 0 220 140" width="220" height="140" role="img" aria-label="${label}"><rect width="220" height="140" rx="12" fill="#e0f2fe"/>${body}</svg>`
export const AARGAU_THURGAU_IMG={
 'ag-roman-kit':()=>scene('Equipo romano esquemático con casco y escudo',`
 <path d="M0 125h220v15H0" fill="#d3c5a4"/><path d="M34 69q-6-43 35-43 42 0 36 43" fill="#a0b5bb" stroke="#607986" stroke-width="3"/><path d="M31 67h78v10H31z" fill="#c7aa68" stroke="#8d7950" stroke-width="2"/>
 <path d="M34 77l7 31 14-8-7-23m47 0l-5 27-13-4 4-23" fill="#abc0c5" stroke="#607986" stroke-width="2"/><path d="M41 52q25-27 55-2m-31-22v-8h12v8" fill="none" stroke="#d3dfe0" stroke-width="4"/>
 <path d="M124 32q31-10 61 0v83q-31 13-61 0z" fill="#b86558" stroke="#7c4e43" stroke-width="3"/><path d="M133 34v80m43-80v80" stroke="#e4bd71" stroke-width="3"/>
 <path d="M155 45l-13 24h13l-11 28 24-32h-15l10-20" fill="#f4d18b"/><circle cx="155" cy="75" r="9" fill="#c6b594" stroke="#8e7d5d" stroke-width="2"/>
 <path d="M26 123h83" stroke="#9c8d6c" stroke-width="3"/>`),
 'ag-water-castle':()=>scene('Castillo esquemático rodeado de agua con puente',`
 <path d="M0 94h220v46H0" fill="#70b8cc"/><path d="M0 83q100-21 220 3v17H0" fill="#95b57b"/>
 <path d="M37 61h143v49H37z" fill="#d9c8a4" stroke="#9b927c" stroke-width="2"/><path d="M33 61l25-26h99l28 26z" fill="#a96758"/>
 <path d="M43 110V40h27v70m79 0V28h27v82" fill="#d4c1a0" stroke="#9b927c" stroke-width="2"/><path d="M39 40l18-26 17 26m71-12l17-23 18 23" fill="#b2705c"/>
 <path d="M94 110V87q13-17 26 0v23" fill="#4a645f"/><path d="M87 140l8-30h24l16 30" fill="#c0a279" stroke="#887550" stroke-width="2"/><path d="M93 122h32m-34 9h40" stroke="#927d59" stroke-width="2"/>
 <g fill="#6d8c92"><path d="M52 52h9v12h-9zm0 27h9v11h-9zM157 41h9v14h-9zm0 30h9v13h-9zM81 65h9v13h-9zm49 0h9v13h-9z"/></g><path d="M13 122h33m111 6h42" stroke="#c6e7e7" stroke-width="3"/>`),
 'ag-three-rivers':()=>scene('Esquema sin escala de dos afluentes que se unen sucesivamente a la Aare',`
 <path d="M0 117q58-12 84-44t45-30q30-18 91-18" fill="none" stroke="#9ab993" stroke-width="25"/>
 <path d="M111 140L84 73m108 67q-3-66-64-97" fill="none" stroke="#9ab993" stroke-width="18"/>
 <path d="M0 117q58-12 84-44t45-30q30-18 91-18" fill="none" stroke="#389fc6" stroke-width="15"/>
 <path d="M111 140L84 73m108 67q-3-66-64-97" fill="none" stroke="#389fc6" stroke-width="10"/>
 <path d="M188 25h18m-7-5l8 5-8 5M98 106l-6-16m-2 9l2-9 7 6m84 1l-7-15m-1 9l1-9 8 5" fill="none" stroke="#e8f8fa" stroke-width="2.5" stroke-linecap="round"/>
 <g font-family="Arial,sans-serif" font-weight="bold" fill="#234d64"><text x="16" y="89" font-size="16">Aare</text><text x="67" y="133" font-size="13">Reuss</text><text x="154" y="75" font-size="13">Limmat</text></g><text x="20" y="20" font-family="Arial,sans-serif" font-size="10" fill="#526c7e">ESQUEMA · SIN ESCALA</text>`),
 'ag-thermal-pool':()=>scene('Baños bajos junto al río con vapor y edificios al fondo',`
 <path d="M0 72h220v37H0" fill="#72bed2"/><path d="M0 108h220v32H0" fill="#cfccb8"/>
 <path d="M13 63V27h48v36m8 0V19h49v44m8 0V35h64v28" fill="#ead9ba"/><path d="M9 27l29-16 28 16m-1-8L95 3l28 16m-2 16l37-18 38 18" fill="#a9705d"/>
 <path d="M23 36h8v13h-8zm19 0h8v13h-8zm37-7h9v13h-9zm18 0h9v13h-9zm42 15h10v13h-10zm23 0h10v13h-10z" fill="#8fa8ad"/>
 <path d="M28 106l55-13 35 14-55 15zM122 112l43-12 32 14-43 14z" fill="#b2d9d8" stroke="#8f9f99" stroke-width="6"/>
 <path d="M28 106v12l35 15 55-16v-10m4 5v10l32 15 43-13v-10" fill="none" stroke="#a7a99a" stroke-width="5"/>
 <path d="M66 96q-10-11-3-22m17 16q-8-11-1-20m74 30q-9-9-2-19m20 16q-8-9-1-20" fill="none" stroke="#f2faf5" stroke-width="4" stroke-linecap="round"/><path d="M0 84h27m161 5h32" stroke="#c9e8eb" stroke-width="3"/>`),
 'ag-interview-card':()=>scene('Invitación ficticia a entrevista el lunes a las diez',`
 <rect x="8" y="8" width="204" height="124" rx="9" fill="#fff" stroke="#9bafc6" stroke-width="3"/>
 <g font-family="Arial,sans-serif" text-anchor="middle" fill="#243d55"><text x="110" y="32" font-size="15" font-weight="bold">Vorstellungsgespräch</text><text x="110" y="64" font-size="23">Montag</text><text x="110" y="94" font-size="24" font-weight="bold">10 Uhr</text><text x="110" y="120" font-size="9" fill="#64748b">INVITACIÓN FICTICIA</text></g>`),
 'tg-apple-press':()=>scene('Prensa de madera con manzanas y zumo',`
 <path d="M0 122h220v18H0" fill="#c7bb94"/><path d="M43 21h93M52 21v111m76-111v111" stroke="#927046" stroke-width="9"/>
 <path d="M88 18v39m-15-39h30" stroke="#6a7270" stroke-width="5"/><path d="M57 58h66v49H57z" fill="#c4a170" stroke="#95754c" stroke-width="2"/>
 <path d="M66 59v46m11-46v46m12-46v46m11-46v46m12-46v46m-56-35h66m-66 25h66" stroke="#95754c" stroke-width="3"/>
 <path d="M59 53h62v7H59zM48 109h90" fill="#a58558" stroke="#80613e" stroke-width="3"/><path d="M132 108l17 4v8" fill="none" stroke="#c49349" stroke-width="3"/>
 <path d="M140 120h33l-4 17h-25z" fill="#d9e4d0" stroke="#8d9f93" stroke-width="2"/><path d="M144 128h25" stroke="#e7bd66" stroke-width="8"/>
 <g fill="#c77852" stroke="#a55e42" stroke-width="1.5"><circle cx="30" cy="111" r="10"/><circle cx="19" cy="121" r="9"/><circle cx="40" cy="125" r="10"/><circle cx="178" cy="96" r="11"/></g><path d="M28 101l-1-6m151-10l2-7" stroke="#6d8050" stroke-width="3"/><path d="M178 85q12-10 15-2-9 8-15 2" fill="#83a566"/>`),
 'tg-arenenberg-house':()=>scene('Residencia histórica esquemática con parque sobre el lago',`
 <path d="M0 60h220v80H0" fill="#8fc5d4"/><path d="M0 96q89-57 220-7v51H0" fill="#a1bb80"/>
 <path d="M49 39h124v56H49z" fill="#f2e7d0" stroke="#a69d86" stroke-width="2"/><path d="M42 40l27-22h86l27 22z" fill="#ad7460"/><path d="M54 34h118" stroke="#bd8b70" stroke-width="2"/>
 <g fill="#82a4b4" stroke="#e5d6b9" stroke-width="2"><path d="M59 49h11v13H59zm23 0h11v13H82zm24 0h11v13h-11zm24 0h11v13h-11zm23 0h11v13h-11zM59 73h11v14H59zm23 0h11v14H82zm48 0h11v14h-11zm23 0h11v14h-11z"/></g>
 <path d="M105 95V76h13v19" fill="#847d66"/><path d="M110 97q14 11-15 22t17 21" fill="none" stroke="#ddcba8" stroke-width="8"/>
 <path d="M27 96V64m165 30V56" stroke="#8c8658" stroke-width="5"/><g fill="#759a69"><ellipse cx="27" cy="61" rx="18" ry="22"/><ellipse cx="192" cy="54" rx="19" ry="25"/></g><path d="M8 119h25m141-11h31" stroke="#c0d19d" stroke-width="3"/>`),
 'tg-carthusian-cloister':()=>scene('Claustro didáctico con jardín y pequeñas celdas monásticas',`
 <path d="M28 34h162v86H28z" fill="#e9dfc3" stroke="#a2957d" stroke-width="2"/><path d="M41 51h136v54H41z" fill="#a5b982"/>
 <path d="M41 51h136v54H41z" fill="none" stroke="#d2bfa0" stroke-width="9"/><path d="M105 56v45m-59-22h126" stroke="#eadcc0" stroke-width="4"/>
 <g fill="#e7d9ba" stroke="#a2957d" stroke-width="1.5"><path d="M32 16h31v27H32zm48 0h31v27H80zm48 0h31v27h-31zM32 108h31v25H32zm48 0h31v25H80zm48 0h31v25h-31z"/></g>
 <g fill="#ac7c60"><path d="M27 17L48 4l20 13zm48 0L95 4l21 13zm48 0L144 4l20 13zM27 110l21-13 20 13zm48 0l20-13 21 13zm48 0l21-13 20 13z"/></g>
 <g fill="#627c7b"><path d="M43 28h9v15h-9zm47 0h9v15h-9zm49 0h9v15h-9zM43 120h9v13h-9zm47 0h9v13h-9zm49 0h9v13h-9z"/></g><path d="M180 34v86m-147-74v59" stroke="#baaa8b" stroke-width="3"/>`),
 'tg-historic-truck':()=>scene('Camión histórico genérico sin marca',`
 <path d="M0 125h220v15H0" fill="#b7c4bc"/><path d="M24 70h58V39h44v67H24z" fill="#6c9d98" stroke="#466f73" stroke-width="2"/>
 <path d="M83 42h36v28H83z" fill="#b4d8df" stroke="#466f73" stroke-width="3"/><path d="M100 43v25" stroke="#6c9d98" stroke-width="3"/>
 <path d="M130 59h68v44h-68z" fill="#bb9b6c" stroke="#846d4a" stroke-width="2"/><path d="M133 70h62m-62 12h62m-62 12h62m-47-34v42m29-42v42" stroke="#8b744f" stroke-width="2"/>
 <path d="M21 103h181v10H21" fill="#4d6266"/><g fill="#3d525b" stroke="#263f49" stroke-width="3"><circle cx="57" cy="111" r="19"/><circle cx="165" cy="111" r="19"/></g><g fill="#a7b9b9"><circle cx="57" cy="111" r="10"/><circle cx="165" cy="111" r="10"/></g>
 <path d="M29 77h35v18H29z" fill="#49676b"/><path d="M36 78v15m7-15v15m7-15v15m7-15v15" stroke="#8da8a8" stroke-width="2"/><circle cx="25" cy="93" r="5" fill="#f2d99a"/><path d="M111 82h7" stroke="#355f67" stroke-width="3"/>`),
 'tg-car-ferry':()=>scene('Ferry con coches, cubierta y rampa',`
 <path d="M0 92h220v48H0" fill="#68b8cf"/><path d="M22 91h175l-19 29H46z" fill="#f8f3df" stroke="#567e91" stroke-width="2"/>
 <path d="M43 71h132v21H43z" fill="#c4d2d4"/><path d="M56 70V36h41v34m-46-34h52" fill="#f3eddb" stroke="#567e91" stroke-width="2"/>
 <path d="M64 44h23v12H64" fill="#78aebd"/><path d="M76 35V20m0 3h19" stroke="#6b8490" stroke-width="3"/>
 <path d="M104 76l7-15h24l9 15v12h-40z" fill="#d99276" stroke="#a56c56" stroke-width="1.5"/><path d="M151 77l6-14h21l8 14v11h-35z" fill="#849cbb" stroke="#607a9e" stroke-width="1.5"/>
 <path d="M114 65h17l5 10h-27zm46 2h14l5 10h-23z" fill="#cae1e5"/><g fill="#36515e"><circle cx="114" cy="88" r="4"/><circle cx="134" cy="88" r="4"/><circle cx="159" cy="88" r="4"/><circle cx="178" cy="88" r="4"/></g>
 <path d="M195 91l19-14 3 7-18 19" fill="#a0b4bb" stroke="#567e91" stroke-width="2"/><path d="M26 131h32m29-6h34m33 8h39" stroke="#c3e9ed" stroke-width="3" stroke-linecap="round"/>`),
}
export const AARGAU_THURGAU_ART_LABELS={
 'ag-roman-kit':'Equipo romano de Vindonissa',
 'ag-water-castle':'Castillo de agua de Hallwyl',
 'ag-three-rivers':'Confluencias de Aargau',
 'ag-thermal-pool':'Baños termales de Baden',
 'ag-interview-card':'Invitación a entrevista del lunes',
 'tg-apple-press':'Prensado de manzanas',
 'tg-arenenberg-house':'Residencia de Arenenberg',
 'tg-carthusian-cloister':'Claustro y celdas de Ittingen',
 'tg-historic-truck':'Camión histórico de Arbon',
 'tg-car-ferry':'Ferry de Romanshorn',
}
