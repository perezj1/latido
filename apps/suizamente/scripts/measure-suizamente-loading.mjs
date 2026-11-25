// Local timing with 2 s of profile delay and 1.6 s of match-list delay.
import {chromium,expect} from '@playwright/test';
import {startSuizamentePreview,testToken,testUser} from './lib/suizamente-v2-preview.mjs';
import {A} from './lib/suizamente-v2-test-db.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const preview=await startSuizamentePreview(5450,{hmr:false}),browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await ctx.addInitScript(s=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(s));sessionStorage.setItem('suizamente:apertura','1');Object.defineProperty(navigator,'standalone',{get:()=>true})},{access_token:testToken(A),refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+86400,user:testUser(A,'Alex')});
 await ctx.route('**/mock-supabase/rest/v1/profiles?*',async r=>{await new Promise(res=>setTimeout(res,2000));await r.continue()});
 await ctx.route('**/api/suizamente/partidas',async r=>{await new Promise(res=>setTimeout(res,1600));await r.continue()});
 await ctx.route('**/api/suizamente/emparejamiento',async r=>{await new Promise(res=>setTimeout(res,200));await r.continue()});
 const page=await ctx.newPage(),calls=[];page.on('request',r=>{if(r.url().includes('/api/suizamente/'))calls.push({path:new URL(r.url()).pathname,t:Date.now()-start})});let start=Date.now();await page.goto(preview.origin+'/suizamente/nueva');await page.locator('.sv-lobby').waitFor();const screenMs=Date.now()-start;await expect(page.locator('.sv-start-random small')).toHaveText('Hay alguien para jugar');const playersMs=Date.now()-start;const metrics={screenMs,playersMs,calls};await mkdir('output/carga',{recursive:true});await writeFile('output/carga/'+'actual'+'.json',JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics,null,2));
}finally{await browser.close();await preview.close()}
