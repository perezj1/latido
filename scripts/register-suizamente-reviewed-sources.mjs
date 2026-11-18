// Sources whose relevant passages were read during the editorial review.
import {readFile,writeFile} from 'node:fs/promises'
const file=new URL('../supabase/seed-data/suizamente-expansion/sources.json',import.meta.url)
const sources=JSON.parse(await readFile(file,'utf8'))
const additions=[
['ch-ssv-2026','https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1979/1961_1961_1961/20261001/fr/pdf-a/fedlex-data-admin-ch-eli-cc-1979-1961_1961_1961-20261001-fr-pdf-a.pdf','OSR, état au 1er octobre 2026','Confédération suisse / Fedlex','Art. 36, art. 37 et annexe 2, signaux 3.01–3.03','Arrêt obligatoire et priorité au stop; céder le passage; route principale prioritaire. Le cas de feux en service est exclu des illustrations.'],
['ch-pet-2026','https://www.bafu.admin.ch/de/pet-getraenkeflaschen','PET-Getränkeflaschen','Bundesamt für Umwelt BAFU','Separatsammlung; PET-Milchflaschen','Les bouteilles de lait en PET portant le logo sont admises; les bouteilles en PE ne le sont pas. Ne pas confondre tous les emballages plastiques.'],
['ch-anthem','https://www.aboutswitzerland.eda.admin.ch/en/national-holiday-and-national-anthem','National holiday and national anthem','Federal Department of Foreign Affairs','Swiss Psalm; National Day','Psalm composed 1841, provisional anthem 1961, official 1981; national holiday approved in the 1993 referendum.'],
['ch-food','https://www.aboutswitzerland.eda.admin.ch/en/switzerlands-national-dishes','Switzerland’s national dishes','Federal Department of Foreign Affairs','Fondue; Rösti; Raclette; Birchermüesli','Ingredients and descriptions only; no nutrition or medical claims.'],
['ch-hiking','https://www.bernerwanderwege.ch/de/rund-ums-wandern/wanderwegkategorien','Wanderwegkategorien','Berner Wanderwege','Wanderwege; Bergwanderwege','White-red-white mountain-trail markings and yellow signs with red tips; not an assertion that a route is safe in every condition.']
]
for(const [id,url,title,authority,locator,review_note] of additions){
  const entry={id,url,title,authority,opened_at:'2026-11-13',review_status:'checked',locator,review_note}
  const i=sources.findIndex(s=>s.id===id)
  if(i<0)sources.push(entry);else sources[i]=entry
}
await writeFile(file,JSON.stringify(sources,null,2)+'\n','utf8')
console.log(`Reviewed source registry: ${sources.length}`)
