import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {realpathSync} from 'node:fs'
import {createSuizamenteHandler} from './server/suizamente/http.mjs'
export default defineConfig({
 appType:'spa',plugins:[react(),{
  name:'suizamente-independent-api',configureServer(server){const handler=createSuizamenteHandler();server.middlewares.use((req,res,next)=>req.url?.startsWith('/api/suizamente/')?handler(req,res):next())},
  async writeBundle(_options,bundle){
   // Cache the entry graph, not every lazy screen, during installation. This
   // avoids downloading administration and rewards beside the first home map.
   const initial=new Set(),add=name=>{if(initial.has(name))return;initial.add(name);const chunk=bundle[name];if(chunk?.type==='chunk'){chunk.imports.forEach(add);chunk.viteMetadata?.importedCss?.forEach(add)}}
   Object.values(bundle).filter(chunk=>chunk.type==='chunk'&&chunk.isEntry).forEach(chunk=>add(chunk.fileName))
   const files=['/','/index.html','/suizamente.webmanifest','/suizamente-assets/icon-180.png','/suizamente-assets/icon-192.png','/suizamente-assets/icon-512.png','/suizamente-assets/icon-maskable-512.png','/suizamente-assets/logo-suizamente.svg',...initial].map(n=>n.startsWith('/')?n:'/'+n)
   const source=await readFile(new URL('./public/sw.js',import.meta.url),'utf8')
   const id=createHash('sha256').update(files.join('\n')+'\n'+source).digest('hex').slice(0,12)
   await writeFile(new URL('./dist/sw.js',import.meta.url),source.replace('__BUILD_ID__',id).replace('/*PRECACHE*/[]',JSON.stringify([...new Set(files)])))
  }
 }],css:{postcss:{plugins:[]}},build:{outDir:'dist',emptyOutDir:true},server:{host:'127.0.0.1',port:5270,fs:{allow:[process.cwd(),realpathSync('node_modules')],deny:['.env','.env.*','**/server/suizamente/data/**','**/supabase/**']}}
})
