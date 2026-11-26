import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium,webkit,expect as rawExpect} from '@playwright/test'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,B,C,call,profile} from './lib/suizamente-v2-test-db.mjs'
const engine=process.argv.includes('--webkit')?'webkit':'chromium',expect=rawExpect.configure({timeout:20000}),out='output/emparejamiento/'+engine,errors=[]
let preview,browser,page
try{
 await mkdir(out,{recursive:true});preview=await startSuizamentePreview(engine==='webkit'?5543:5542,{hmr:false});const db=preview.db,config=await call(db,A,'config')
 const D='44444444-4444-4444-8444-444444444444'
 await db.query('INSERT INTO auth.users(id) VALUES($1)',[D]);await db.query('INSERT INTO public.profiles(id,banned) VALUES($1,false)',[D]);await call(db,D,'guardar_jugador',profile('Dee'))
 await db.query('UPDATE suizamente_private.suizamente_jugadores SET bloqueado=true WHERE jugador_id=$1',[D])
 for(let i=0;i<2;i++)await db.query("INSERT INTO suizamente_private.suizamente_partidas(jugador_a,jugador_b,turno,estado,plazo,reglas) VALUES($1,$2,$1,'jugando',clock_timestamp()+interval '1 day',$3)",[B,D,JSON.stringify(config)])
 await db.query("UPDATE suizamente_private.suizamente_jugadores SET ultimo_visto_en=CASE WHEN jugador_id=$1 THEN clock_timestamp() ELSE clock_timestamp()-interval '1 day' END,xp=CASE WHEN jugador_id=$2 THEN 100000 ELSE 0 END",[B,C])
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true})
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
 await ctx.addInitScript(s=>{if(!/^https?:$/.test(location.protocol))return;localStorage.setItem('sb-127-auth-token',JSON.stringify(s));sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})},{access_token:testToken(A),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(A,'Alex')})
 page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));const starts=[];page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/suizamente/partidas')starts.push(r.postDataJSON())})
 const open=async()=>{await db.exec('DELETE FROM suizamente_private.suizamente_limites');await page.goto(preview.origin+'/suizamente/nueva');await expect(page.locator('.sv-start-random')).toBeVisible()}
 await open();await expect(page.locator('.sv-start-online')).toHaveCount(1);await expect(page.locator('.sv-start-online')).toContainText('Lu');await expect(page.locator('.sv-start-online')).toContainText('En línea');await expect(page.locator('.sv-start-random')).toBeEnabled()
 for(const [width,height] of [[390,844],[375,667],[320,568],[1440,900]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('.sv-start-players').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/online-y-azar-'+width+'.png'})}
 await page.setViewportSize({width:390,height:844});await page.locator('.sv-start-random').click();await expect(page).toHaveURL(/\/partida\//);const first=page.url().split('/').pop(),match=await call(db,A,'partida',{id:first});assert.equal(match.rival.id,C);assert.equal(match.teToca,true);assert.equal(match.estado,'jugando');assert.deepEqual(starts[0],{rival:'azar'});await expect(page.getByRole('button',{name:'Girar la ruleta',exact:true})).toBeEnabled()
 await open();await expect(page.locator('.sv-start-online')).toContainText('Lu');await db.query("UPDATE suizamente_private.suizamente_jugadores SET ultimo_visto_en=clock_timestamp()-interval '1 day' WHERE jugador_id=$1",[B]);await page.locator('.sv-start-online').click();await expect(page).toHaveURL(/\/partida\//);const second=page.url().split('/').pop();assert.equal((await call(db,A,'partida',{id:second})).rival.id,B)
 await db.query("UPDATE suizamente_private.suizamente_partidas SET estado='terminada' WHERE id=ANY($1::uuid[])",[[first,second]])
 await open();await expect(page.locator('.sv-start-online')).toHaveCount(0);await expect(page.locator('.sv-start-random')).toBeEnabled();await expect(page.locator('#sv-random-availability')).toContainText('aunque tu rival no esté en línea');await page.screenshot({path:out+'/solo-rivales-desconectados.png'});await page.locator('.sv-start-random').click();await expect(page).toHaveURL(/\/partida\//);assert.equal((await call(db,A,'partida',{id:page.url().split('/').pop()})).rival.id,C)
 await db.query('UPDATE suizamente_private.suizamente_jugadores SET renombrar=true WHERE jugador_id=$1',[B]);await open();await expect(page.locator('.sv-start-random')).toBeDisabled();await expect(page.locator('.sv-start-online')).toHaveCount(0);await page.screenshot({path:out+'/sin-rivales-elegibles.png'})
 assert.deepEqual(errors,[]);await writeFile(out+'/resultado.json',JSON.stringify({engine,errors,checks:['Online nearest-level suggestion and random card','Random selects the least-busy offline account in the server','Opponent may disconnect between suggestion and selection','Offline-only pool remains playable; no eligible opponent disables the button','320/375/390/desktop without horizontal overflow']},null,2));console.log(engine+': asynchronous matchmaking browser checks passed')
}catch(error){console.error(error.stack);await page?.screenshot({path:out+'/fallo.png'}).catch(()=>{});process.exitCode=1}finally{await browser?.close();await preview?.close()}
