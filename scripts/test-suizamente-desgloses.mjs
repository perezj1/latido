import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {fixture,alice} from '../apps/suizamente/test/social-db.mjs'
import {perfilesDemo,repartoDemo} from '../public/suizamente/demostracion.js'

const {db,questions}=await fixture()
try{
  const sql=await readFile('supabase/suizamente_desgloses_ejemplo.sql','utf8')
  const actor='user:'+alice
  const call=(action,data={})=>db.query('SELECT public.suizamente_social_api($1,$2,$3::jsonb,$4) r',[action,actor,JSON.stringify(data),'fixture-desgloses']).then(r=>r.rows[0].r)
  await call('perfil_guardar',{pais:'CO',anosSuiza:'1a3'})
  const q=questions[0]
  await call('respuesta',{preguntaId:q.id,opcion:0})
  const before=(await db.query(`SELECT (SELECT count(*) FROM public.suizamente_votos) votos,
    (SELECT count(*) FROM suizamente_social.puntos) puntos,(SELECT count(*) FROM auth.users) usuarios`)).rows[0]
  await db.exec(sql);await db.exec(sql)
  const after=(await db.query(`SELECT (SELECT count(*) FROM public.suizamente_votos) votos,
    (SELECT count(*) FROM suizamente_social.puntos) puntos,(SELECT count(*) FROM auth.users) usuarios`)).rows[0]
  assert.deepEqual(after,before,'Updating twice must preserve real votes, points and accounts')
  const profiles=(await db.query('SELECT * FROM suizamente_social.demo_perfiles')).rows
  assert.equal(profiles.length,320)
  for(const p of perfilesDemo()){
    const row=profiles.find(row=>row.id===p.id)
    assert.equal(row.pais,p.pais);assert.equal(row.anos_suiza,p.anosSuiza);assert.equal(row.canton,p.canton)
  }
  // Check every question's two breakdowns against the exact displayed totals.
  const groups=(await db.query(`SELECT pregunta,dimension,suizamente_social.desglose_demo(pregunta,dimension) datos
    FROM suizamente_social.demo_repartos CROSS JOIN (VALUES('pais'),('anos')) dimensions(dimension)`)).rows
  assert.equal(groups.length,4000)
  for(const {pregunta,dimension,datos} of groups){
    const question=questions.find(q=>q.id===pregunta),expected=repartoDemo(question,[])
    const sums=[0,0,0]
    assert.equal(datos.demo,true);assert.equal(datos.grupos.length,dimension==='pais'?8:4)
    assert.equal(datos.grupos.reduce((n,g)=>n+g.votos,0),320)
    for(const g of datos.grupos){assert(g.votos>=20);assert.equal(g.conteos.reduce((a,b)=>a+b,0),g.votos);g.conteos.forEach((n,i)=>sums[i]+=n)}
    assert.deepEqual(sums,[expected.n[0],expected.n[1],expected.n[2]||0],pregunta)
  }
  const sample=await call('desglose',{preguntaId:q.id,por:'pais'})
  assert.equal(sample.demo,true);assert.equal(sample.tuGrupo,'CO');assert.equal(sample.votosReales,1)
  await db.query(`WITH nuevos AS(INSERT INTO suizamente_social.jugadores(id,pais,anos_suiza)
    SELECT 'anon:'||gen_random_uuid(),'CO','1a3' FROM generate_series(1,19) RETURNING id)
    INSERT INTO public.suizamente_votos(pregunta_id,jugador_id,opcion) SELECT $1,id,0 FROM nuevos`,[q.id])
  const real=await call('desglose',{preguntaId:q.id,por:'pais'})
  assert.equal(real.demo,false);assert.deepEqual(real.grupos,[{grupo:'CO',votos:20,conteos:[20,0,0]}])
  await assert.rejects(call('desglose',{preguntaId:'missing',por:'pais'}),e=>e.code==='PT400')
  await assert.rejects(call('desglose',{preguntaId:q.id,por:'invalid'}),e=>e.code==='PT400')
  for(const role of ['anon','authenticated']){
    await db.exec('SET ROLE '+role)
    await assert.rejects(db.query('SELECT * FROM suizamente_social.demo_perfiles'),e=>e.code==='42501')
    await assert.rejects(db.query("SELECT suizamente_social.desglose_demo('montana_lago','pais')"),e=>e.code==='42501')
    await db.exec('RESET ROLE')
  }
  console.log('PASS: 320 consistent profiles, 4,000 breakdowns match answer totals, real-vote switchover, repeatable SQL, and restricted access.')
}finally{await db.close()}
