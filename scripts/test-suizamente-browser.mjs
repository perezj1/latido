import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir,readFile } from 'node:fs/promises'
import { chromium,webkit,expect as baseExpect } from '@playwright/test'
import { createSuizamenteDb,szRpc,szCorrectChoice,finishSzSession,SZ_ALICE,SZ_BOB,SZ_ADMIN } from './lib/suizamente-test-db.mjs'
import {ARCADE_DEMO} from '../src/data/suizamenteArcadeDemo.js'
import {geo,land,landscapePhase} from '../src/components/suizamente/trailLandscape.js'
import {IMG} from '../src/components/suizamente/questionArt.js'

const useWebkit=process.argv.includes('--webkit'),port=useWebkit?5256:5255,origin=`http://127.0.0.1:${port}`,output='output/latido-card/suizamente'
// Allow cold local imports and PGlite responses to settle on Windows.
const expect=baseExpect.configure({timeout:15000})
await mkdir(output,{recursive:true})
const server=spawn(process.execPath,['scripts/lib/suizamente-browser-server.mjs',String(port)],{
  env:{...process.env,VITE_SUPABASE_URL:`${origin}/suizamente-test-api`,VITE_SUPABASE_ANON_KEY:'test-key',VITE_ADMIN_EMAILS:'admin@latido.test'},stdio:'pipe',windowsHide:true,
})
let logs='',db,browser,failNextAnswer=false,legacyPairFeedback=false,legacyTrueFalse=false
const legacyStatements=JSON.parse(await readFile('supabase/seed-data/suizamente-presentation.json','utf8')).entries
server.stdout.on('data',d=>{logs+=d});server.stderr.on('data',d=>{logs+=d})
const errors=[]
try {
  db=await createSuizamenteDb({game:true})
  await szRpc(db,SZ_ALICE,'preferences',{canton:'ZH',alias:'AnaZH',leaderboard_opt_in:false})
  await szRpc(db,SZ_BOB,'preferences',{canton:'BE',alias:'BrunoBE',leaderboard_opt_in:false})
  await db.query('UPDATE suizamente_private.players SET xp=305,level=2 WHERE user_id=$1',[SZ_ALICE])
  for(let i=0;;i++){try{if((await fetch(origin)).ok)break}catch{}if(i>100)throw new Error(logs);await new Promise(r=>setTimeout(r,100))}
  browser=await(useWebkit?webkit:chromium).launch({headless:true})
  async function contextFor(actor,{cooperator=false}={}){
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
    const user=actor?{id:actor,email:actor===SZ_ADMIN?'admin@latido.test':actor===SZ_ALICE?'ana@latido.test':'bruno@latido.test',aud:'authenticated',role:'authenticated',created_at:'2026-03-12T12:00:00Z',app_metadata:{provider:'email',...(cooperator?{latido_account_role:'cooperator'}:{})},user_metadata:{name:actor===SZ_ALICE?'Ana':'Persona de prueba',latido_onboarding_completed:true,canton:actor===SZ_ALICE?'ZH':actor===SZ_BOB?'BE':''}}:null
    await context.addInitScript(({user})=>{
      if(user)localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user}))
      localStorage.setItem('latido_cookie_consent',JSON.stringify({policyVersion:'2026-08-08',expiresAt:new Date(Date.now()+86400000).toISOString(),categories:{necessary:true,analytics:false,externalMedia:false}}))
    },{user})
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url()),send=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':origin,'access-control-allow-headers':req.headers()['access-control-request-headers']||'authorization,apikey,content-type,x-client-info,prefer','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS'},body:JSON.stringify(data)})
      if(req.method()==='OPTIONS')return send({})
      if(url.origin!==origin)return send([])
      if(url.pathname.startsWith('/suizamente-test-api')){
        if(url.pathname.endsWith('/rpc/suizamente')){
          const body=req.postDataJSON()
          if(failNextAnswer&&body.p_action==='answer'){failNextAnswer=false;return send({message:'Temporary test connection failure',code:'TEST_NETWORK'},503)}
          try{
            const result=await szRpc(db,actor,body.p_action,body.p_args)
            if(legacyPairFeedback&&result.answer)delete result.answer.correct_pairs
            if(legacyTrueFalse&&result.question?.type==='tf'){
              const old=legacyStatements.find(entry=>entry.id===result.question.id)
              if(old)result.question={...result.question,id:'remote-legacy-tf',prompt:old.original_prompt}
            }
            return send(result)
          }catch(e){return send({message:e.message,code:e.code||'P0001'},400)}
        }
        if(url.pathname.endsWith('/rpc/get_my_account_access'))return send({role:cooperator?'cooperator':'owner',account_id:cooperator?SZ_ALICE:actor,name:'Titular delegado',can_delete:!cooperator})
        if(url.pathname.endsWith('/rpc/admin_dashboard_summary_v1'))return send({users:{},businesses:{},content:{},reports:{},moderation:{},creators:{},period:{days:7}})
        if(url.pathname.endsWith('/auth/v1/user'))return send(user)
        if(url.pathname.endsWith('/profiles')&&(req.headers().accept||'').includes('vnd.pgrst.object'))return send({id:actor,name:user?.user_metadata.name,banned:false,avatar_url:null,interests:[]})
        return send([])
      }
      if(url.pathname.startsWith('/api/'))return send({products:[]})
      return route.continue()
    })
    const page=await context.newPage(),onPageError=e=>errors.push({message:e.message,url:page.url(),actor,stack:e.stack})
    page.on('pageerror',onPageError)
    return {context,page,async close(){await page.waitForLoadState('networkidle');page.off('pageerror',onPageError);await context.close()}}
  }
  async function fits(page,label){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${label}: no horizontal overflow`)}
  async function visit(page,path){
    // Settle mocked SDK calls before replacing the document. WebKit otherwise
    // reports cancelled fetches from the previous document as access-control errors.
    if(page.url().startsWith(origin))await page.waitForLoadState('networkidle')
    await page.goto(`${origin}${path}`,{timeout:60000})
    await page.waitForLoadState('networkidle',{timeout:60000})
  }
  async function answerCurrent(page,actor,{wrong=false}={}){
    const id=new URL(page.url()).pathname.split('/').pop(),s=await szRpc(db,actor,'session',{id})
    if(!s.answer){
      const row=(await db.query('SELECT option_orders FROM suizamente_private.sessions WHERE id=$1',[id])).rows[0],q=(await db.query('SELECT payload FROM suizamente_private.versions WHERE id=$1',[s.question.version_id])).rows[0].payload,order=row.option_orders[s.question.version_id]
      if(q.game_type==='order'){
        for(const i of q.correct_order)await page.locator('.sg-order-bank').getByRole('button',{name:q.options[i],exact:true}).click()
        await page.getByRole('button',{name:'Comprobar',exact:true}).click()
      }else if(q.game_type==='short'){
        await page.getByRole('textbox',{name:'Tu respuesta',exact:true}).fill(q.accepted_answers[0])
        await page.getByRole('button',{name:'Comprobar',exact:true}).click()
      }else if(q.game_type==='match'){
        for(let i=0;i<4;i++){await page.locator('.sg-pair-column').first().getByRole('button').nth(i).click();await page.locator('.sg-pair-column').last().getByRole('button').nth(order.indexOf(i)).click();await expect(page.locator('.sg-pair-column').first().getByRole('button').nth(i)).toBeDisabled()}
      }else if(q.game_type==='multi'){
        for(const i of q.correct_indices)await page.getByRole('checkbox').nth(order.indexOf(i)).click()
        await page.getByRole('button',{name:'Comprobar',exact:true}).click()
      }else{let choice=order.indexOf(q.correct_index);if(wrong)choice=(choice+1)%q.options.length;await page.getByRole('radio').nth(choice).click()}
    }
    await page.getByRole('region',{name:'Explicación de la respuesta'}).waitFor()
    return s
  }
  async function finishCurrent(page,actor){
    await page.locator('.sg-question-heading').waitFor()
    const id=new URL(page.url()).pathname.split('/').pop()
    for(let i=0;i<25;i++){
      const s=await szRpc(db,actor,'session',{id});if(!s.answer)await answerCurrent(page,actor)
      const after=await szRpc(db,actor,'session',{id})
      if(after.status==='completed'){await page.getByRole('button',{name:'Ver mi resultado',exact:true}).click();break}
      await page.locator('.sg-game-footer').getByRole('button',{name:/^(Continuar|Entendido)$/}).click()
      await expect(page.locator('.sg-question-heading')).not.toHaveText(s.question.prompt)
    }
    await page.locator('.sg-result-heading').waitFor()
  }
  async function backToMap(page){
    await page.locator('.sg-result-actions').getByRole('button',{name:/^(Continuar|Volver al camino)$/}).click()
    if(await page.locator('.sg-result-streak').count()){
      await page.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-streak-result.png`})
      await page.getByRole('button',{name:'Volver al camino',exact:true}).click()
    }
    await page.locator('.sg-map').waitFor()
  }
  if(process.argv.includes('--language-exercises-only')){
    await db.exec(await readFile('supabase/suizamente_revision_completa.sql','utf8'))
    const bank=JSON.parse(await readFile('supabase/seed-data/suizamente-language-exercises.json','utf8'))
    const player=await contextFor(SZ_ALICE),page=player.page
    for(const task of ['choose_word','meaning','complete_sentence','order_sentence','match_words']){
      const q=bank.find(q=>q.language_task===task)
      const session=await szRpc(db,SZ_ALICE,'start',{mode:'practice',category:'idioma'})
      const v=(await db.query('SELECT v.id FROM suizamente_private.questions q JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version WHERE q.id=$1',[q.id])).rows[0]
      await db.query("UPDATE suizamente_private.sessions SET version_ids=ARRAY[$2::bigint],position=0,option_orders=jsonb_build_object($2::text,$3::jsonb) WHERE id=$1",[session.id,v.id,JSON.stringify(q.options.map((_,i)=>q.options.length-1-i))])
      await visit(page,`/suizamente/partida/${session.id}`)
      await expect(page.locator('.sg-question-heading')).toHaveText(q.prompt)
      await expect(page.getByRole('textbox',{name:'Tu respuesta',exact:true})).toHaveCount(0)
      for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});await fits(page,`language exercise ${task} ${width}`)}
      await page.setViewportSize({width:390,height:844})
      await page.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-exercise-${task}.png`})
      await finishCurrent(page,SZ_ALICE)
    }
    await player.close()
    console.log('Browser: five new language task families, 320/390/1280 layouts, shuffled answers, zero typing, feedback and results passed.')
  }else if(process.argv.includes('--languages-only')||process.argv.includes('--summit-languages-only')){
    const {finishGame}=await import('./test-suizamente-game.mjs')
    await db.exec(await readFile('supabase/suizamente_revision_completa.sql','utf8'))
    await finishGame(db,SZ_ALICE,await szRpc(db,SZ_ALICE,'game_start'))
    const summitLanguage=process.argv.includes('--summit-languages-only')
    if(summitLanguage){
      const mountains=JSON.parse(await readFile('src/data/suizamenteMountains.json','utf8'))
      for(let node=0;node<mountains[2].st.length;node++)await finishGame(db,SZ_ALICE,await szRpc(db,SZ_ALICE,'game_start',{node}))
    }
    let session=await szRpc(db,SZ_ALICE,'game_start',{node:summitLanguage?8:0})
    const player=await contextFor(SZ_ALICE),page=player.page
    await visit(page,`/suizamente/partida/${session.id}`)
    while(session.question.category!=='idioma'){
      await answerCurrent(page,SZ_ALICE)
      await page.locator('.sg-game-footer').getByRole('button',{name:/^(Continuar|Entendido)$/}).click()
      await expect(page.locator('.sg-question-heading')).not.toHaveText(session.question.prompt)
      session=await szRpc(db,SZ_ALICE,'session',{id:session.id})
    }
    await expect(page.locator('.sg-topic-label')).toHaveText(/Idiomas/)
    await expect(page.getByRole('textbox',{name:'Tu respuesta',exact:true})).toHaveCount(0)
    for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});await fits(page,`language ${width}`)}
    await page.setViewportSize({width:390,height:844})
    await page.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-language-${summitLanguage?'summit':'stage'}.png`})
    if(summitLanguage){
      await answerCurrent(page,SZ_ALICE)
      await expect(page.locator('.sg-feedback-xp')).toHaveText('Acierto del test · sin XP adicional')
    }
    await finishCurrent(page,SZ_ALICE)
    await expect(page.locator('.sg-result-heading')).toBeVisible()
    await player.close()
    console.log('Browser: real in-stage language exercise, responsive layout, no typing, grading, feedback and result passed.')
  }else if(process.argv.includes('--trivia-only')||process.argv.includes('--review-only')){
    const {loadContentPack,publicationSql}=await import('./lib/suizamente-content-pack.mjs')
    const {finishGame}=await import('./test-suizamente-game.mjs')
    const pack=await loadContentPack()
    if(process.argv.includes('--review-only'))await db.exec(await readFile('supabase/suizamente_revision_completa.sql','utf8'))
    else{
      await db.exec(publicationSql(pack.questions,pack.legacy))
      await db.exec(await readFile('supabase/suizamente_actualizacion_trivial_13.sql','utf8'))
      await db.exec(await readFile('supabase/suizamente_trivia_preguntas_13.sql','utf8'))
    }
    await finishGame(db,SZ_ALICE,await szRpc(db,SZ_ALICE,'game_start'))
    let session=await szRpc(db,SZ_ALICE,'game_start',{node:0})
    assert.equal(session.question.type,'image')
    if(process.argv.includes('--review-only')){
      const code=(await db.query("SELECT v.id FROM suizamente_private.questions q JOIN suizamente_private.versions v ON v.question_id=q.id AND v.version=q.current_version WHERE q.id='szr-canton-code-zh'")).rows[0]
      await db.query("UPDATE suizamente_private.sessions SET version_ids[1]=$2::bigint,option_orders=option_orders||jsonb_build_object($2::text,'[2,0,3,1]'::jsonb) WHERE id=$1",[session.id,code.id])
      session=await szRpc(db,SZ_ALICE,'session',{id:session.id})
    }
    const player=await contextFor(SZ_ALICE),page=player.page
    await visit(page,'/suizamente')
    await expect(page.getByRole('heading',{name:'Rigi: Suiza te sorprende'})).toBeVisible()
    await page.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-trivia-trail.png`})
    await visit(page,`/suizamente/partida/${session.id}`)
    await expect(page.locator('.sg-question-heading')).toBeVisible()
    await expect(page.locator('.sg-topic-label')).not.toHaveText(/Trámites|Trabajo|Salud y seguros/)
    for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});await fits(page,`real trivia ${width}`)}
    await page.setViewportSize({width:390,height:844})
    await page.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-trivia-real-image.png`})
    if(process.argv.includes('--review-only'))await page.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-review-code-card.png`})
    await finishCurrent(page,SZ_ALICE)
    await expect(page.locator('.sg-result-heading')).toBeVisible()
    await page.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-trivia-real-result.png`})
    await player.close()
    console.log('Browser: real cultural selector, image first, short headings, six-question round, feedback and result passed.')
  }else{
  if(!process.argv.includes('--admin-only')&&!process.argv.includes('--formats-only')){
  const guest=await contextFor(null),g=guest.page
  await visit(g,'/suizamente');await expect(g.getByRole('heading',{name:'Uetliberg: Empieza a descubrir'})).toBeVisible()
  await expect(g.getByRole('navigation',{name:'Navegación de Suizamente'}).getByRole('link')).toHaveCount(4)
  await expect(g.getByRole('navigation',{name:'Navegación principal'})).toHaveCount(0)
  for(const width of [320,390,1280]){
    await g.setViewportSize({width,height:900});await fits(g,`map ${width}`)
    await expect(g.locator('.sg-map-foot,.sg-map-tools')).toHaveCount(0)
    await expect(g.getByText('El nuevo sendero se está preparando.',{exact:false})).toHaveCount(0)
    assert.ok(await g.locator('.sg-mountain-title h1').evaluate(el=>{const s=getComputedStyle(el);return s.whiteSpace==='nowrap'&&s.textOverflow==='ellipsis'&&el.clientHeight<=parseFloat(s.lineHeight)+1}),`Mountain title remains on one line at ${width}`)
    await g.locator('.sg-map-viewport').evaluate(el=>{el.scrollTop=el.scrollHeight})
    const edge=await g.evaluate(()=>({landscape:document.querySelector('.sg-map').getBoundingClientRect().bottom,nav:document.querySelector('.sg-nav').getBoundingClientRect().top}))
    assert.ok(Math.abs(edge.landscape-edge.nav)<=2,`Landscape reaches the bottom navigation at ${width}`)
    await g.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-trail-${width}.png`})
  }
  await g.setViewportSize({width:390,height:844})
  assert.equal(landscapePhase(new Date('2026-11-13T06:15:00Z')),'amanecer')
  assert.equal(landscapePhase(new Date('2026-11-13T12:00:00Z')),'dia')
  assert.equal(landscapePhase(new Date('2026-11-13T15:30:00Z')),'atardecer')
  assert.equal(landscapePhase(new Date('2026-11-13T20:00:00Z')),'noche')
  const mountainData=JSON.parse(await readFile('src/data/suizamenteMountains.json','utf8'))
  for(let level=1;level<=5;level++)for(const phase of ['amanecer','dia','atardecer','noche']){
    const svg=land(level,geo(level,mountainData[level].st.length),{phase,reducedMotion:true})
    const validation=await g.evaluate(svg=>{
      const doc=new DOMParser().parseFromString(svg,'image/svg+xml'),ids=[...doc.querySelectorAll('[id]')].map(e=>e.id)
      const refs=[...svg.matchAll(/url\(#([^)]+)\)/g)].map(m=>m[1])
      return {parserError:doc.querySelector('parsererror')?.textContent||null,duplicates:ids.length!==new Set(ids).size,missing:refs.filter(id=>!ids.includes(id)),invalidNumber:/NaN|Infinity/.test(svg)}
    },svg)
    assert.deepEqual(validation,{parserError:null,duplicates:false,missing:[],invalidNumber:false},`Valid SVG for ${level}/${phase}`)
  }
  console.log('Browser: all five supplied landscapes render valid SVG in four Zurich lighting phases.')
  await g.getByRole('button',{name:/Llegada a Uetliberg, tu siguiente/}).click()
  await expect(g.getByRole('dialog')).toHaveAttribute('aria-modal','false')
  await g.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-arrival-card.png`})
  await g.getByRole('button',{name:'Probar demostración',exact:true}).click()
  await expect(g.locator('.sg-question-heading')).toBeVisible()
  assert.equal(await g.locator('.sg-question-heading').evaluate(el=>getComputedStyle(el).textAlign),'center')
  await expect(g.locator('.sg-question-bubble')).toHaveCount(0)
  await expect(g.locator('.sg-question-context>.sz-mark')).toBeVisible()
  await expect(g.locator('.sg-question-heading')).toHaveText('¿Dónde está el Rigi?')
  await expect(g.locator('.sg-topic-label')).toContainText('Lugares')
  await g.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-trivia-rigi.png`})
  await g.keyboard.press('2');await expect(g.getByRole('heading',{name:'Incorrecto',exact:true})).toBeVisible()
  await g.reload();await expect(g.locator('.sg-game-footer.wrong')).toBeVisible()
  await g.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-question-feedback.png`})
  for(const width of [320,390,1280]){
    await g.setViewportSize({width,height:640})
    const button=g.locator('.sg-game-footer').getByRole('button',{name:'Entendido',exact:true})
    const box=await button.boundingBox()
    assert.ok(box.y>=0&&box.y+box.height<=640,`Feedback action stays visible at ${width}x640`)
    await fits(g,`feedback ${width}`)
  }
  await g.setViewportSize({width:390,height:844})
  await g.getByRole('button',{name:'Entendido',exact:true}).click()
  for(let i=1;i<6;i++){
    const q=ARCADE_DEMO[i]
    if(q.game_type==='image'){
      await g.emulateMedia({reducedMotion:'no-preference'})
      await g.reload();await g.locator('.sg-question-heading').waitFor()
      const mask=g.locator('canvas.sg-image-tiles')
      await expect(mask).toBeVisible()
      const coverage=()=>mask.evaluate(canvas=>{
        const {width,height}=canvas,data=canvas.getContext('2d').getImageData(0,0,width,height).data
        let covered=0
        for(let i=3;i<data.length;i+=4)if(data[i])covered++
        return covered/(width*height)
      })
      const initialCoverage=await coverage()
      assert.ok(initialCoverage>.8,'The image starts mostly covered')
      await expect.poll(coverage).toBeLessThan(initialCoverage-.06)
      assert.ok(await coverage()>.5,'Fine reveal remains gradual instead of exposing large blocks at once')
      assert.ok(await mask.evaluate(canvas=>{
        const {width,height}=canvas,data=canvas.getContext('2d').getImageData(0,0,width,height).data
        // At the test context’s 1x density, every 5 x 5 block has uniform alpha.
        for(let y=0;y+5<=height;y+=5)for(let x=0;x+5<=width;x+=5){
          const alpha=data[(y*width+x)*4+3]
          for(let dy=0;dy<5;dy++)for(let dx=0;dx<5;dx++)if(data[((y+dy)*width+x+dx)*4+3]!==alpha)return false
        }
        return true
      }),'The visible mask uses actual 5 x 5 pixel squares')
      await g.getByRole('button',{name:'Ver imagen completa',exact:true}).click()
      await g.waitForTimeout(2400)
      await expect(g.locator('.sg-image-tiles')).toHaveCount(0)
      // A reveal never closes answer choices or imposes a deadline.
      await expect(g.getByRole('radio')).toHaveCount(4)
      await g.reload();await g.locator('.sg-question-heading').waitFor()
      await expect(g.locator('.sg-image-tiles')).toHaveCount(1)
      await expect(g.locator('.sg-image-tiles')).toHaveCount(0,{timeout:25000})
      await g.reload();await g.locator('.sg-question-heading').waitFor()
      await expect(g.locator('.sg-image-tiles')).toHaveCount(1)
      await g.emulateMedia({reducedMotion:'reduce'})
      await expect(g.locator('.sg-image-tiles')).toHaveCount(0)
    }
    await g.setViewportSize({width:320,height:640})
    await g.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    await fits(g,`compact ${q.game_type}`)
    assert.ok(await g.locator('.sg-option').evaluateAll(buttons=>buttons.every(b=>parseFloat(getComputedStyle(b).fontSize)>=12&&b.getBoundingClientRect().height>=43.5)),'Readable text and touch targets in compact layout')
    await g.setViewportSize({width:390,height:844})
    await g.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-question-${q.game_type}.png`})
    if(q.game_type==='multi'){for(const j of q.correct_indices)await g.getByRole('checkbox').nth(j).click();await expect(g.locator('.sg-feedback')).toHaveCount(0);await g.getByRole('button',{name:'Comprobar',exact:true}).click()}
    else if(q.game_type==='match'){
      await g.locator('.sg-pair-column').first().getByRole('button').first().click();await g.locator('.sg-pair-column').last().getByRole('button').first().click()
      await expect(g.locator('.sg-pair-grid .sg-option.wrong')).toHaveCount(2)
      await expect(g.locator('.sg-pair-grid .sg-option.wrong')).toHaveCount(0)
      for(let j=0;j<4;j++){await g.locator('.sg-pair-column').first().getByRole('button').nth(j).click();await g.locator('.sg-pair-column').last().getByRole('button').nth([2,0,3,1].indexOf(j)).click();await expect(g.locator('.sg-pair-column').first().getByRole('button').nth(j)).toBeDisabled()}}
    else await g.getByRole('radio').nth(q.correct_index).click()
    await expect(g.getByRole('region',{name:'Explicación de la respuesta'})).toBeVisible()
    await fits(g,`demo type ${q.game_type}`)
    if(i===5)await g.getByRole('button',{name:'Ver mi resultado',exact:true}).click();else await g.getByRole('button',{name:'Continuar',exact:true}).click()
  }
  await expect(g.getByRole('heading',{name:'¡Ya conoces el juego!'})).toBeVisible()
  assert.equal((await db.query('SELECT count(*)::integer n FROM suizamente_private.answers')).rows[0].n,0)
  const invalidArt=await g.evaluate(art=>art.filter(([key,svg])=>{const doc=new DOMParser().parseFromString(svg,'image/svg+xml');return doc.querySelector('parsererror')||!doc.documentElement.getAttribute('aria-label')||doc.querySelector('script,foreignObject')}),Object.entries(IMG).map(([key,render])=>[key,render(`test-${key}`)]))
  assert.deepEqual(invalidArt,[],'All question illustrations must be valid, described SVG without scripts')
  await guest.close()
  console.log('Browser: supplied trail layout at 320/390/1280, all six question types, immediate answers and guest persistence passed.')

  const alice=await contextFor(SZ_ALICE),page=alice.page
  await visit(page,'/suizamente')
  await expect(page.getByRole('heading',{name:'Rigi: Suiza te sorprende'})).toBeVisible()
  await page.getByRole('button',{name:/Preguntas: Suiza general y Zürich/}).click()
  const sources=page.getByRole('dialog',{name:'¿De dónde quieres preguntas?',exact:true}),general=sources.getByRole('switch',{name:'Preguntas de Suiza general',exact:true}),local=sources.getByRole('switch',{name:'Preguntas de un cantón',exact:true})
  await expect(general).toHaveAttribute('aria-checked','true');await expect(local).toHaveAttribute('aria-checked','true')
  await expect(sources.getByRole('combobox',{name:'Cantón',exact:true})).toHaveValue('ZH')
  await expect(sources.getByRole('combobox').getByRole('option')).toHaveCount(27)
  await general.click();await local.click();await expect(sources.getByRole('button',{name:'Guardar preferencias',exact:true})).toBeDisabled()
  await general.click();await local.click();await sources.getByRole('combobox').selectOption('GE');await sources.getByRole('button',{name:'Guardar preferencias',exact:true}).click()
  await expect(page.getByRole('button',{name:/Preguntas: Suiza general y Genève/})).toBeVisible()
  await page.getByRole('button',{name:/Preguntas: Suiza general y Genève/}).click();await sources.getByRole('combobox').selectOption('ZH');await sources.getByRole('button',{name:'Guardar preferencias',exact:true}).click()
  // Closing the preferences sheet rewinds its history entry asynchronously.
  // Wait for that observable close before opening another overlay in WebKit.
  await expect(sources).toHaveCount(0)
  await page.waitForFunction(()=>!window.history.state?.__latidoOverlay)
  await expect(page.getByRole('button',{name:/Preguntas: Suiza general y Zürich/})).toBeVisible()
  await page.getByRole('button',{name:/Llegada a Rigi, tu siguiente/}).click();await page.getByRole('button',{name:'Empezar',exact:true}).click();await finishCurrent(page,SZ_ALICE);await backToMap(page)
  await page.getByRole('button',{name:/Etapa 1: Por los cantones, tu siguiente/}).click();await page.getByRole('button',{name:'Empezar',exact:true}).click()
  failNextAnswer=true
  await page.getByRole('button',{name:'No lo sé',exact:true}).click();await expect(page.getByRole('alert')).toContainText('No se ha podido completar')
  await page.getByRole('button',{name:'Recuperar mi partida',exact:true}).click();await page.locator('.sg-question-heading').waitFor()
  await page.getByRole('button',{name:'No lo sé',exact:true}).click();await expect(page.locator('.sg-game-footer.skipped')).toBeVisible()
  const sid=new URL(page.url()).pathname.split('/').pop()
  await page.getByRole('button',{name:'Salir de la partida',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Tab');assert.ok(await page.getByRole('dialog').evaluate(el=>el.contains(document.activeElement)))
  await page.getByRole('button',{name:'Salir y continuar después',exact:true}).click();await page.getByRole('button',{name:/Etapa 1: Por los cantones, tu siguiente/}).click();await page.getByRole('button',{name:'Continuar mi etapa',exact:true}).click()
  await expect(page).toHaveURL(new RegExp(`/suizamente/partida/${sid}$`));await expect(page.locator('.sg-game-footer.skipped')).toBeVisible()
  await finishCurrent(page,SZ_ALICE);await page.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-stage-result.png`});await backToMap(page)
  await page.getByRole('link',{name:'Progreso',exact:true}).click();await expect(page.getByRole('heading',{name:'Tu Suizómetro'})).toBeVisible();await expect(page.getByText('7 / 51',{exact:true})).toBeVisible()
  await page.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-knowledge.png`})
  await page.getByRole('button',{name:/Mochila:/}).click();await expect(page.getByRole('dialog',{name:'🎒 Tu mochila',exact:true})).toBeVisible();await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Suiza general',exact:true}).click();await page.getByRole('combobox',{name:'Dificultad',exact:true}).selectOption('2')
  await page.getByRole('button',{name:'Practicar idiomas →',exact:true}).click();await finishCurrent(page,SZ_ALICE)
  await visit(page,'/suizamente/reto');await page.getByRole('button',{name:'Jugar el reto semanal',exact:true}).click();await finishCurrent(page,SZ_ALICE)
  await page.getByRole('link',{name:'Ver clasificación y privacidad',exact:true}).click()
  await expect(page.getByText('Tu resultado es privado',{exact:true})).toBeVisible()
  await page.getByRole('switch',{name:'Aparecer en la clasificación',exact:true}).click();await expect(page.locator('.sz-leaderboard')).toContainText('AnaZH')
  await page.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-weekly-ranking.png`})
  await page.getByRole('switch',{name:'Aparecer en la clasificación',exact:true}).click();await expect(page.locator('.sz-leaderboard')).toHaveCount(0)
  console.log('Browser: own-canton defaults, source validation, persisted stages, network recovery, skip/resume, inventory, statistics and private weekly ranking passed.')
  await page.getByRole('link',{name:'Inicio de Latido',exact:true}).click()
  await expect(page.getByRole('region',{name:'Suizamente',exact:true})).toBeVisible({timeout:20000});await expect(page.getByRole('navigation',{name:'Navegación de Suizamente'})).toHaveCount(0)
  await expect(page.locator('.bottom-nav')).toHaveCount(1)
  await page.getByRole('button',{name:'Jugar la etapa de hoy',exact:true}).count().then(async n=>{if(!n)await expect(page.getByRole('button',{name:'Seguir subiendo',exact:true})).toBeVisible()})
  await page.getByRole('link',{name:'Ver mi camino →',exact:true}).click();await page.getByRole('button',{name:'Matterhorn, aún bloqueada',exact:true}).click();await expect(page.getByRole('heading',{name:'Matterhorn: El gran trivial suizo'})).toBeVisible()
  await fits(page,'locked mountain preview');await page.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-matterhorn.png`})
  await alice.close()
  const bob=await contextFor(SZ_BOB,{cooperator:true});await visit(bob.page,'/suizamente');await bob.page.getByRole('button',{name:/Preguntas: Suiza general y Bern/}).click();await expect(bob.page.getByRole('combobox',{name:'Cantón',exact:true})).toHaveValue('BE');await bob.page.keyboard.press('Escape')
  const german=await szRpc(db,SZ_BOB,'start',{mode:'practice',category:'idioma'})
  await visit(bob.page,`/suizamente/partida/${german.id}`);await bob.page.locator('.sg-question-heading').waitFor()
  await expect(bob.page.locator('.sg-word,.sg-words')).toHaveCount(0)
  await answerCurrent(bob.page,SZ_BOB);await expect(bob.page.getByRole('region',{name:'Explicación de la respuesta'})).toBeVisible()
  // Local UI fixture: the rule/XP earning path for every mountain is exercised
  // separately by test-suizamente-game.mjs. No remote account is changed here.
  await db.query("UPDATE suizamente_private.players SET level=2,xp=400,inventory='{\"x2\":0,\"life\":1,\"freeze\":0}' WHERE user_id=$1",[SZ_BOB])
  await db.query('INSERT INTO suizamente_private.trail_nodes(user_id,level,node) SELECT $1,2,n FROM generate_series(-1,7) n ON CONFLICT DO NOTHING',[SZ_BOB])
  const summit=await szRpc(db,SZ_BOB,'game_start',{level:2,node:8})
  await visit(bob.page,`/suizamente/partida/${summit.id}`);await expect(bob.page.locator('.sg-life-dots i')).toHaveCount(4);await expect(bob.page.locator('.sg-life-dots .extra')).toHaveCount(1)
  for(let i=0;i<5;i++){
    await bob.page.getByRole('button',{name:'No lo sé',exact:true}).click()
    if(i===4)await bob.page.getByRole('button',{name:'Ver mi resultado',exact:true}).click()
    else await bob.page.locator('.sg-game-footer').getByRole('button',{name:'Continuar',exact:true}).click()
  }
  await expect(bob.page.getByRole('heading',{name:'Test no superado',exact:true})).toBeVisible()
  await expect(bob.page.locator('.sg-result-notice')).toContainText('desde las 00:00 del día siguiente, hora de Suiza')
  await bob.page.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-summit-failed.png`})
  assert.equal((await szRpc(db,SZ_BOB,'summary')).player.xp,400)
  // Move only the local fixture's attempt to yesterday, then exercise promotion.
  await db.query('UPDATE suizamente_private.sessions SET day_key=day_key-1 WHERE id=$1',[summit.id])
  const retry=await szRpc(db,SZ_BOB,'game_start',{level:2,node:8})
  await visit(bob.page,`/suizamente/partida/${retry.id}`);await finishCurrent(bob.page,SZ_BOB)
  await expect(bob.page.getByRole('heading',{name:'¡Has llegado a Pilatus!',exact:true})).toBeVisible()
  await expect(bob.page.locator('.sg-new-mountain')).toContainText('10 etapas')
  await bob.page.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-summit-passed.png`})
  await bob.page.locator('.sg-result-actions').getByRole('button',{name:'Ver el sendero de Pilatus',exact:true}).click()
  await expect(bob.page.getByRole('heading',{name:'Pilatus: Afina la mirada',exact:true})).toBeVisible()
  await bob.close()
  }
  if(!process.argv.includes('--admin-only')){
    const content=JSON.parse(await readFile('supabase/seed-data/suizamente-expansion/questions.json','utf8'))
    const newFormats=[content.find(q=>q.game_type==='order'),content.find(q=>q.game_type==='short')]
    const player=await contextFor(SZ_ALICE),page=player.page
    for(const q of newFormats){
      await db.query('SELECT suizamente_private.write_question($1::jsonb)',[JSON.stringify({...q,status:'published'})])
      const version=(await db.query('SELECT id FROM suizamente_private.versions WHERE question_id=$1 ORDER BY version DESC LIMIT 1',[q.id])).rows[0].id
      const s=await szRpc(db,SZ_ALICE,'start',{mode:'practice'})
      const order=q.options.map((_,i)=>q.options.length-1-i)
      await db.query("UPDATE suizamente_private.sessions SET version_ids=ARRAY[$2::bigint],position=0,option_orders=jsonb_build_object($2::text,$3::jsonb),rules=rules||'{\"node\":-2,\"practice\":true,\"gift\":null,\"gift_at\":-1}'::jsonb WHERE id=$1",[s.id,version,JSON.stringify(order)])
      await visit(page,`/suizamente/partida/${s.id}`)
      await expect(page.locator('.sg-question-heading')).toBeVisible({timeout:20000})
      const check=page.getByRole('button',{name:'Comprobar',exact:true})
      await expect(check).toBeDisabled()
      for(const width of [320,390]){await page.setViewportSize({width,height:844});await fits(page,`${q.game_type} ${width}`)}
      if(q.game_type==='order'){
        for(const index of q.correct_order)await page.locator('.sg-order-bank').getByRole('button',{name:q.options[index],exact:true}).click()
        await expect(check).toBeEnabled()
        await page.locator('.sg-order-selection button').last().click()
        await expect(check).toBeDisabled()
        await page.locator('.sg-order-bank').getByRole('button',{name:q.options[q.correct_order.at(-1)],exact:true}).click()
      }else await page.getByRole('textbox',{name:'Tu respuesta',exact:true}).fill(q.accepted_answers[0].toLowerCase())
      await page.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-${q.game_type}-question.png`})
      await check.click();await expect(page.getByRole('heading',{name:'¡Correcto!',exact:true})).toBeVisible()
      assert.equal((await szRpc(db,SZ_ALICE,'session',{id:s.id})).answer.correct,true)
      await page.getByRole('button',{name:'Ver mi resultado',exact:true}).click()
      await expect(page.getByRole('heading',{name:'¡Práctica completada!',exact:true})).toBeVisible()
    }
    // The server shuffles options; symbols must follow labels before and after grading.
    const tf=(await db.query("SELECT id,payload FROM suizamente_private.versions WHERE question_id='game-10-v1' ORDER BY version DESC LIMIT 1")).rows[0]
    for(const order of [[1,0],[0,1]]){
      const s=await szRpc(db,SZ_ALICE,'start',{mode:'practice'})
      await db.query("UPDATE suizamente_private.sessions SET version_ids=ARRAY[$2::bigint],position=0,option_orders=jsonb_build_object($2::text,$3::jsonb),rules=rules||'{\"node\":-2,\"practice\":true,\"gift\":null,\"gift_at\":-1}'::jsonb WHERE id=$1",[s.id,tf.id,JSON.stringify(order)])
      await visit(page,`/suizamente/partida/${s.id}`)
      const trueOption=page.getByRole('radio',{name:'Verdadero',exact:true}),falseOption=page.getByRole('radio',{name:'Falso',exact:true})
      await expect(trueOption).toBeVisible({timeout:20000})
      await expect(trueOption.locator('i')).toHaveText('✓')
      await expect(falseOption.locator('i')).toHaveText('×')
      await trueOption.click()
      await expect(page.getByRole('heading',{name:'¡Correcto!',exact:true})).toBeVisible()
      await expect(trueOption.locator('i')).toHaveText('✓')
      await expect(falseOption.locator('i')).toHaveText('×')
      await page.getByRole('button',{name:'Ver mi resultado',exact:true}).click()
      await expect(page.getByRole('heading',{name:'¡Práctica completada!',exact:true})).toBeVisible()
    }
    console.log('Browser: true/false symbols follow labels in both shuffled orders, before and after answering.')
    await player.close()
    console.log('Browser: ordering without typing, removable blocks, short-answer input, mobile widths and server feedback passed.')
  }
  const admin=await contextFor(SZ_ADMIN),editorPage=admin.page
  await visit(editorPage,'/admin-latido?section=suizamente')
  await editorPage.getByPlaceholder('Buscar pregunta o identificador').fill('game-14-v1')
  await editorPage.getByRole('button',{name:/^Editar:/}).click()
  const questionDialog=editorPage.getByRole('dialog')
  await expect(questionDialog.getByRole('combobox',{name:'Tipo de pregunta',exact:true})).toHaveValue('multi')
  await expect(questionDialog.getByRole('checkbox').filter({visible:true})).toHaveCount(5)
  await questionDialog.getByRole('button',{name:'Previsualizar',exact:true}).click()
  await expect(questionDialog.locator('.sz-option.is-correct')).toHaveCount(4)
  await questionDialog.getByRole('button',{name:'Volver a editar',exact:true}).click()
  const explanation=questionDialog.getByRole('textbox',{name:'Explicación',exact:true})
  await explanation.fill((await explanation.inputValue())+' Editada en pruebas locales.')
  await questionDialog.getByRole('button',{name:'Guardar pregunta',exact:true}).click()
  await expect(questionDialog).toHaveCount(0)
  assert.equal((await db.query("SELECT current_version FROM suizamente_private.questions WHERE id='game-14-v1'")).rows[0].current_version,2)
  if(!process.argv.includes('--admin-only')){
    const content=JSON.parse(await readFile('supabase/seed-data/suizamente-expansion/questions.json','utf8'))
    for(const kind of ['order','short']){
      const q=content.find(q=>q.game_type===kind)
      await editorPage.getByPlaceholder('Buscar pregunta o identificador').fill(q.id)
      await editorPage.getByRole('button',{name:/^Editar:/}).click()
      const dialog=editorPage.getByRole('dialog')
      await expect(dialog.getByRole('combobox',{name:'Tipo de pregunta',exact:true})).toHaveValue(kind)
      if(kind==='order')await expect(dialog.getByRole('combobox',{name:'Posición 1',exact:true})).toHaveValue(String(q.correct_order[0]))
      else await expect(dialog.getByRole('textbox',{name:'Respuestas aceptadas (una por línea)',exact:true})).toHaveValue(q.accepted_answers.join('\n'))
      await dialog.getByRole('button',{name:'Previsualizar',exact:true}).click()
      await expect(dialog.locator('.sz-option.is-correct')).toHaveText(kind==='order'?q.correct_order.map(i=>q.options[i]).join(' → '):q.accepted_answers.join(' / '))
      await dialog.getByRole('button',{name:'Volver a editar',exact:true}).click()
      await dialog.getByRole('button',{name:'Guardar pregunta',exact:true}).click()
      await expect(dialog).toHaveCount(0)
    }
    console.log('Browser: order/short editor fields, solution previews and save validation passed.')
  }
  await editorPage.getByPlaceholder('Buscar pregunta o identificador').fill('game-tf-2-4')
  await editorPage.getByRole('button',{name:/^Editar:/}).click()
  const statementDialog=editorPage.getByRole('dialog')
  await expect(statementDialog.getByRole('textbox',{name:'Afirmación',exact:true})).toHaveValue('Liechtenstein comparte frontera con Suiza.')
  await statementDialog.getByRole('textbox',{name:'Afirmación',exact:true}).fill('¿Suiza tiene 26 cantones?')
  await statementDialog.getByRole('button',{name:'Guardar pregunta',exact:true}).click()
  await expect(statementDialog.getByText('Escribe una afirmación para verdadero o falso, sin pregunta ni respuesta propuesta.',{exact:true})).toBeVisible()
  await editorPage.keyboard.press('Escape');await expect(statementDialog).toHaveCount(0)
  await admin.close()
  // The two reported cases: direct true/false wording and long housing pairs.
  const editorial=JSON.parse(await readFile('supabase/seed-data/suizamente-expansion/questions.json','utf8'))
  const housing=editorial.find(q=>q.game_type==='match'&&q.options.includes('Arrendador'))
  await db.query('SELECT suizamente_private.write_question($1::jsonb)',[JSON.stringify({...housing,status:'published'})])
  const pinned=await szRpc(db,SZ_ADMIN,'game_start')
  const versions=(await db.query('SELECT id,question_id FROM suizamente_private.versions WHERE question_id=ANY($1::text[]) ORDER BY id',[['game-tf-2-4',housing.id,'game-tf-3-4']])).rows
  const tfVersion=versions.find(v=>v.question_id==='game-tf-2-4').id,pairVersion=versions.find(v=>v.question_id===housing.id).id,lastVersion=versions.find(v=>v.question_id==='game-tf-3-4').id,pairOrder=[2,0,3,1]
  await db.query(`UPDATE suizamente_private.sessions SET version_ids=$2::bigint[],position=0,status='active',completed_at=NULL,option_orders=$3::jsonb,rules=rules||'{"node":-2,"practice":true,"gift":null,"gift_at":-1}'::jsonb WHERE id=$1`,[pinned.id,[tfVersion,pairVersion,lastVersion],JSON.stringify({[tfVersion]:[1,0],[pairVersion]:pairOrder,[lastVersion]:[1,0]})])
  const experience=await contextFor(SZ_ADMIN),xp=experience.page
  legacyTrueFalse=true
  await visit(xp,`/suizamente/partida/${pinned.id}`)
  await expect(xp.locator('.sg-question-heading')).toHaveText('Liechtenstein comparte frontera con Suiza.')
  await expect(xp.locator('.sg-topic-label')).toContainText('Suiza y cultura')
  await expect(xp.getByText('Respuesta propuesta',{exact:false})).toHaveCount(0)
  await xp.reload()
  await expect(xp.locator('.sg-question-heading')).toHaveText('Liechtenstein comparte frontera con Suiza.')
  await xp.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-legacy-true-false-statement.png`})
  await xp.getByRole('radio',{name:'Verdadero',exact:true}).click()
  await expect(xp.getByRole('heading',{name:'¡Correcto!',exact:true})).toBeVisible()
  await xp.getByRole('button',{name:'Continuar',exact:true}).click()
  await expect(xp.locator('.sg-pair-grid')).toBeVisible()
  for(const width of [320,390,1280]){
    await xp.setViewportSize({width,height:640})
    await xp.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    const rows=await xp.locator('.sg-pair-column').evaluateAll(columns=>Array.from({length:4},(_,i)=>columns.map(col=>{const r=col.children[i].getBoundingClientRect();return {top:r.top,bottom:r.bottom}})))
    assert.ok(rows.every(([left,right])=>Math.abs(left.top-right.top)<1&&Math.abs(left.bottom-right.bottom)<1),'Long pairs remain aligned in both columns')
    await fits(xp,`trivia housing ${width}`)
  }
  for(const right of [0,2]){
    await xp.locator('.sg-pair-column').first().getByRole('button').first().click()
    await xp.locator('.sg-pair-column').last().getByRole('button').nth(right).click()
    await expect(xp.getByText('No encajan. Prueba otra pareja.',{exact:true})).toBeVisible()
    await expect(xp.locator('.sg-pair-grid .sg-option.wrong')).toHaveCount(0)
  }
  for(let i=0;i<4;i++){
    await xp.locator('.sg-pair-column').first().getByRole('button').nth(i).click()
    await xp.locator('.sg-pair-column').last().getByRole('button').nth(pairOrder.indexOf(i)).click()
    await expect(xp.locator('.sg-pair-column').first().getByRole('button').nth(i)).toBeDisabled()
  }
  await expect(xp.getByRole('heading',{name:'Vamos a repasarlas',exact:true})).toBeVisible()
  await expect(xp.locator('.sg-pair-recap')).toContainText('2 fallos')
  await expect(xp.locator('.sg-pair-focus .sg-answer-pairs>div')).toHaveCount(1)
  await expect(xp.locator('.sg-pair-focus dt')).toHaveText('Arrendador')
  for(let i=0;i<4;i++)await expect(xp.locator('.sg-pair-column').last().getByRole('button').nth(i)).toHaveText(housing.pairs[i])
  await xp.locator('.sg-pair-solution summary').click()
  await expect(xp.locator('.sg-pair-solution .sg-answer-pairs>div')).toHaveCount(4)
  for(let i=0;i<4;i++){
    await expect(xp.locator('.sg-pair-solution .sg-answer-pairs dt').nth(i)).toHaveText(housing.options[i])
    await expect(xp.locator('.sg-pair-solution .sg-answer-pairs dd').nth(i)).toContainText(housing.pairs[i])
  }
  for(const width of [320,390,1280]){
    await xp.setViewportSize({width,height:640})
    const action=xp.locator('.sg-game-footer').getByRole('button',{name:'Entendido',exact:true}),box=await action.boundingBox()
    assert.ok(box.y>=0&&box.y+box.height<=640,'Continue action stays visible with expanded pair corrections')
    await fits(xp,`pair correction ${width}`)
  }
  await xp.setViewportSize({width:390,height:844})
  await xp.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-pair-correction-cards.png`})
  legacyPairFeedback=true
  await xp.reload();await xp.locator('.sg-pair-solution summary').click()
  await expect(xp.locator('.sg-pair-solution .sg-answer-pairs>div')).toHaveCount(4)
  legacyPairFeedback=false
  legacyTrueFalse=false
  await experience.close()
  console.log('Browser: raw legacy true/false payloads and resumed sessions render direct statements without SQL; editor rejects interrogative prompts. Pairing corrections and continue action passed.')
  console.log('Browser: mixed-question editor, multiple-correct preview and immutable editorial versioning passed.')
  }
  assert.deepEqual(errors,[],'No uncaught browser errors')
  console.log(`Suizamente arcade: ${useWebkit?'WebKit':'Chromium'} browser checks passed.`)
}catch(error){
  const serverHealth=await fetch(origin,{signal:AbortSignal.timeout(5000)}).then(r=>r.status).catch(e=>e.message)
  console.error('Browser test server diagnostic:',{exitCode:server.exitCode,signalCode:server.signalCode,http:serverHealth,logs:logs.slice(-3000)})
  for(const [i,context] of (browser?.contexts()||[]).entries())for(const [j,page] of context.pages().entries()){
    await page.screenshot({path:`${output}/${useWebkit?'webkit':'chromium'}-failure-${i}-${j}.png`}).catch(()=>{})
    console.error('Failed page:',page.url(),await page.locator('.sg-game-footer>.sz-button').evaluateAll(els=>els.map(el=>({text:el.textContent,rect:el.getBoundingClientRect().toJSON(),parent:el.parentElement.getBoundingClientRect().toJSON()}))).catch(()=>[]))
  }
  throw error
}finally{
  await browser?.close();await db?.close();server.kill()
}
