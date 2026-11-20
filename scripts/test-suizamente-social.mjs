import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const db=new PGlite()
const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222',guest='33333333-3333-4333-8333-333333333333'
const actor=id=>id===guest?'anon:'+id:'user:'+id
const questions=JSON.parse(await readFile('public/suizamente/data/preguntas.json','utf8')).preguntas
const real=questions.filter(q=>q.tipo==='real'),dilema=questions.find(q=>q.tipo==='dilema'&&q.opciones.length===2)
async function call(action,data={},id=alice){return (await db.query('SELECT public.suizamente_social_api($1,$2,$3::jsonb,$4) r',[action,actor(id),JSON.stringify(data),'test:'+id])).rows[0].r}
async function resetLimits(){await db.exec('DELETE FROM suizamente_social.limites; DELETE FROM public.suizamente_votos_limites')}
try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}');
 CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users,name text,canton text,banned boolean DEFAULT false);
 CREATE TABLE public.admin_users(user_id uuid PRIMARY KEY);
 CREATE TABLE public.app_notifications(id uuid DEFAULT gen_random_uuid(),recipient_id uuid REFERENCES public.profiles,kind text CHECK(kind IN('message','creator_follow')),source_id text,data jsonb CHECK(jsonb_typeof(data)='object'),seen_at timestamptz,read_at timestamptz,created_at timestamptz DEFAULT now(),UNIQUE(recipient_id,kind,source_id));
 INSERT INTO auth.users(id) VALUES('${alice}'),('${bob}');
 INSERT INTO public.profiles VALUES('${alice}','Nombre de Latido','Zürich',false),('${bob}','Otra persona','Uri',false);
 INSERT INTO public.admin_users VALUES('${alice}');`)
 await db.exec(await readFile('supabase/suizamente_votos.sql','utf8'))
 await db.exec(await readFile('supabase/suizamente_social_instalar.sql','utf8'))
 const profile=(await call('bootstrap')).perfil
 assert.equal(profile.apodo,'Nombre de Latido');assert.equal(profile.canton,'ZH');assert.equal(profile.puntos,0)
 await call('bootstrap',{},bob)
 await assert.rejects(call('perfil_guardar',{ajustes:{avisos:'incorrecto'}}),e=>e.code==='PT400')
 await assert.rejects(call('perfil_guardar',{ajustes:[]}),e=>e.code==='PT400')
 await assert.rejects(call('perfil_guardar',{enRanking:'false'}),e=>e.code==='PT400')
 await call('perfil_guardar',{ajustes:{avisos:false,apariencia:'dark'},enRanking:false})
 assert.equal((await call('perfil')).perfil.ajustes.avisos,false)
 await call('perfil_guardar',{ajustes:{avisos:true},enRanking:true})
 for(const [i,q] of real.slice(0,3).entries()) {
  const result=await call('respuesta',{preguntaId:q.id,opcion:q.correcta,puntos:99999})
  assert.equal(result.puntos,i===2?15:10)
 }
 assert.equal((await call('respuesta',{preguntaId:real[0].id,opcion:real[0].correcta})).puntos,0)
 assert.equal((await call('respuesta',{preguntaId:dilema.id,opcion:0})).puntos,5)
 assert.equal((await call('perfil')).perfil.puntos,40)
 console.log('PASS: profile reuses Latido identity; server-only points, streak and first-vote idempotency.')
 const daily=await call('reto'),same=await call('reto',{},bob)
 assert.deepEqual(daily.preguntas,same.preguntas)
 assert.equal(daily.preguntas.filter(id=>questions.find(q=>q.id===id).tipo==='real').length,3)
 for(const id of daily.preguntas){const q=questions.find(q=>q.id===id);await call('respuesta',{preguntaId:id,opcion:q.correcta??0,contexto:{tipo:'reto',fecha:daily.fecha}})}
 assert.equal((await call('reto')).hecho,true)
 assert.equal((await db.query("SELECT count(*)::int n FROM suizamente_social.puntos WHERE motivo='reto'")).rows[0].n,1)
 await assert.rejects(call('respuesta',{preguntaId:dilema.id,opcion:0,contexto:{tipo:'reto',fecha:'2000-01-01'}}),e=>e.code==='PT409')
 console.log('PASS: daily challenge shared selection, context validation and single completion bonus.')
 await resetLimits()
 await call('amigo_solicitar',{id:actor(bob)})
 assert.equal((await call('amigos',{},bob)).amistades[0].recibida,true)
 await call('amigo_responder',{id:actor(alice),respuesta:'aceptar'},bob)
 assert.equal((await call('amigos')).amistades[0].estado,'aceptada')
 assert.equal(JSON.stringify(await call('buscar',{texto:'Otra'})).includes('email'),false)
 const duel=await call('duelo_crear',{modo:'mix',rival:actor(bob)})
 assert.equal(duel.preguntas.length,10)
 await call('duelo_unirse',{codigo:duel.codigo},bob)
 for(const player of [alice,bob]) for(const id of duel.preguntas){const q=questions.find(q=>q.id===id);await call('respuesta',{preguntaId:id,opcion:q.correcta??0,contexto:{tipo:'duelo',codigo:duel.codigo}},player)}
 const finished=await call('duelo',{codigo:duel.codigo})
 assert.equal(finished.estado,'terminado');assert.equal(Object.keys(finished.respuestasCreador).length,10)
 const rematch=await call('duelo_revancha',{codigo:duel.codigo})
 assert.notEqual(rematch.codigo,duel.codigo);assert.equal(rematch.modo,duel.modo)
 assert.equal((await call('duelos',{},bob)).duelos.some(d=>d.codigo===rematch.codigo),true)
 assert.equal(Object.keys((await call('duelo',{codigo:duel.codigo},guest)).respuestasCreador).length,0)
 await assert.rejects(call('duelo_crear',{modo:'mix'},guest),e=>e.code==='PT401')
 console.log('PASS: friendship requests, accepted friends, shared duel, private answers and guest restrictions.')
 await resetLimits()
 await call('libreta_guardar',{preguntaId:dilema.id})
 assert.deepEqual((await call('libreta')).libreta,[dilema.id])
 const proposal={tipo:'dilema',tema:'comida',pregunta:'Una propuesta de prueba',opciones:['Opción uno','Opción dos'],dato:'Un dato aportado para la prueba.'}
 const created=await call('propuesta_crear',proposal,bob)
 await assert.rejects(call('moderacion',{},bob),e=>e.code==='PT403')
 await call('moderar',{id:created.propuestas[0].id,estado:'aprobada',contenido:{pregunta:'Una propuesta revisada por Latido',opciones:['Opción revisada','Otra opción'],dato:'Una explicación revisada antes de publicar.'}})
 const revised=(await call('propuestas',{},bob)).propuestas[0]
 assert.equal(revised.estado,'aprobada');assert.equal(revised.pregunta,'Una propuesta revisada por Latido');assert.equal(revised.opciones[0],'Opción revisada')
 await assert.rejects(call('moderar',{id:revised.id,estado:'aprobada',contenido:{opciones:['Única opción']}}),e=>e.code==='PT400')
 const ranking=await call('ranking',{tipo:'cantones'})
 assert.equal(ranking.filas.length,26);assert.equal(ranking.criterio,'media_por_jugador_activo')
 for(const row of ranking.filas) assert.equal(Number(row.media),row.activos?Math.round(Number(row.puntos)/Number(row.activos)*100)/100:0)
 console.log('PASS: notebook, proposals/moderation and cantonal league by average per active account.')
 await resetLimits()
 const savedIds=(await db.query('SELECT pregunta_id FROM public.suizamente_votos WHERE jugador_id=$1',[actor(alice)])).rows.map(r=>r.pregunta_id)
 const fresh=real.filter(q=>!savedIds.includes(q.id)).slice(0,2)
 const wrong=(fresh[0].correcta+1)%fresh[0].opciones.length
 await call('respuesta',{preguntaId:fresh[0].id,opcion:wrong})
 const beforeLink=(await call('perfil')).perfil.puntos
 await call('respuesta',{preguntaId:fresh[0].id,opcion:fresh[0].correcta},guest)
 await call('respuesta',{preguntaId:fresh[1].id,opcion:fresh[1].correcta},guest)
 await call('libreta_guardar',{preguntaId:fresh[1].id},guest)
 await call('vincular',{invitado:guest})
 assert.equal((await call('perfil')).perfil.puntos,beforeLink+10)
 assert.equal((await db.query('SELECT opcion FROM public.suizamente_votos WHERE jugador_id=$1 AND pregunta_id=$2',[actor(alice),fresh[0].id])).rows[0].opcion,wrong)
 assert.ok((await call('libreta')).libreta.includes(fresh[1].id))
 await call('vincular',{invitado:guest})
 assert.equal((await call('perfil')).perfil.puntos,beforeLink+10)
 // Legacy guest ballots absent from the current playable metadata are retained.
 await db.exec('BEGIN')
 await db.query("INSERT INTO public.suizamente_catalogo_votos VALUES('legacy-retained-fixture',2)")
 await db.query("INSERT INTO public.suizamente_votos(pregunta_id,jugador_id,opcion) VALUES('legacy-retained-fixture',$1,0)",[actor(guest)])
 await call('vincular',{invitado:guest})
 assert.equal((await db.query("SELECT jugador_id FROM public.suizamente_votos WHERE pregunta_id='legacy-retained-fixture'")).rows[0].jugador_id,actor(alice))
 assert.equal((await call('perfil')).perfil.puntos,beforeLink+10)
 await db.exec('ROLLBACK')
 console.log('PASS: guest linking transfers progress once; account answers and zero-point entries win conflicts.')
 await db.exec('BEGIN')
 const charlie='44444444-4444-4444-8444-444444444444'
 await db.exec(`INSERT INTO auth.users(id) VALUES('${charlie}');INSERT INTO public.profiles VALUES('${charlie}','Third fixture','ZH',false);
 INSERT INTO suizamente_social.jugadores(id,usuario_id,apodo,canton) VALUES('user:${charlie}','${charlie}','Third fixture','ZH');
 DELETE FROM public.suizamente_votos WHERE jugador_id IN('user:${alice}','user:${bob}');
 DELETE FROM suizamente_social.respuestas;DELETE FROM suizamente_social.puntos;
 INSERT INTO suizamente_social.respuestas VALUES('user:${alice}','${real[0].id}',0,false,'ZH',now()),('user:${bob}','${real[0].id}',0,false,'UR',now()),('user:${charlie}','${real[0].id}',0,false,'ZH',now());
 INSERT INTO suizamente_social.puntos VALUES('user:${alice}','test','week',20,'ZH',now()),('user:${bob}','test','week',15,'UR',now());`)
 const mean=await call('ranking',{tipo:'cantones'})
 assert.equal(mean.filas[0].codigo,'UR')
 assert.equal(Number(mean.filas.find(row=>row.codigo==='ZH').media),10)
 assert.equal(Number(mean.filas.find(row=>row.codigo==='ZH').activos),2)
 await db.exec('ROLLBACK')
 console.log('PASS: a smaller canton beats a larger total by average; zero-point active accounts remain in the denominator.')
 await db.exec('BEGIN')
 for(const [country,count] of [['ES',19],['CO',20]])await db.query(`WITH nuevos AS(INSERT INTO suizamente_social.jugadores(id,pais) SELECT 'anon:'||gen_random_uuid(),$1 FROM generate_series(1,$2::int) RETURNING id)
 INSERT INTO public.suizamente_votos(pregunta_id,jugador_id,opcion) SELECT $3,id,0 FROM nuevos`,[country,count,dilema.id])
 const groups=await call('desglose',{preguntaId:dilema.id,por:'pais'})
 assert.deepEqual(groups.grupos.map(g=>g.grupo),['CO'])
 await db.exec('ROLLBACK')
 console.log('PASS: demographic groups with fewer than 20 votes never leave the server.')
 const expires=await call('duelo_crear',{modo:'preguntas'})
 await db.query("UPDATE suizamente_social.duelos SET caduca_en=now()-interval '1 second' WHERE codigo=$1",[expires.codigo])
 assert.equal((await call('duelo',{codigo:expires.codigo})).estado,'caducado')
 await assert.rejects(call('duelo_unirse',{codigo:expires.codigo},bob),e=>e.code==='PT409')
 const voteCount=(await db.query('SELECT count(*)::int n FROM public.suizamente_votos')).rows[0].n
 await assert.rejects(call('borrar',{confirmacion:'BORRAR'}),e=>e.code==='PT400')
 await call('borrar',{confirmacion:'BORRAR',confirmado:true},bob)
 assert.equal((await db.query('SELECT count(*)::int n FROM public.suizamente_votos')).rows[0].n,voteCount)
 assert.equal((await db.query('SELECT count(*)::int n FROM auth.users WHERE id=$1',[bob])).rows[0].n,1)
 console.log('PASS: duel expiry and double-confirmed game erasure preserve anonymous totals and the Latido account.')
 for(const file of ['01-estructura','02-catalogo','03-funciones','04-api']) await db.exec(await readFile(`supabase/suizamente-social/${file}.sql`,'utf8'))
 await db.exec('SET ROLE anon')
 await assert.rejects(db.query("SELECT * FROM suizamente_social.jugadores"),e=>e.code==='42501')
 await assert.rejects(db.query("SELECT public.suizamente_social_api('perfil',$1,'{}','ip')",[actor(alice)]),e=>e.code==='42501')
 await db.exec('RESET ROLE')
 console.log('PASS: repeatable additive SQL; anon cannot read private tables or invoke the service RPC.')
} catch(error) {
 console.error(JSON.stringify({message:error.message,code:error.code,query:error.internalQuery,where:error.where},null,2));process.exitCode=1
} finally {await db.close()}
