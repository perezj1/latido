import assert from 'node:assert/strict'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {mejorasDatabase,mejoraCall,migrations} from './lib/mejoras-test-db.mjs'
import {A,B,C,call,profile} from './lib/suizamente-v2-test-db.mjs'
const {db,config}=await mejorasDatabase(),checks=[],api=(p,a,b)=>mejoraCall(db,p,a,b)
const noSecret=value=>{assert.ok(!/"(?:correcta|dato|payload|orden|preguntas)"\s*:/.test(JSON.stringify(value)),'No unrevealed answers, facts, orders or bank snapshots')}
const fails=async(p,a,b,code)=>assert.rejects(()=>api(p,a,b),new RegExp('SZV2:'+code+':'))
async function minuteAnswer(m,correct=true){const q=(await db.query('SELECT payload,orden FROM suizamente_private.minuto_respuestas WHERE partida=$1 AND n=$2',[m.id,m.pregunta.n])).rows[0],right=q.orden.indexOf(q.payload.correcta);return api(A,'minuto/respuesta',{id:m.id,n:m.pregunta.n,opcion:correct?right:(right+1)%q.orden.length})}
async function mirrorAnswer(p,r){const j=(await db.query('SELECT r.preguntas,j.orden FROM suizamente_private.espejo_retos r JOIN suizamente_private.espejo_jugadas j ON j.reto=r.id WHERE r.id=$1 AND j.persona=$2',[r.id,p])).rows[0];return api(p,'espejo/respuesta',{id:r.id,n:r.pregunta.n,opcion:j.orden.indexOf(j.preguntas[r.pregunta.n].correcta),ms:0,acierto:true})}
try{
 for(const [p,name] of [[A,'Alex'],[B,'Lu'],[C,'Caro']]){await call(db,p,'guardar_jugador',profile(name));await call(db,p,'bienvenida')}
 for(const p of [B,C])await db.query("INSERT INTO suizamente_private.suizamente_amigos(seguidor,seguido,estado) VALUES($1,$2,'aceptado'),($2,$1,'aceptado')",[A,p])
 for(const action of ['minuto/inicio','espejo/inicio','misterio/hoy','decorar/inicio','avisos/inicio'])await fails(A,action,{},404)
 // Reapplying additive definitions preserves rows and never changes legacy functions.
 const legacy=await db.query("SELECT p.oid::regprocedure::text name,pg_get_functiondef(p.oid) def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND p.proname NOT LIKE 'mej_%' ORDER BY name")
 for(const name of migrations)await db.exec(await readFile('supabase/suizamente_v'+name+'.sql','utf8'))
 assert.deepEqual((await db.query("SELECT p.oid::regprocedure::text name,pg_get_functiondef(p.oid) def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND p.proname NOT LIKE 'mej_%' ORDER BY name")).rows,legacy.rows)
 for(const [k,v] of Object.entries(config))if(v&&typeof v==='object')config[k].activo=true
 await db.query('UPDATE suizamente_private.mejoras_configuracion SET mejoras=$1::jsonb',[JSON.stringify(config)])
 await fails(null,'minuto/inicio',{},401)
 await db.query('UPDATE suizamente_private.suizamente_jugadores SET bloqueado=true WHERE jugador_id=$1',[A]);for(const action of ['minuto/inicio','espejo/inicio','misterio/hoy','decorar/inicio','avisos/inicio'])await fails(A,action,{},403);await db.query('UPDATE suizamente_private.suizamente_jugadores SET bloqueado=false,renombrar=true WHERE jugador_id=$1',[A]);await fails(A,'minuto/inicio',{},403);await db.query('UPDATE suizamente_private.suizamente_jugadores SET renombrar=false WHERE jugador_id=$1',[A]);await db.query('UPDATE public.profiles SET banned=true WHERE id=$1',[A]);await fails(A,'minuto/inicio',{},403);await db.query('UPDATE public.profiles SET banned=false WHERE id=$1',[A])
 checks.push('All five features default off; SQL gate rejects them; repeat migrations preserve legacy function definitions; authenticated-only play')
 const startKey=crypto.randomUUID();let m=await api(A,'minuto/empezar',{clave:startKey});noSecret(m)
 assert.equal((await api(A,'minuto/empezar',{clave:startKey})).id,m.id)
 const firstQuestionId=m.pregunta.id
 for(let i=0;i<config.minuto.rachaDesde;i++)m=await minuteAnswer(m)
 assert.equal(m.resultado.puntos,config.minuto.puntosAcierto+config.minuto.puntosRacha);assert.equal(m.racha,config.minuto.rachaDesde)
 const points=m.puntos,deadline=Date.parse(m.fin_previsto),issued=m.pregunta.n
 m=await minuteAnswer(m,false);assert.equal(Date.parse(m.fin_previsto),deadline-config.minuto.segundosFallo*1000);assert.equal(m.racha,0);assert.equal(m.fallos,1)
 assert.equal((await api(A,'minuto/respuesta',{id:m.id,n:issued,opcion:0})).puntos,points,'Duplicate answer never scores again')
 const repeated=(await db.query('SELECT count(*) n,count(DISTINCT pregunta) distinct_n FROM suizamente_private.minuto_respuestas WHERE partida=$1',[m.id])).rows[0];assert.equal(repeated.n,repeated.distinct_n)
 await db.query("UPDATE suizamente_private.minuto_partidas SET fin_previsto=clock_timestamp()-interval '1 second' WHERE id=$1",[m.id]);m=await api(A,'minuto/terminar',{id:m.id})
 assert.equal(m.estado,'terminado');assert.equal(m.nuevo_record,true);assert.equal(m.premio.monedas,Math.floor(points/config.minuto.puntosPorMoneda));assert.equal(m.premio.xp,Math.floor(points*config.minuto.xpPorPunto))
 await api(A,'minuto/terminar',{id:m.id});assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_movimientos WHERE motivo='minuto' AND ref=$1",[m.id])).rows[0].n),1)
 let late=await api(A,'minuto/empezar',{clave:crypto.randomUUID()});await db.query("UPDATE suizamente_private.minuto_partidas SET fin_previsto=clock_timestamp()-make_interval(secs=>$2::int) WHERE id=$1",[late.id,4]);late=await minuteAnswer(late);assert.equal(late.puntos,0);assert.equal(late.estado,'terminado')
 for(let n=2;n<=config.minuto.partidasConPremioAlDia;n++){let next=await api(A,'minuto/empezar',{clave:crypto.randomUUID()});next=await minuteAnswer(next);next=await api(A,'minuto/terminar',{id:next.id,abandonar:true});if(n===config.minuto.partidasConPremioAlDia){assert.equal(next.premiada,false);assert.deepEqual(next.premio,{monedas:0,xp:0});assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_movimientos WHERE motivo='minuto' AND ref=$1",[next.id])).rows[0].n),0)}}
 await api(A,'minuto/retar',{id:m.id,amigo:B});assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.mejoras_avisos WHERE persona=$1 AND tipo='minuto_reto'",[B])).rows[0].n),1)
 await db.query('UPDATE suizamente_private.suizamente_jugadores SET en_ranking=false WHERE jugador_id=$1',[A]);assert.deepEqual((await api(A,'minuto/inicio')).clasificacion,[]);await db.query('UPDATE suizamente_private.suizamente_jugadores SET en_ranking=true WHERE jugador_id=$1',[A]);assert.equal((await api(A,'minuto/inicio',{periodo:'semana'})).clasificacion[0].id,A)
 checks.push('Minute: server clock, streak bonus, -5 seconds, unique questions, late/duplicate responses, exactly-once ledger, daily reward limit, personal record, private rankings and friend challenge')
 let r=await api(A,'espejo/crear',{amigo:B,clave:crypto.randomUUID()});noSecret(r);r=await api(A,'espejo/empezar',{id:r.id})
 const firstQuestion=r.pregunta.id
 for(let n=0;n<config.espejo.preguntas;n++)r=await mirrorAnswer(A,r)
 const waiting=await api(B,'espejo/ver',{id:r.id});noSecret(waiting);assert.equal(waiting.suJugada.respuestas,undefined);assert.equal(waiting.suJugada.aciertos,config.espejo.preguntas)
 let b=await api(B,'espejo/empezar',{id:r.id});assert.equal(b.pregunta.id,firstQuestion)
 await db.query('UPDATE suizamente_private.espejo_jugadas SET ms_total=$3 WHERE reto=$1 AND persona=$2',[r.id,A,config.espejo.preguntas*config.espejo.segundosPorPregunta*1000])
 for(let n=0;n<config.espejo.preguntas;n++)b=await mirrorAnswer(B,b)
 assert.equal(b.estado,'jugado');assert.equal(b.resultado.ganador,B);assert.equal(b.premio.monedas,config.espejo.premioVictoria.monedas);assert.equal((await api(A,'espejo/ver',{id:r.id})).premio.xp,config.espejo.premioJugar.xp)
 await api(B,'espejo/empezar',{id:r.id});await api(B,'espejo/ver',{id:r.id});assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_movimientos WHERE motivo='espejo' AND ref LIKE $1",[r.id+':%'])).rows[0].n),2)
 const rematch=await api(B,'espejo/revancha',{id:r.id,clave:crypto.randomUUID()});assert.notEqual(rematch.id,r.id)
 const banks=(await db.query('SELECT preguntas FROM suizamente_private.espejo_retos WHERE id=ANY($1)',[[r.id,rematch.id]])).rows;assert.equal(banks[0].preguntas.filter(q=>banks[1].preguntas.some(v=>v.id===q.id)).length,0)
 const link=await api(A,'espejo/crear',{clave:crypto.randomUUID()}),code=link.enlace.split('/').pop();await api(C,'espejo/aceptar',{codigo:code});await fails(B,'espejo/aceptar',{codigo:code},409)
 await db.query("UPDATE suizamente_private.espejo_retos SET caduca=clock_timestamp()-interval '1 second' WHERE id=$1",[link.id]);assert.equal((await api(A,'espejo/ver',{id:link.id})).estado,'caducado')
 checks.push('Mirror: same ordered questions, own answers hidden, server time breaks a score tie, no replay or double payment, fresh rematch bank, one recipient per link, expiry notification')
 assert.equal((await api(A,'misterio/hoy')).disponible,false)
 const sample=(await readFile('fuentes/misterios.txt','utf8')).split(/\r?\n/).find(l=>l.startsWith('# FECHA |')).slice(2).split('|').map(s=>s.trim())
 const fixture={tipo:sample[1],pregunta:sample[2],imagen:null,pistas:sample.slice(4,7),opciones:sample.slice(7,11).map(t=>t.replace(/^\*/,'')),correcta:sample.slice(7,11).findIndex(t=>t.startsWith('*')),dato:sample[11]}
 const today=(await db.query("SELECT (clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date::text d")).rows[0].d
 await db.query('INSERT INTO suizamente_private.misterios VALUES($1,$2::jsonb),($1::date-1,$2::jsonb)',[today,JSON.stringify(fixture)])
 for(const [p,clues] of [[A,1],[B,2],[C,3]]){let mystery=await api(p,'misterio/hoy');noSecret(mystery);assert.equal(mystery.pistas.length,1);for(let n=2;n<=clues;n++)mystery=await api(p,'misterio/pista',{fecha:today,pista:n});mystery=await api(p,'misterio/respuesta',{fecha:today,opcion:0});assert.equal(mystery.premio.monedas,config.misterio.monedasPorPistas[clues-1]);assert.equal(mystery.porcentaje,null);await api(p,'misterio/respuesta',{fecha:today,opcion:0})}
 assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_movimientos WHERE motivo='misterio'")).rows[0].n),3)
 await db.query('INSERT INTO suizamente_private.misterio_intentos(persona,fecha,resuelto,terminado) VALUES($1,$2::date-1,true,true)',[A,today]);assert.equal((await api(A,'misterio/hoy')).racha,2)
 checks.push('Mystery: absent day is silent, clues/solution/fact hidden, rewards for 1/2/3 clues, exactly-once payment and consecutive-day streak')
 await fails(A,'decorar/visitar',{amigo:'44444444-4444-4444-8444-444444444444'},403)
 await db.query("INSERT INTO suizamente_private.suizamente_mapa(jugador_id,vuelta,canton,nivel) VALUES($1,1,'LU',3)",[A]);let d=await api(A,'decorar/inicio');assert.equal(d.tipos.find(t=>t.id==='vacas').tuya,true)
 await api(A,'decorar/inicio');assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.suizamente_movimientos WHERE motivo='decoracion' AND ref='vacas'")).rows[0].n),1)
 const earth=d.huecos.find(h=>h.canton==='LU'&&h.tipo==='tierra'),water=d.huecos.find(h=>h.canton==='LU'&&h.tipo==='agua')
 await api(A,'decorar/poner',{decoracion:'vacas',hueco:earth.id,vuelta:1});await fails(A,'decorar/poner',{decoracion:'vacas',hueco:water.id,vuelta:1},400)
 await api(A,'decorar/quitar',{decoracion:'vacas'});d=await api(A,'decorar/inicio');assert.equal(d.puestas.length,0)
 await api(B,'decorar/gustar',{amigo:A,activo:true});await api(B,'decorar/gustar',{amigo:A,activo:true});assert.equal((await api(B,'decorar/visitar',{amigo:A})).gustos,1);await api(B,'decorar/gustar',{amigo:A,activo:false});assert.equal((await api(B,'decorar/visitar',{amigo:A})).gustos,0)
 checks.push('Decorations: only real achievements unlock once, ownership and slot types enforced, put/remove, friends-only read access, like is idempotent and removable')
 assert.deepEqual(await api(A,'avisos/inicio'),{ideas:false,sin_noches:true,misterio:false})
 const overview=await api(A,'resumen');assert.ok(overview.modos.length>=2);assert.ok(overview.ideas.length<=config.unToque.paraTiMax)
 await api(A,'avisos/guardar',{ideas:true,sin_noches:true,misterio:true})
 await assert.rejects(()=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE authenticated');return tx.query('SELECT public.suizamente_mejoras_avisos()')}),/permission denied/)
 await db.query("SELECT public.suizamente_mejoras_avisos((($1::date)::timestamp+interval '23 hours') AT TIME ZONE 'Europe/Zurich')",[today]);assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.mejoras_avisos WHERE persona=$1 AND tipo='idea' AND enviado IS NOT NULL",[A])).rows[0].n),0)
 checks.push('One-touch overview uses real data and configured cap; ideas default off, quiet nights default on; scheduler requires service role and respects Zurich night hours')
 // Additional boundary cases from all five acceptance lists.
 const extra=async name=>{const id=crypto.randomUUID();await db.query('INSERT INTO auth.users(id) VALUES($1)',[id]);await db.query('INSERT INTO public.profiles(id,banned) VALUES($1,false)',[id]);await call(db,id,'guardar_jugador',profile(name));return id}
 await db.exec('DELETE FROM suizamente_private.suizamente_limites')
 const D=await extra('Dani'),E=await extra('Emi'),F=await extra('Fran')
 let wrong=await api(D,'misterio/hoy');wrong=await api(D,'misterio/respuesta',{fecha:today,opcion:1});assert.equal(wrong.pistasAbiertas,2);await fails(D,'misterio/respuesta',{fecha:today,opcion:1},409);wrong=await api(D,'misterio/respuesta',{fecha:today,opcion:2});assert.equal(wrong.pistasAbiertas,3);wrong=await api(D,'misterio/respuesta',{fecha:today,opcion:3});assert.equal(wrong.terminado,true);assert.equal(wrong.resuelto,false);assert.deepEqual(wrong.premio,{})
 for(let n=0;n<16;n++){const id=await extra('Muestra '+n);await db.query('INSERT INTO suizamente_private.misterio_intentos(persona,fecha,resuelto,terminado) VALUES($1,$2,true,true)',[id,today]);if(n===14)assert.equal((await api(A,'misterio/hoy')).porcentaje,null)}
 assert.equal((await api(A,'misterio/hoy')).porcentaje,95)
 await db.query('INSERT INTO suizamente_private.misterios VALUES($1::date-2,$2::jsonb)',[today,JSON.stringify(fixture)]);await db.query('INSERT INTO suizamente_private.misterio_intentos(persona,fecha,resuelto,terminado) VALUES($1,$2::date-2,true,true)',[B,today]);assert.equal((await api(B,'misterio/hoy')).racha,1,'An unsolved day breaks the streak')
 await fails(F,'misterio/respuesta',{fecha:'2000-01-01',opcion:0},409)
 const unexposed=(await db.query("SELECT id FROM suizamente_private.suizamente_preguntas WHERE payload->>'tipo'='real' AND NOT EXISTS(SELECT 1 FROM suizamente_private.minuto_respuestas r WHERE r.pregunta=suizamente_preguntas.id) LIMIT 1")).rows[0].id
 await fails(A,'libreta/guardar',{preguntaId:unexposed,guardar:true},409)
 await api(A,'libreta/guardar',{preguntaId:firstQuestionId,guardar:true});assert.equal((await call(db,A,'libreta')).datos[0].id,firstQuestionId)
 checks.push('Mystery three wrong answers close without prize, repeat is rejected, percentage stays hidden at 19 and appears at 20, a day gap breaks streak; new facts save only after answering')
 const tied=await api(A,'espejo/crear',{amigo:C,clave:crypto.randomUUID()})
 await db.query("INSERT INTO suizamente_private.espejo_jugadas(reto,persona,aciertos,ms_total,respuestas,terminado) VALUES($1,$2,5,1234,'[]',true),($1,$3,5,1234,'[]',true)",[tied.id,A,C]);await db.query('SELECT suizamente_private.mej_espejo_cerrar($1)',[tied.id])
 const exact=await api(A,'espejo/ver',{id:tied.id});assert.equal(exact.resultado.empate,true);assert.equal(exact.premio.monedas,config.espejo.premioVictoria.monedas/2);assert.equal(exact.premio.xp,config.espejo.premioVictoria.xp/2)
 for(let n=0;n<config.espejo.retosAbiertosMax;n++)await api(D,'espejo/crear',{clave:crypto.randomUUID()});await fails(D,'espejo/crear',{clave:crypto.randomUUID()},409)
 const directed=await api(B,'espejo/crear',{clave:crypto.randomUUID()});await api(E,'espejo/aceptar',{codigo:directed.enlace.split('/').pop()});await fails(F,'espejo/aceptar',{codigo:directed.enlace.split('/').pop()},409)
 assert.equal((await api(E,'resumen')).boton.id,'espejo')
 const normal=await call(db,E,'crear_partida',{rival:B});await db.query('UPDATE suizamente_private.suizamente_partidas SET barra_a=2 WHERE id=$1',[normal.id]);let hero=await api(E,'resumen');assert.equal(hero.boton.id,'partida');assert.match(hero.boton.linea,/A 1 acierto/);assert.ok(hero.ideas.every(i=>i.to!==hero.boton.to))
 await db.query("UPDATE suizamente_private.suizamente_partidas SET estado='terminada' WHERE id=$1",[normal.id]);await db.query("UPDATE suizamente_private.espejo_retos SET estado='caducado' WHERE id=$1",[directed.id]);assert.equal((await api(E,'resumen')).boton.id,'misterio')
 const setFlags=async flags=>{const next=structuredClone(config);for(const k of ['minuto','espejo','misterio','decorar','unToque'])next[k].activo=!!flags[k];await db.query('UPDATE suizamente_private.mejoras_configuracion SET mejoras=$1::jsonb',[JSON.stringify(next)])}
 for(const k of ['minuto','espejo','misterio','decorar']){await setFlags({[k]:true,unToque:true});assert.deepEqual((await api(F,'resumen')).modos.map(m=>m.id),k==='decorar'?[]:[k])}
 await setFlags({unToque:true});await db.query('UPDATE suizamente_private.suizamente_jugadores SET monedas=0 WHERE jugador_id=$1',[F]);const empty=await api(F,'resumen');assert.equal(empty.boton.id,'nueva');assert.deepEqual(empty.modos,[]);assert.deepEqual(empty.ideas,[])
 await db.query('UPDATE suizamente_private.mejoras_configuracion SET mejoras=$1::jsonb',[JSON.stringify(config)])
 checks.push('Mirror exact tie pays half to each, open challenge cap enforced and a second link recipient rejected; all four CTA priorities, independent flags and empty real recommendations')
 // Explicit fixture ownership lets placement tests isolate the server constraints.
 await db.query("INSERT INTO suizamente_private.persona_decoraciones(persona,decoracion) VALUES($1,'barco') ON CONFLICT DO NOTHING",[A])
 await fails(A,'decorar/poner',{decoracion:'barco',hueco:earth.id,vuelta:1},400)
 const vacant=d.huecos.find(h=>h.canton!=='LU'&&h.tipo==='tierra');await fails(A,'decorar/poner',{decoracion:'vacas',hueco:vacant.id,vuelta:1},409)
 const land2=d.huecos.find(h=>h.canton==='LU'&&h.tipo==='tierra'&&h.id!==earth.id);await api(A,'decorar/poner',{decoracion:'vacas',hueco:earth.id,vuelta:1});await api(A,'decorar/poner',{decoracion:'vacas',hueco:land2.id,vuelta:1});assert.equal((await api(A,'decorar/inicio')).puestas.find(h=>h.k==='vacas').id,land2.id)
 await api(A,'decorar/momento',{decoracion:'barco'});assert.equal((await api(A,'decorar/momento',{decoracion:'barco'})).mostrar,false)
 await fails(B,'decorar/poner',{amigo:A,decoracion:'vacas',hueco:earth.id,vuelta:1},403)
 await api(A,'avisos/guardar',{ideas:true,sin_noches:true,misterio:true});await db.query('UPDATE suizamente_private.suizamente_jugadores SET monedas=1000 WHERE jugador_id=$1',[A])
 for(let n=0;n<2;n++)await db.query("SELECT public.suizamente_mejoras_avisos((($1::date)::timestamp+interval '12 hours') AT TIME ZONE 'Europe/Zurich')",[today])
 assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.mejoras_avisos WHERE persona=$1 AND tipo='idea' AND enviado IS NOT NULL",[A])).rows[0].n),config.unToque.ideasAlDiaMax)
 await api(F,'avisos/guardar',{ideas:false,sin_noches:true,misterio:true});await db.query("SELECT public.suizamente_mejoras_avisos((($1::date)::timestamp+interval '12 hours') AT TIME ZONE 'Europe/Zurich')",[today]);assert.equal(Number((await db.query("SELECT count(*) n FROM suizamente_private.mejoras_avisos WHERE persona=$1 AND tipo='misterio_nuevo' AND enviado IS NOT NULL",[F])).rows[0].n),1)
 checks.push('Boat cannot go on land, unbuilt cantons reject placement, move is atomic, visitor cannot edit, decoration moment is claimed only once; real daytime ideas capped at one and mystery opt-in sends once')
 // Local midnight is 23:00 UTC in winter, not the UTC calendar day.
 const score=async(person,points,when)=>db.query("INSERT INTO suizamente_private.minuto_partidas(persona,clave,inicio,fin_previsto,fin,puntos,estado,reglas,premiada,numero_dia) VALUES($1,gen_random_uuid(),$3::timestamptz,$3::timestamptz,$3::timestamptz,$2,'terminado',$4::jsonb,false,100)",[person,points,when,JSON.stringify(config.minuto)])
 const periods=(await db.query("SELECT ($1::date::timestamp AT TIME ZONE 'Europe/Zurich') today,(date_trunc('week',$1::date::timestamp) AT TIME ZONE 'Europe/Zurich') week_start,(date_trunc('month',$1::date::timestamp) AT TIME ZONE 'Europe/Zurich') month_start",[today])).rows[0]
 await score(B,100,periods.today);await score(C,100,new Date(Date.parse(periods.today)+1000));await score(B,1000,new Date(Date.parse(periods.month_start)-1000));await score(C,900,new Date(Date.parse(periods.week_start)-1000))
 const todayRanks=(await api(A,'minuto/inicio',{periodo:'hoy'})).clasificacion;assert.deepEqual(todayRanks.slice(0,2).map(p=>p.id),[B,C]);assert.equal(todayRanks[0].puntos,100)
 const weekRanks=(await api(A,'minuto/inicio',{periodo:'semana'})).clasificacion;assert.equal(weekRanks[0].puntos,100)
 const monthRanks=(await api(A,'minuto/inicio',{periodo:'mes'})).clasificacion;assert.ok(monthRanks.every(p=>p.puntos<1000));assert.equal(monthRanks[0].puntos,Date.parse(periods.week_start)-1000>=Date.parse(periods.month_start)?900:100)
 await db.query('UPDATE suizamente_private.suizamente_jugadores SET en_ranking=false WHERE jugador_id=$1',[B]);assert.ok((await api(A,'minuto/inicio',{periodo:'mes'})).clasificacion.every(p=>p.id!==B));assert.ok(!JSON.stringify(monthRanks).includes('email'))
 checks.push('Zurich midnight, Monday and month boundaries; best score per period, equal scores ordered by earliest finish and friend ranking opt-out')
 await mkdir('output/mejoras',{recursive:true});await writeFile('output/mejoras/servidor.json',JSON.stringify({checks},null,2));console.log(JSON.stringify({checks},null,2))
}catch(e){console.error(e.message,e.query||'');process.exitCode=1}finally{await db.close()}
