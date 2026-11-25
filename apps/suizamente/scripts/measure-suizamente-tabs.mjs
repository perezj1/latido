// Real React/temporary SQL, with 700 ms per API response. No production writes.
import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs'
import {A,call} from './lib/suizamente-v2-test-db.mjs'
const preview=await startSuizamentePreview(5470,{hmr:false}),browser=await chromium.launch({headless:true}),label=process.argv[2]||'actual'
try{
 await call(preview.db,A,'regalo');await preview.db.exec('UPDATE suizamente_private.suizamente_novedades SET leida=true')
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),calls=[]
 await ctx.addInitScript(s=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(s));sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})},{access_token:testToken(A),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(A,'Alex')})
 await ctx.route('**/api/suizamente/**',async route=>{calls.push(new URL(route.request().url()).pathname);await new Promise(resolve=>setTimeout(resolve,700));await route.continue()})
 const page=await ctx.newPage(),metrics={label,delayMs:700,timings:{},calls};let start=Date.now()
 await page.goto(preview.origin+'/suizamente/nueva');await expect(page.locator('.sv-start-random small')).toHaveText('Hay alguien para jugar');metrics.timings.open=Date.now()-start
 const go=async(path,selector,key)=>{start=Date.now();await page.evaluate(path=>{history.pushState({},'',path);window.dispatchEvent(new window.PopStateEvent('popstate'))},'/suizamente'+path);await expect(page.locator(selector).first()).toBeVisible();metrics.timings[key]=Date.now()-start}
 await go('/album','.sv-album-grid','albumFirst');await go('/tienda','.sv-daily-gift','shopFirst');await go('/album','.sv-album-grid','albumReturn');await go('/tienda','.sv-daily-gift','shopReturn')
 await mkdir('output/velocidad',{recursive:true});await writeFile('output/velocidad/'+label+'.json',JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics,null,2))
}finally{await browser.close();await preview.close()}
