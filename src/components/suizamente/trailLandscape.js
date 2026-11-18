// Supplied vector scenes and decorative seasonal lighting. No location, weather API or external media.
  const SUM={1:[150,322],2:[176,300],3:[176,262],4:[188,232],5:[176,214]};
  const STEP=118;
  function geo(lv,n){
    const sy=SUM[lv][1], H=Math.max(1240,sy+165+260+(n-1)*STEP), stops=[];
    for(let k=0;k<n;k++) stops.push([k%2?246-(k%3)*5:112+(k%3)*5, H-260-k*STEP]);
    return {H,start:[176,H-140],stops,sum:SUM[lv]};
  }
  function segs(pts){
    const out=[];
    for(let i=0;i<pts.length-1;i++){
      const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
      out.push([p1,[p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6],[p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6],p2]);
    }
    return out;
  }
  const bez=(s,t)=>{const u=1-t;return [0,1].map(k=>u*u*u*s[0][k]+3*u*u*t*s[1][k]+3*u*t*t*s[2][k]+t*t*t*s[3][k]);};
  function segLen(s){let L=0,p=s[0];for(let k=1;k<=24;k++){const q=bez(s,k/24);L+=Math.hypot(q[0]-p[0],q[1]-p[1]);p=q;}return L;}
  /* Marcas de los senderos suizos: amarillo (Wanderweg), blanco-rojo-blanco (Bergwanderweg), blanco-azul-blanco (Alpinwanderweg) */
  const WAY={w:{dash:'#f2c200',name:'Wanderweg',es:'sendero'},b:{dash:'#e5383b',name:'Bergwanderweg',es:'sendero de montaña'},a:{dash:'#2f6fd6',name:'Alpinwanderweg',es:'sendero alpino'}};
  function trailSVG(G,way,done,col){
    const ss=segs([G.start,...G.stops,G.sum]);
    const d=`M${G.start[0]} ${G.start[1]}`+ss.map(s=>`C${s[1][0].toFixed(1)} ${s[1][1].toFixed(1)} ${s[2][0].toFixed(1)} ${s[2][1].toFixed(1)} ${s[3][0]} ${s[3][1]}`).join('');
    const L=ss.map(segLen), tot=L.reduce((a,b)=>a+b,0);
    let cum=0; for(let k=0;k<Math.min(done,L.length);k++) cum+=L[k];
    let s=`<svg class="trl" viewBox="0 0 360 ${G.H}" preserveAspectRatio="none" aria-hidden="true">`;
    s+=`<path d="${d}" fill="none" stroke="#6b5a45" stroke-opacity=".18" stroke-width="16" stroke-linecap="round" transform="translate(0 3)"/>`;
    s+=`<path d="${d}" fill="none" stroke="#fbf6ea" stroke-width="13" stroke-linecap="round"/>`;
    s+=`<path d="${d}" fill="none" stroke="${WAY[way].dash}" stroke-width="3.2" stroke-dasharray="8 10" stroke-linecap="round"/>`;
    if(done>0) s+=`<path d="${d}" pathLength="1000" fill="none" stroke="${col}" stroke-width="6.5" stroke-linecap="round" stroke-dasharray="${(cum/tot*1000).toFixed(1)} 1000"/>`;
    return s+'</svg>';
  }

  // Approximate monthly lighting thresholds from the supplied artwork, not astronomical forecasts.
  const SOL=[[8,10,16,58],[7,36,17,44],[6,46,18,27],[6,43,20,9],[5,57,20,48],[5,30,21,24],[5,46,21,20],[6,25,20,40],[7,7,19,36],[7,50,18,32],[7,34,16,55],[8,7,16,34]];
  /* Amanecer: de 30 min antes a 1 h después de la salida del sol. Atardecer: de 1 h antes a 30 min después de la puesta. Hora de Zürich. */
  /* Siempre con la hora de Zürich (Europe/Zurich, con horario de verano), aunque el móvil esté en otra zona horaria */
  function zurich(d){
    try{const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Zurich',month:'numeric',hour:'numeric',minute:'numeric',hourCycle:'h23'}).formatToParts(d),g=k=>+p.find(x=>x.type===k).value;return {m:g('month')-1,h:g('hour'),mi:g('minute')};}
    catch{return {m:0,h:12,mi:0};}
  }
  function landscapePhase(d){
    const z=zurich(d||new Date());
    const [rh,rm,sh,sm]=SOL[z.m], t=z.h*60+z.mi, up=rh*60+rm, dn=sh*60+sm;
    return t<up-30||t>=dn+30?'noche':t<up+60?'amanecer':t<dn-60?'dia':'atardecer';
  }
  /* Cielo de cada momento (de día, cada montaña tiene el suyo) */
  const CIELO={amanecer:[[0,'#6f8fd0'],[.2,'#f4b5a3'],[.4,'#ffe2c0']],atardecer:[[0,'#4c5aa8'],[.2,'#e3888a'],[.42,'#ffc98f']],noche:[[0,'#0a1330'],[.22,'#17264f'],[.44,'#2b3e70']]};
  /* Luz sobre el paisaje: una matriz de color sobre todo lo que no es cielo */
  const LUZ={amanecer:'.98 .04 .02 0 .03 .02 .9 .03 0 .02 .02 .04 .88 0 .05 0 0 0 1 0',atardecer:'.92 .06 0 0 .04 .02 .8 .04 0 .02 .04 .06 .8 0 .06 0 0 0 1 0',noche:'.26 .06 .02 0 .03 .04 .32 .06 0 .05 .07 .12 .46 0 .13 0 0 0 1 0'};
  /* Sol, sol bajo o luna: dónde va en cada montaña (1 a 5) */
  const CEL={dia:[[300,168],[296,170],[300,150],[300,150],[300,170]],amanecer:[[300,380],[292,382],[304,346],[304,262],[330,482]],atardecer:[[44,396],[60,414],[52,472],[46,488],[34,520]],noche:[[68,164],[66,166],[64,170],[64,170],[66,170]]};

  /* Mientras se dibuja un paisaje: el cielo, lo que vuela y las luces van en capas aparte */
  const LX={u:'',ph:'dia',t0:0,still:false,sky:'',air:'',fx:'',seed:1,css:'',kf:new Set(),rk:0};
  const toSky=s=>(LX.sky+=s,''), toAir=s=>(LX.air+=s,''), toFx=s=>(LX.fx+=s,'');
  const isNight=()=>LX.ph==='noche', lightsOn=()=>LX.ph==='noche'||LX.ph==='atardecer';
  const rnd=()=>(LX.seed=LX.seed*16807%2147483647)/2147483647;
  /* Cada animación empieza en un punto distinto de su ciclo y sigue el reloj de la página (--ago), así no se reinicia al volver a pintar */
  const an=(du,extra)=>` style="--du:${du.toFixed(2)}s;--dl:${(-rnd()*du).toFixed(2)}s${extra?';'+extra:''}"`;

  /* Piezas del paisaje */
  const f1=n=>n.toFixed(1);
  const GLOW='#ffd66b';
  const win=(x,y,w,h)=>`<circle cx="${f1(x+w/2)}" cy="${f1(y+h/2)}" r="${f1(Math.max(w,h)*1.8)}" fill="url(#${LX.u}wg)"/><rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="${GLOW}"/>`;
  const wins=a=>lightsOn()?toFx(a.map(w=>win(...w)).join('')):'';
  const zz=(x,y,s)=>{const d=-rnd()*3.6;return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s||1})" font-family="Poppins,sans-serif" font-weight="800" fill="#eef2ff"><text class="pz-zz" style="--du:3.6s;--dl:${d.toFixed(2)}s" font-size="7">z</text><text class="pz-zz" style="--du:3.6s;--dl:${(d-1.8).toFixed(2)}s" x="3" y="-1" font-size="9">z</text></g>`;};
  const zzz=(x,y,s)=>toFx(zz(x,y,s));
  const pine=(x,y,s,c)=>`<path d="M${f1(x)} ${f1(y-27*s)}L${f1(x+9*s)} ${f1(y-11*s)}H${f1(x+5*s)}L${f1(x+12*s)} ${f1(y+1*s)}H${f1(x-12*s)}L${f1(x-5*s)} ${f1(y-11*s)}H${f1(x-9*s)}Z" fill="${c||'#2f6b45'}"/>`;
  const tree=(x,y,s,c)=>`<rect x="${f1(x-1.6*s)}" y="${f1(y-7*s)}" width="${f1(3.2*s)}" height="${f1(8*s)}" fill="#7a5a3a"/><circle cx="${f1(x)}" cy="${f1(y-13*s)}" r="${f1(9*s)}" fill="${c||'#4a9a55'}"/>`;
  const rock=(x,y,s,c)=>`<path d="M${f1(x-12*s)} ${y}L${f1(x-7*s)} ${f1(y-9*s)}L${f1(x+2*s)} ${f1(y-12*s)}L${f1(x+11*s)} ${f1(y-5*s)}L${f1(x+13*s)} ${y}Z" fill="${c||'#8d96a8'}"/><path d="M${f1(x+2*s)} ${f1(y-12*s)}L${f1(x+11*s)} ${f1(y-5*s)}L${f1(x+13*s)} ${y}H${f1(x+3*s)}Z" fill="#000" fill-opacity=".14"/>`;
  const chalet=(x,y,s,wall,roof)=>wins([[x-6*s,y-9*s,4*s,4*s],[x+2*s,y-9*s,4*s,4*s]])+`<rect x="${f1(x-10*s)}" y="${f1(y-12*s)}" width="${f1(20*s)}" height="${f1(12*s)}" fill="${wall||'#a0673c'}"/><path d="M${f1(x-13*s)} ${f1(y-11*s)}L${x} ${f1(y-21*s)}L${f1(x+13*s)} ${f1(y-11*s)}Z" fill="${roof||'#5b3a22'}"/><rect x="${f1(x-6*s)}" y="${f1(y-9*s)}" width="${f1(4*s)}" height="${f1(4*s)}" fill="#fff6dc"/><rect x="${f1(x+2*s)}" y="${f1(y-9*s)}" width="${f1(4*s)}" height="${f1(4*s)}" fill="#fff6dc"/><rect x="${f1(x-7*s)}" y="${f1(y-4.6*s)}" width="${f1(14*s)}" height="${f1(1.8*s)}" fill="#e5383b"/>`;
  /* Vaca: de día pasta (baja la cabeza) y mueve la cola; de noche duerme tumbada */
  const cow=(x,y,s,flip)=>{
    const T=`translate(${x} ${y}) scale(${flip?-s:s} ${s})`;
    if(isNight()){
      zzz(x+(flip?-15:11)*s,y-9*s,s);
      return `<g transform="${T}"><path d="M-9 -1.6q-3 .2-3.4 2.6" stroke="#ece6da" stroke-width="1.3" fill="none" stroke-linecap="round"/><rect x="-9" y="-5.6" width="16" height="7" rx="3.2" fill="#fff"/><path d="M-6 -5.6h4v3.6h-4zM1 -4.6h3v3h-3z" fill="#3b2f2a"/><path d="M-6 1.9h3.4M2 1.9h3.4" stroke="#3b2f2a" stroke-width="1.5" stroke-linecap="round"/><rect x="5.6" y="-4.8" width="6.6" height="5.6" rx="2" fill="#fff"/><path d="M8 -4.8l1.3-1.8M11 -4.4l1.8-1.2" stroke="#b9a37a" stroke-width="1.1"/><path d="M8.6 -2.3h2.2" stroke="#3b2f2a" stroke-width=".8" stroke-linecap="round"/><circle cx="7" cy="1" r="1.3" fill="#f2c200"/></g>`;
    }
    return `<g transform="${T}"><g class="pz-tl"${an(2+rnd()*1.2)}><path d="M-9 -7.6q-2.8 1.6-2.2 6" stroke="#ece6da" stroke-width="1.3" fill="none" stroke-linecap="round"/><circle cx="-11.1" cy="-1.4" r="1.1" fill="#3b2f2a"/></g><rect x="-9" y="-9" width="16" height="8" rx="3" fill="#fff"/><path d="M-6 -9h4v4h-4zM1 -8h3v3h-3z" fill="#3b2f2a"/><path d="M-7 -1v4M-3 -1v4M2 -1v4M5 -1v4" stroke="#3b2f2a" stroke-width="1.6"/><g class="pz-hd"${an(6+rnd()*4)}><rect x="5.5" y="-11.5" width="6.5" height="6" rx="2" fill="#fff"/><path d="M8 -11.5l1.5-2M11 -11l2-1.4" stroke="#b9a37a" stroke-width="1.1"/><circle cx="10" cy="-9.4" r=".8" fill="#3b2f2a"/><circle cx="8.5" cy="-4" r="1.5" fill="#f2c200"/></g></g>`;
  };
  const cloud=(x,y,s,o)=>`<g class="pz-cl"${an(22+rnd()*18)} fill="#fff" opacity="${o||.9}"><ellipse cx="${x}" cy="${y}" rx="${f1(26*s)}" ry="${f1(9*s)}"/><ellipse cx="${f1(x-10*s)}" cy="${f1(y-6*s)}" rx="${f1(12*s)}" ry="${f1(9*s)}"/><ellipse cx="${f1(x+8*s)}" cy="${f1(y-9*s)}" rx="${f1(13*s)}" ry="${f1(11*s)}"/></g>`;
  const flagpole=(x,y,s)=>{s=s||1;return `<path d="M${x} ${y}V${f1(y-34*s)}" stroke="#4b5563" stroke-width="${f1(2*s)}"/><g class="pz-fl"${an(1.8+rnd()*.8,`transform-origin:${x}px ${f1(y-26.5*s)}px`)}><rect x="${x}" y="${f1(y-34*s)}" width="${f1(15*s)}" height="${f1(15*s)}" rx="${f1(2*s)}" fill="#ef4444"/><path d="M${f1(x+6*s)} ${f1(y-31*s)}h${f1(3*s)}v${f1(3.5*s)}h${f1(3.5*s)}v${f1(3*s)}h${f1(-3.5*s)}v${f1(3.5*s)}h${f1(-3*s)}v${f1(-3.5*s)}h${f1(-3.5*s)}v${f1(-3*s)}h${f1(3.5*s)}z" fill="#fff"/></g>`;};
  /* Trenes: de día suben y bajan por su vía; de noche duermen en su sitio con las ventanas encendidas */
  const TRN=c=>`<rect x="-17" y="-9" width="34" height="12" rx="3.5" fill="${c}"/><rect x="-17" y="0" width="34" height="3" fill="#000" fill-opacity=".18"/><rect x="-13" y="-6.5" width="6" height="4" rx="1" fill="#e8f4ff"/><rect x="-3" y="-6.5" width="6" height="4" rx="1" fill="#e8f4ff"/><rect x="7" y="-6.5" width="6" height="4" rx="1" fill="#e8f4ff"/>`;
  const train=(x,y,ang,c,s)=>{const T=`translate(${x} ${y}) rotate(${ang}) scale(${s||1})`;if(isNight()) toFx(`<g transform="${T}">${win(-13,-6.5,6,4)}${win(-3,-6.5,6,4)}${win(7,-6.5,6,4)}</g>`);return `<g transform="${T}">${TRN(c)}</g>`;};
  const parked=()=>isNight()||LX.still;
  const ln=(a,b)=>[a,a,b,b];
  /* Recorrido sobre la vía: se queda con los puntos que cumplen keep y recorta trim px al final; sube, para, baja y para */
  function rideLine(sg,keep,trim){
    let pts=[];
    for(const c of sg) for(let k=0;k<=40;k++){const p=bez(c,k/40);if(keep(p)&&!(pts.length&&Math.hypot(p[0]-pts[pts.length-1][0],p[1]-pts[pts.length-1][1])<.5)) pts.push(p);}
    let cut=0; while(pts.length>2&&cut<trim){const a=pts[pts.length-1],b=pts[pts.length-2];cut+=Math.hypot(a[0]-b[0],a[1]-b[1]);pts.pop();}
    return pts;
  }
  /* Recorrido como animación CSS (no SMIL, que obliga a redibujar todo el paisaje en cada fotograma):
     puntos de la vía cada pocos px, con arranque y frenada suaves; parado 12 %, sube 38 %, parado 12 %, baja 38 % */
  const ease=u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;
  const cars=c=>c.map(([dx,col,sc])=>`<g transform="translate(${dx} 0) scale(${sc})">${TRN(col)}</g>`).join('');
  function ride(pts,inner,du,rot){
    rot=rot!==false;
    const L=[0]; for(let i=1;i<pts.length;i++) L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
    const tot=L[L.length-1]; let last=null;
    const at=d=>{let i=1;while(i<pts.length-1&&L[i]<d)i++;const a=pts[i-1],b=pts[i],f=Math.min(1,Math.max(0,(d-L[i-1])/((L[i]-L[i-1])||1)));let g=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;if(last!=null){while(g-last>180)g-=360;while(g-last<-180)g+=360;}last=g;return `translate(${f1(a[0]+(b[0]-a[0])*f)}px,${f1(a[1]+(b[1]-a[1])*f)}px)${rot?` rotate(${f1(g)}deg)`:''}`;};
    const N=18, fr=[[0,at(0)]];
    for(let k=0;k<=N;k++) fr.push([12+38*k/N,at(tot*ease(k/N))]);
    fr.push([62,at(tot)]);
    for(let k=1;k<=N;k++) fr.push([62+38*k/N,at(tot*ease(1-k/N))]);
    const name=`${LX.u}r${LX.rk++}`;
    if(!LX.kf.has(name)){LX.kf.add(name);LX.css+=`@keyframes ${name}{${fr.map(([p,t])=>`${+p.toFixed(2)}%{transform:${t}}`).join('')}}`;}
    return `<g class="pz-tr" style="transform:${fr[0][1]};animation:${name} ${du}s linear infinite;animation-delay:calc(var(--ago,0s) - ${(rnd()*du).toFixed(2)}s)">${inner}</g>`;
  }
  const rail=d=>`<path d="${d}" fill="none" stroke="#bfae95" stroke-width="7" stroke-dasharray="1.6 4.4"/><path d="${d}" fill="none" stroke="#6b5b4b" stroke-width="2.4"/>`;
  /* Agua: las olas se mecen; de noche, el reflejo de la luna */
  const waves=(y,c)=>`<g class="pz-wv"${an(5+rnd()*2)}><path d="M22 ${y+16}h56M150 ${y+30}h74M262 ${y+12}h52M64 ${y+48}h40M210 ${y+58}h60" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/></g>`+(isNight()?toFx(`<g stroke="#fff3c4" stroke-linecap="round" stroke-width="2">${[[62,94,14],[66,90,26],[70,86,38],[74,82,50],[76,80,62]].map(([a,b,dy])=>`<path class="pz-mr"${an(2+rnd()*2)} d="M${a} ${y+dy}H${b}"/>`).join('')}</g>`):'');
  const STEAM='<path d="M-32 0h64l-7 9h-50z" fill="#fff"/><path d="M-32 0h64" stroke="#14213d" stroke-width="1.5"/><rect x="-25" y="-8" width="46" height="8" fill="#f4f1ea"/><rect x="-6" y="-19" width="5" height="11" fill="#f2c200"/><rect x="-6" y="-21" width="5" height="3" fill="#222"/><path d="M8 -8a7.5 7.5 0 0 1 15 0z" fill="#e5383b"/><rect x="-20" y="-6" width="3" height="3" fill="#7fb3d5"/><rect x="-14" y="-6" width="3" height="3" fill="#7fb3d5"/>';
  /* Barco de vapor: de día cruza el lago echando humo; de noche descansa con las ventanas encendidas */
  const steamer=(x,y,s)=>{
    const T=`translate(${x} ${y}) scale(${s||1})`;
    if(isNight()){toFx(`<g transform="${T}">${win(-20,-6,3,3)}${win(-14,-6,3,3)}</g>`);return `<g transform="${T}">${STEAM}</g>`;}
    const d=-rnd()*3.6;
    return `<g transform="${T}"><g class="pz-sm"${an(90)}><g class="pz-bt"${an(3.4)}>${STEAM}</g>${[0,1,2].map(k=>`<circle class="pz-pf" style="--du:3.6s;--dl:${(d-k*1.2).toFixed(2)}s" cx="-3.5" cy="-24" r="3" fill="#fff" fill-opacity=".85"/>`).join('')}</g></g>`;
  };
  const boat=(x,y)=>{const b=`<path d="M${x-10} ${y}h20l-4 5h-12z" fill="#fff"/><path d="M${x} ${y}V${y-14}L${x+8} ${y-2}Z" fill="#fff" stroke="#c9d6e3"/>`;return isNight()?b:`<g class="pz-dr"${an(24+rnd()*16)}><g class="pz-bt"${an(2.8+rnd(),`transform-origin:${x}px ${y+3}px`)}>${b}</g></g>`;};
  const range=(d,c,snow)=>`<path d="${d}" fill="${c}"/>${snow?`<path d="${snow}" fill="#fff" fill-opacity=".9"/>`:''}`;
  const forest=(pts,s,c)=>pts.map(([x,y],k)=>k%3===2?tree(x,y,s*.9,c&&c[1]):pine(x,y,s,c&&c[0])).join('');
  function lg(id,y1,y2,stops){return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${y1}" x2="0" y2="${y2}">${stops.map(([o,c])=>`<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;}
  function sky(id,stops){return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o,c])=>`<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;}
  const skyG=(id,day)=>sky(id,LX.ph==='dia'?day:CIELO[LX.ph]);
  /* Lo que vuela (pájaros, parapente, dragón) va por delante de las montañas y no sale de noche */
  const birds=ys=>isNight()?'':toAir(ys.map(y=>{const bx=Math.round(90+rnd()*180);return `<g transform="translate(${bx} ${y})"><g class="pz-bd"${an(30+rnd()*14,`--bx:${bx}px`)}><g transform="translate(0 ${f1(rnd()*8)})"><path class="pz-bw"${an(.5+rnd()*.25)} d="M-5 0q2.5-3 5 0q2.5-3 5 0" fill="none" stroke="#334155" stroke-width="1.3" stroke-linecap="round"/></g></g></g>`;}).join(''));

  /* 1 · Uetliberg: torre mirador, bosque, el tren de la ciudad y Zürich con el Grossmünster junto al lago */
  function sceneUet(u){
    let s=`<defs>${skyG(u+'s',[[0,'#bfe6fb'],[.3,'#e6f6ff'],[.42,'#f3fbff']])}${lg(u+'h',330,1050,[[0,'#4f9a5c'],[.55,'#6fb06a'],[1,'#94cc80']])}</defs>`;
    toSky(cloud(64,96,1.1)+cloud(296,150,.8,.8));
    birds([236,262]);
    s+=range('M0 430L30 396L52 408L82 368L106 392L132 356L162 386L190 350L222 382L252 358L284 390L312 366L342 394L360 384V470H0Z','#dbe5f0','M82 368L76 380L84 377L90 382L94 376ZM132 356L126 368L133 365L139 370L142 364ZM190 350L184 362L191 359L197 364L200 358ZM252 358L246 370L253 367L259 372L262 366Z');
    s+=`<path d="M0 520C70 450 116 346 162 330C210 316 262 380 300 440C322 470 342 494 360 506V1240H0Z" fill="url(#${u}h)"/>`;
    s+=forest([[12,520],[30,500],[48,478],[66,456],[82,430],[98,404],[114,382],[226,372],[246,398],[264,424],[282,452],[302,478],[322,500],[342,520]],1,['#2f6b45','#3f8a4c']);
    s+=forest([[22,620],[44,640],[30,700],[318,600],[338,630],[320,690],[26,880],[48,900],[316,820],[340,850],[22,980],[332,1000],[310,1040]],1.05,['#2c6441','#3d874a']);
    /* Torre mirador de celosía en Uto Kulm */
    s+=`<g stroke="#5b6b7d" stroke-width="2.2" fill="none"><path d="M178 334L186 214M206 334L198 214"/><path d="M180 316L204 296M182 296L202 316M182 276L200 260M184 260L200 276M186 240L198 228M186 228L198 240"/></g><rect x="181" y="206" width="22" height="9" rx="2" fill="#5b6b7d"/>`+flagpole(192,206,.8);
    s+=`<rect x="128" y="316" width="34" height="16" rx="2" fill="#f4efe6"/><path d="M125 318L145 306L165 318Z" fill="#9b4a3a"/><rect x="134" y="321" width="5" height="5" fill="#9fc3e0"/><rect x="144" y="321" width="5" height="5" fill="#9fc3e0"/><rect x="154" y="321" width="5" height="5" fill="#9fc3e0"/>`+wins([[134,321,5,5],[144,321,5,5],[154,321,5,5]]);
    /* Tren del Uetliberg */
    s+=rail('M-6 1112C26 1010 40 900 52 800S66 640 92 560');
    s+=parked()?train(50,812,-80,'#2563eb',.9):ride(rideLine([[[-6,1112],[26,1010],[40,900],[52,800]],[[52,800],[64,700],[66,640],[92,560]]],p=>p[1]<=SEAM-28,16),cars([[0,'#2563eb',.9]]),34);
    /* Zürich: lago, casas y las dos torres del Grossmünster */
    s+=`<rect x="0" y="1150" width="360" height="90" fill="#6cc0e8"/>`+waves(1150,'#b9e3f6');
    s+=boat(96,1206)+boat(250,1222);
    s+=[[200,1150],[222,1150],[244,1150],[336,1150],[356,1150]].map(([x,y])=>wins([[x-6,y-15,4,4],[x+2,y-15,4,4]])+`<rect x="${x-10}" y="${y-22}" width="20" height="22" fill="#efe6d6"/><path d="M${x-12} ${y-20}L${x} ${y-32}L${x+12} ${y-20}Z" fill="#b5543d"/>`).join('');
    s+=`<g fill="#eadfca"><rect x="276" y="1086" width="13" height="64"/><rect x="299" y="1086" width="13" height="64"/><rect x="270" y="1118" width="48" height="32"/></g><g fill="#5b6b7d"><path d="M276 1086h13l-6.5-16z"/><path d="M299 1086h13l-6.5-16z"/></g><rect x="279" y="1096" width="7" height="9" rx="3" fill="#7a8899"/><rect x="302" y="1096" width="7" height="9" rx="3" fill="#7a8899"/>`+wins([[279,1096,7,9],[302,1096,7,9],[286,1128,6,8]]);
    return s;
  }
  /* 2 · Rigi: la antena y el hotel de Rigi Kulm, el tren cremallera, vacas y el lago de los Cuatro Cantones */
  function sceneRigi(u){
    let s=`<defs>${skyG(u+'s',[[0,'#ffd9b0'],[.16,'#ffeccf'],[.4,'#dff4f8']])}${lg(u+'h',300,1050,[[0,'#5fb36a'],[.5,'#7fc276'],[1,'#a5d58f']])}</defs>`;
    toSky(cloud(70,120,1.05)+cloud(250,90,.8,.8));
    birds([232,256]);
    s+=range('M0 446L24 410L48 424L76 380L100 404L128 366L156 398L188 360L216 392L244 368L276 402L300 380L330 410L360 392V490H0Z','#cfdcea','M76 380L70 392L78 389L84 394L88 388ZM128 366L122 378L129 375L135 380L138 374ZM188 360L182 372L189 369L195 374L198 368ZM244 368L238 380L245 377L251 382L254 376Z');
    s+=`<path d="M0 520C60 470 110 330 176 304C238 318 296 420 360 488V1240H0Z" fill="url(#${u}h)"/>`;
    /* Antena y hotel de Rigi Kulm; de noche parpadea su luz roja */
    s+=`<rect x="206" y="128" width="5" height="180" fill="#e9eef5" stroke="#b9c4d2" stroke-width="1"/><rect x="200" y="196" width="17" height="7" rx="2" fill="#dfe6ef" stroke="#b9c4d2"/><rect x="202" y="150" width="13" height="5" rx="2" fill="#dfe6ef" stroke="#b9c4d2"/><rect x="207" y="108" width="3" height="22" fill="#ef4444"/>`;
    if(isNight()) toFx(`<g class="pz-bl"${an(2)}><circle cx="208.5" cy="108" r="7" fill="#ff4d4d" fill-opacity=".3"/><circle cx="208.5" cy="108" r="2.6" fill="#ff6b6b"/></g>`);
    s+=`<rect x="124" y="292" width="44" height="22" fill="#f6f1e8"/><path d="M120 294L146 280L172 294Z" fill="#8f3b2f"/>`+[130,140,150,160].map(x=>`<rect x="${x}" y="298" width="5" height="5" fill="#8db7d8"/><rect x="${x}" y="306" width="5" height="5" fill="#8db7d8"/>`).join('')+wins([130,140,150,160].flatMap(x=>[[x,298,5,5],[x,306,5,5]]));
    /* Tren cremallera Vitznau–Rigi, el primero de montaña de Europa (1871) */
    s+=rail('M372 1132C336 1030 322 900 314 780S300 520 226 318');
    s+=parked()?train(316,742,-86,'#e5383b')+train(312,690,-84,'#e5383b',.95):ride(rideLine([[[372,1132],[336,1030],[322,900],[314,780]],[[314,780],[306,660],[300,520],[226,318]]],p=>p[1]<=SEAM-62,58),cars([[-26,'#e5383b',1],[26,'#e5383b',.95]]),44);
    s+=cow(52,722,1.1)+cow(78,748,1,1)+cow(40,776,.95)+cow(300,560,1)+cow(328,590,1,1)+cow(60,600,.9,1);
    s+=chalet(46,960,1.1)+chalet(332,880,1)+tree(24,1010,1.1)+tree(70,1020,1)+tree(340,980,1.1)+pine(300,1020,1.1)+pine(26,880,1);
    /* Lago de los Cuatro Cantones con un barco de vapor y Vitznau */
    s+=`<rect x="0" y="1150" width="360" height="90" fill="#3fbcd3"/>`+waves(1150,'#a5e6f0');
    s+=steamer(250,1206,1.05);
    s+=chalet(36,1150,.95,'#f1e4cf','#9b4a3a')+chalet(66,1152,.9,'#e8d6bd','#7c3b2b')+chalet(96,1150,.95,'#f1e4cf','#9b4a3a');
    return s;
  }
  /* Dragón de la leyenda de Pilatus: de día vuela por el cielo; de noche duerme sobre una nube */
  const DRG='<path d="M-34 8C-22 -6 -6 12 8 0C16 -6 23 -3 29 -9" stroke="#2b8a6e" stroke-width="5" fill="none" stroke-linecap="round"/>';
  function dragon(){
    if(isNight()){
      toAir(`<g class="pz-dr"${an(40)}><g fill="#4a5986"><ellipse cx="294" cy="262" rx="36" ry="11"/><ellipse cx="278" cy="254" rx="15" ry="11"/><ellipse cx="306" cy="251" rx="17" ry="13"/></g><g transform="translate(294 247) scale(.8)" fill="#2f7d68"><path d="M-30 2C-22 -6 -8 -4 6 -4C16 -4 22 -2 27 1" stroke="#2f7d68" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M-9 -6L-2 -15L8 -6Z"/><path d="M-30 2L-38 -2L-35 6Z"/><circle cx="29" cy="1" r="4"/><path d="M32 0l6 1.5-6 1.5z"/><path d="M27.6 -.4h2.8" stroke="#0f3d30" stroke-width=".9" stroke-linecap="round"/></g><ellipse cx="290" cy="259" rx="27" ry="7" fill="#4a5986"/>${zz(320,236,1.15)}</g>`);
      return '';
    }
    toAir(`<g transform="translate(184 198)"><g class="pz-dg"${an(30)}><g class="pz-dh"${an(3.2)}><g transform="scale(1.15)" fill="#2b8a6e">${DRG}<g class="pz-dw"${an(.5)}><path d="M-6 3L-2 -24L10 -4ZM5 0L17 -19L19 -2Z"/></g><circle cx="30" cy="-10" r="4"/><path d="M33 -12l6-2-4 4z"/><circle cx="31" cy="-11" r=".9" fill="#fff"/><path d="M-34 8L-43 3L-39 12Z"/></g></g></g></g>`);
    return '';
  }
  /* 3 · Pilatus: picos de roca, el hotel de Pilatus Kulm, el cremallera más empinado del mundo (48 %), el teleférico y el dragón de la leyenda */
  function scenePil(u){
    let s=`<defs>${skyG(u+'s',[[0,'#c3d3ff'],[.3,'#e3ebff'],[.45,'#eef3ff']])}${sky(u+'r',[[0,'#6f80a6'],[.5,'#8597bb'],[1,'#9db0cf']])}${lg(u+'g',780,1050,[[0,'#86bf88'],[1,'#a9d49a']])}</defs>`;
    toSky(cloud(60,110,1)+(isNight()?'':cloud(300,260,.9,.85))+cloud(40,380,.7,.7));
    birds([300]);
    s+=`<path d="M0 560L36 500L64 456L86 394L104 410L124 330L144 356L160 278L174 250L186 274L204 238L220 282L240 266L262 336L288 320L312 400L336 430L360 470V1240H0Z" fill="url(#${u}r)"/>`;
    s+=`<path d="M174 250L168 266L176 262L182 270L186 274ZM204 238L198 254L206 250L212 258L220 282L214 262ZM124 330L118 344L126 340L131 348ZM288 320L282 334L290 330L295 338Z" fill="#fff" fill-opacity=".85"/>`;
    s+=`<path d="M0 830C80 778 260 770 360 812V1240H0Z" fill="url(#${u}g)"/>`;
    s+=rock(70,560,1.2,'#7b8bae')+rock(292,600,1.4,'#7b8bae')+rock(40,700,1,'#7889ab')+rock(318,700,1.1,'#7889ab')+rock(60,780,.9,'#8190b2');
    /* Hotel Pilatus Kulm */
    s+=`<rect x="222" y="262" width="34" height="20" fill="#f4efe6"/><path d="M222 262a17 9 0 0 1 34 0z" fill="#d6dbe6"/><rect x="226" y="268" width="4" height="4" fill="#7fa6cf"/><rect x="236" y="268" width="4" height="4" fill="#7fa6cf"/><rect x="246" y="268" width="4" height="4" fill="#7fa6cf"/>`+wins([[226,268,4,4],[236,268,4,4],[246,268,4,4]]);
    /* Cremallera de Alpnachstad, 48 % de pendiente */
    s+=rail('M-6 1060L30 900L62 760L92 620L128 470L164 330');
    s+=(parked()?train(64,744,-77,'#e5383b'):ride(rideLine([ln([-6,1060],[30,900]),ln([30,900],[62,760]),ln([62,760],[92,620]),ln([92,620],[128,470]),ln([128,470],[164,330])],p=>p[1]<=SEAM-28,20),cars([[0,'#e5383b',1]]),38))+`<rect x="2" y="944" width="40" height="18" rx="5" fill="#f2c200"/><text x="22" y="957" text-anchor="middle" font-family="Poppins,sans-serif" font-size="11" font-weight="800" fill="#1f2937">48 %</text>`;
    /* Teleférico: la cabina sube y baja por el cable */
    const CAB='<path d="M0 0v10" stroke="#475569" stroke-width="1.4"/><rect x="-8" y="10" width="16" height="12" rx="3" fill="#e5383b"/><rect x="-5" y="13" width="10" height="4" fill="#e8f4ff"/>';
    s+=`<path d="M372 760L246 300" stroke="#475569" stroke-width="1.4"/>`;
    if(parked()){ s+=`<g transform="translate(309 530)">${CAB}</g>`; if(isNight()) toFx(`<g transform="translate(309 530)">${win(-5,13,10,4)}</g>`); }
    else s+=ride([[358,709],[260,351]],CAB,40,false);
    s+=dragon();
    s+=forest([[24,880],[46,900],[316,860],[338,884],[24,980],[330,990],[300,1040]],1.05,['#2f6b45','#3f8a4c']);
    /* Lago de Alpnach y la estación */
    s+=`<rect x="0" y="1150" width="360" height="90" fill="#4f9fe0"/>`+waves(1150,'#a9d1f5');
    s+=`<rect x="10" y="1124" width="40" height="22" fill="#efe6d6"/><path d="M6 1126L30 1112L54 1126Z" fill="#8f3b2f"/>`+wins([[16,1130,5,6],[26,1130,5,6],[36,1130,5,6]])+boat(230,1206);
    return s;
  }
  /* 4 · Eiger: la cara norte, el Mönch y la Jungfrau al fondo, glaciares, el tren de Kleine Scheidegg y los chalés de Grindelwald */
  function sceneEig(u){
    let s=`<defs>${skyG(u+'s',[[0,'#ffd88f'],[.25,'#ffefcc'],[.45,'#fff7e6']])}${sky(u+'r',[[0,'#8b7a66'],[.6,'#9d8b74'],[1,'#ad9c84']])}${lg(u+'g',810,1050,[[0,'#93c37b'],[1,'#b8da98']])}</defs>`;
    toSky(cloud(54,120,1,.85)+cloud(310,70,.7,.75));
    birds([300,322]);
    /* Parapente sobre Grindelwald */
    if(!isNight()) toAir(`<g transform="translate(210 180)"><g class="pz-pg"${an(56)}><g class="pz-sw"${an(4)}><path d="M-13 0a13 6 0 0 1 26 0z" fill="#e5383b"/><path d="M-13 0a13 6 0 0 1 26 0" fill="none" stroke="#f2c200" stroke-width="1.6"/><path d="M-12 0L-1 12M12 0L1 12M-5 -4L0 12M5 -4L0 12" stroke="#64748b" stroke-width=".6"/><rect x="-2" y="11.5" width="4" height="4.4" rx="1.8" fill="#1f2937"/></g></g></g>`);
    s+=range('M150 360L206 270L230 296L262 226L292 262L322 220L360 258V640H150Z','#efe2c8','M262 226L254 244L264 240L272 248L278 240ZM322 220L314 238L324 234L332 242L338 234ZM206 270L200 284L208 281L214 287Z');
    s+=`<path d="M0 600L54 500L104 380L150 270L188 196L206 226L238 300L284 410L330 500L360 540V1240H0Z" fill="url(#${u}r)"/>`;
    s+=`<path d="M0 600L54 500L104 380L150 270L188 196L178 280L150 390L112 520L70 640L0 720Z" fill="#4e3f33" fill-opacity=".55"/>`;
    s+=`<path d="M188 196L206 226L224 262L212 256L198 232ZM238 300L262 352L250 348L236 318ZM284 410L310 456L296 452L280 424Z" fill="#fff" fill-opacity=".92"/>`;
    s+=`<path d="M250 520C276 506 316 512 346 534C330 560 290 566 262 556Z" fill="#e6f3fb"/><path d="M262 540h60" stroke="#c6e2f3" stroke-width="2"/>`;
    s+=`<path d="M0 860C100 810 260 806 360 846V1240H0Z" fill="url(#${u}g)"/>`;
    /* Kleine Scheidegg: estación y trenes; el amarillo va y viene */
    s+=rail('M150 858C210 842 280 838 372 846');
    s+=`<rect x="296" y="818" width="40" height="24" fill="#f4efe6"/><path d="M292 820L316 804L340 820Z" fill="#7c3b2b"/>`+wins([[301,825,6,6],[313,825,6,6],[325,825,6,6]]);
    s+=(parked()?train(214,846,-6,'#d1a800'):ride(rideLine([[[150,858],[210,842],[280,838],[372,846]]],p=>p[0]>=218&&p[0]<=318,0),cars([[0,'#d1a800',1]]),30))+train(180,850,-4,'#2f8f4e',.95);
    s+=rock(50,660,1.1,'#8a7967')+rock(300,640,1,'#8a7967')+rock(36,760,1,'#8a7967');
    /* Grindelwald */
    s+=chalet(40,1080,1.1)+chalet(84,1110,1)+chalet(300,1070,1.1)+chalet(330,1110,1)+chalet(250,1130,.95)+chalet(130,1150,.95);
    s+=forest([[20,960],[44,990],[316,950],[340,980],[18,1180],[340,1190],[200,1200]],1.05,['#2f6b45','#3f8a4c']);
    s+=`<path d="M0 1200C80 1186 280 1186 360 1200V1240H0Z" fill="#a6d18a"/>`;
    return s;
  }
  /* 5 · Matterhorn: la pirámide con su luz rosada, la cabaña Hörnli, el Gornergrat con sus cúpulas y Zermatt */
  function sceneMat(u){
    let s=`<defs>${skyG(u+'s',[[0,'#ffbfa8'],[.22,'#ffe0d4'],[.45,'#fff3ee']])}${sky(u+'r',[[0,'#7b615b'],[.6,'#8c736b'],[1,'#9b847a']])}${lg(u+'g',870,1050,[[0,'#9cc488'],[1,'#bcdaa0']])}</defs>`;
    toSky(cloud(300,110,.9,.8)+cloud(60,300,.8,.7));
    birds([250,274]);
    s+=`<path d="M0 660L60 560L112 430L146 320L166 214L172 160L186 132L198 150L206 214L232 320L276 430L326 540L360 590V1240H0Z" fill="url(#${u}r)"/>`;
    s+=`<path d="M186 132L198 150L206 214L232 320L276 430L326 540L360 590V700L250 620L214 420L198 230Z" fill="#f2a493" fill-opacity=".5"/>`;
    s+=`<path d="M172 160L186 132L180 168L170 214L160 258L154 250L164 200ZM206 214L216 262L210 300L202 250ZM120 430L132 380L130 440ZM248 360L262 410L252 404Z" fill="#fff" fill-opacity=".9"/>`;
    /* Cabaña Hörnli en la arista */
    s+=`<rect x="268" y="458" width="30" height="16" fill="#d9d2c6"/><path d="M265 460L283 450L301 460Z" fill="#6b5b4b"/>`+wins([[273,463,5,5],[285,463,5,5]])+flagpole(298,458,.6);
    s+=`<path d="M40 640C70 626 110 630 136 650C110 668 66 668 40 656Z" fill="#eef7fc"/>`;
    s+=`<path d="M200 820C250 772 310 752 360 760V900H200Z" fill="#9b8778"/>`;
    /* Gornergrat: hotel con dos cúpulas y el tren */
    s+=`<rect x="300" y="742" width="44" height="20" fill="#e8dfd2"/><path d="M304 742a7 7 0 0 1 14 0zM326 742a7 7 0 0 1 14 0z" fill="#f4f6f8" stroke="#c9ced6"/>`+wins([[306,748,5,5],[318,748,5,5],[330,748,5,5]]);
    s+=rail('M372 1000C340 940 300 880 262 820');
    s+=parked()?train(300,880,-125,'#e5383b'):ride(rideLine([[[372,1000],[340,940],[300,880],[262,820]]],()=>true,18),cars([[0,'#e5383b',1]]),32);
    s+=`<path d="M0 900C90 862 250 860 360 900V1240H0Z" fill="url(#${u}g)"/>`;
    s+=forest([[18,930],[40,950],[334,940],[20,1010],[340,1020],[330,1040]],1.05,['#3b6b45','#c9a24a']);
    /* Zermatt: chalés de madera oscura y el río */
    s+=`<path d="M-4 1236C80 1210 120 1190 180 1180S300 1160 364 1140" stroke="#7cc4e8" stroke-width="7" fill="none"/>`;
    s+=[[30,1120],[64,1140],[100,1124],[250,1110],[288,1128],[322,1112],[160,1150],[210,1160]].map(([x,y])=>chalet(x,y,1,'#6b4a2e','#3b2a1c')).join('');
    return s;
  }
  const SCENES={1:sceneUet,2:sceneRigi,3:scenePil,4:sceneEig,5:sceneMat};

  /* Sol de día con rayos que giran, sol bajo al amanecer y al atardecer, o luna con estrellas */
  function astro(lv,ph){
    const [x,y]=CEL[ph][lv-1];
    if(ph==='noche'){
      let s='';
      for(let k=0;k<46;k++){const sx=6+rnd()*348, sy=8+rnd()*500, r=.5+rnd()*1.1, tw=rnd()<.45, o=.55+rnd()*.45;s+=`<circle${tw?` class="pz-tw"${an(2.5+rnd()*3)}`:''} cx="${f1(sx)}" cy="${f1(sy)}" r="${r.toFixed(2)}" fill="#fff" fill-opacity="${o.toFixed(2)}"/>`;}
      s+=`<g transform="translate(262 64)"><path class="pz-sh"${an(13)} d="M0 0l22-9" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></g>`;
      return s+`<g transform="translate(${x} ${y})"><circle r="46" fill="url(#${LX.u}mg)"/><circle r="16" fill="#f6f0d4"/><circle cx="-5" cy="-4" r="3.2" fill="#e4dcba"/><circle cx="5" cy="4" r="2.4" fill="#e4dcba"/><circle cx="3" cy="-7" r="1.5" fill="#e4dcba"/><circle cx="-6" cy="6" r="1.3" fill="#e4dcba"/></g>`;
    }
    if(ph==='dia'){
      const rays=Array.from({length:12},(_,k)=>{const a=k*Math.PI/6;return `M${f1(27*Math.cos(a))} ${f1(27*Math.sin(a))}L${f1(33*Math.cos(a))} ${f1(33*Math.sin(a))}`;}).join('');
      return `<g transform="translate(${x} ${y})"><circle r="48" fill="url(#${LX.u}sg)"/><g class="pz-ry"${an(60)}><path d="${rays}" stroke="#ffd54a" stroke-width="3" stroke-linecap="round"/></g><circle r="21" fill="#ffd54a"/></g>`;
    }
    const c=ph==='amanecer'?['#ffd9a8','#ffb347']:['#ffc09a','#ff8a4c'];
    return `<g transform="translate(${x} ${y})"><circle r="62" fill="url(#${LX.u}sg)"/><circle r="31" fill="${c[1]}"/></g>`;
  }

  /* Luciérnagas de noche: pocas, una cada 340 px de alto, alternando a cada lado del camino */
  function bugs(H,ph){
    if(ph!=='noche') return '';
    let s='';
    for(let y=470,k=0;y<H-170;y+=340,k++){
      const x=k%2?296+rnd()*40:24+rnd()*40;
      s+=`<g transform="translate(${f1(x)} ${f1(y+(rnd()-.5)*60)})"><g class="pz-wx"${an(5+rnd()*4)}><g class="pz-wy"${an(3.5+rnd()*3)}><g class="pz-ff"${an(1.8+rnd()*1.6)}><circle r="7" fill="url(#${LX.u}fg)"/><circle r="1.6" fill="#f6ffb0"/></g></g></g></g>`;
    }
    return s;
  }
  /* El paisaje crece con el sendero: la cima arriba, el valle abajo y, en medio, más ladera con detalles de la montaña */
  const SEAM=1050;
  const BAND={1:'#94cc80',2:'#a5d58f',3:'#a9d49a',4:'#b8da98',5:'#bcdaa0'};
  const RAILX={1:11,2:349};
  function bandDeco(lv,y0,y1){
    let s='',k=0;
    for(let y=y0+56;y<y1-12;y+=62,k++){
      const xl=24+(k*13)%34, xr=314+(k*17)%28, a=k%3;
      if(lv===1) s+=(a===2?tree(xl,y,1):pine(xl,y,1.05))+(a===1?tree(xr,y,1):pine(xr,y,1.05));
      else if(lv===2) s+=(a===0?cow(xl,y,1.05,k%2)+cow(xl+28,y+14,.95):a===1?tree(xl,y,1.05):chalet(xl+4,y,1))+(a===1?cow(xr-10,y,1,1):a===2?tree(xr,y,1):pine(xr,y,1.05));
      else if(lv===3) s+=(a===1?rock(xl,y,1,'#8190b2'):pine(xl,y,1.05))+(a===0?tree(xr,y,1):a===1?pine(xr,y,1.05):rock(xr,y,.9,'#8190b2'));
      else if(lv===4) s+=(a===2?chalet(xl+6,y,1.05):pine(xl,y,1.05))+(a===0?tree(xr,y,1):a===1?chalet(xr-4,y,1):pine(xr,y,1.05));
      else s+=(a===1?chalet(xl+6,y,1,'#6b4a2e','#3b2a1c'):a===2?tree(xl,y,1,'#c9a24a'):pine(xl,y,1.05,'#3b6b45'))+(a===0?tree(xr,y,1,'#c9a24a'):a===1?pine(xr,y,1.05,'#3b6b45'):chalet(xr-4,y,1,'#6b4a2e','#3b2a1c'));
    }
    return s;
  }
  /* Capas, de atrás adelante: cielo (sol o luna, estrellas y nubes) · paisaje con la luz de la hora · lo que vuela · luces y «zzz».
     La escena se dibuja dos veces: la parte de arriba tal cual y el valle desplazado hacia abajo, con la franja de ladera en medio. */
  let sceneN=0;
  function land(lv,G,{phase=landscapePhase(),reducedMotion=false}={}){
    LX.css='';LX.kf=new Set();
    const u=LX.u='sc'+(++sceneN)+'_', H=G.H, d=H-1240, ph=LX.ph=phase;
    LX.t0=+(performance.now()/1000).toFixed(2); LX.still=reducedMotion;
    const run=id=>{LX.sky=LX.air=LX.fx='';LX.rk=0;LX.seed=lv*7919+1;const g=SCENES[lv](id);return {g,sky:LX.sky,air:LX.air,fx:LX.fx};};
    const A=run(u+'a'), B=d>0?run(u+'b'):null;
    let band='',fxBand='';
    if(d>0){LX.fx='';band=`<rect x="0" y="${SEAM-1}" width="360" height="${d+2}" fill="${BAND[lv]}"/>`+(RAILX[lv]!=null?rail(`M${RAILX[lv]} ${SEAM-1}V${SEAM+d+1}`):'')+bandDeco(lv,SEAM,SEAM+d);fxBand=LX.fx;}
    const dn=d>0?`<g transform="translate(0 ${d})"><g clip-path="url(#${u}cb)">`:'';
    let s=`<svg class="land t-${ph}" viewBox="0 0 360 ${H}" preserveAspectRatio="none" aria-hidden="true" style="--ago:${-LX.t0}s"><defs><clipPath id="${u}ct"><rect width="360" height="${d>0?SEAM:1240}"/></clipPath>`;
    if(d>0) s+=`<clipPath id="${u}cb"><rect y="${SEAM}" width="360" height="${1240-SEAM}"/></clipPath>`;
    const glow=(id,c,o)=>`<radialGradient id="${u}${id}"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
    s+=glow('fg','#e8ff6b',.8)+glow('wg','#ffc94d',.55)+glow('mg','#fff6d5',.45)+glow('sg',ph==='dia'?'#fff3b0':ph==='amanecer'?'#ffcf8f':'#ffb08a',ph==='dia'?.7:.75);
    if(ph!=='dia') s+=`<filter id="${u}f" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${LUZ[ph]}"/></filter>`;
    s+=`</defs>${LX.css?`<style>${LX.css}</style>`:''}<rect width="360" height="1240" fill="url(#${u}as)"/>${astro(lv,ph)}${A.sky}`;
    s+=`<g${ph!=='dia'?` filter="url(#${u}f)"`:''}><g clip-path="url(#${u}ct)">${A.g}</g>${d>0?band+dn+B.g+'</g></g>':''}</g>`;
    s+=A.air+bugs(H,ph)+`<g clip-path="url(#${u}ct)">${A.fx}</g>${d>0?fxBand+dn+B.fx+'</g></g>':''}`;
    return s+'</svg>';
  }


export {geo,land,trailSVG,WAY,landscapePhase};
