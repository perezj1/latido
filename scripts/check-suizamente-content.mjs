import {writeFile,mkdir} from 'node:fs/promises'
import {loadContentPack,validateContentPack,solution,publicationSql} from './lib/suizamente-content-pack.mjs'
const pack=await loadContentPack(),report=validateContentPack(pack),dir=new URL('../docs/suizamente-content/',import.meta.url)
await mkdir(dir,{recursive:true})
await writeFile(new URL('informe.json',dir),JSON.stringify(report,null,2)+'\n','utf8')
const rows=Object.entries(report.counts).map(([t,c])=>`| ${t} | ${c.total} | ${Object.values(c.formats).join(' | ')} |`).join('\n')
await writeFile(new URL('ESTADO.md',dir),`# Estado del banco ampliado\n\nFecha de contraste: ${report.reference_date}.\n\n**${report.prepared_total} de ${report.target_total} entradas preparadas; faltan ${report.remaining}.** Este informe describe archivos locales. El usuario confirma ejecutados los SQL hasta el lote 10 (Aargau/Thurgau). La entrega 11 (Neuchâtel/Jura) está preparada localmente y pendiente de ejecutar. LEEME.md indica los dos SQL incrementales actuales. No se consulta ni modifica Supabase remoto desde Codex. Consulta LEEME.md para el orden incremental.\n\n| Territorio | Total | Selección | V/F | Parejas | Ordenar | Imagen | Escrita |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${rows}\n\nTeclado: ${report.keyboard_percentage.toFixed(1)} %. Revisión vencida: ${report.review_due.length}; próxima en 30 días: ${report.review_next_30_days.length}.\n\n${report.limitations.join('\n\n')}\n\nIdentificadores anteriores reutilizados: ${report.reused_ids.length}. Los demás registros del banco anterior se conservan.\n`,'utf8')
for(const territory of pack.manifest.territories){
  const qs=pack.questions.filter(q=>q.territory===territory);if(!qs.length)continue
  const md=[`# ${territory} — preguntas preparadas`, '', 'Material editorial privado: contiene las soluciones. No incluir este documento ni el JSON en el bundle público.', '', ...qs.flatMap((q,i)=>[
    `## ${i+1}. ${q.prompt}`,'',`ID: ${q.id} · ${q.topic} · ${q.game_type} · ${q.editorial_difficulty}`,'',...q.options.map((o,k)=>`${k+1}. ${o}`),'',`**Solución:** ${solution(q)}`,'',q.explanation,'',...q.sources.map(s=>`Fuente: [${s.title}](${s.url}) · ${s.locator}`),'',`Verificación: ${q.verified_at}. Próxima revisión: ${q.next_review_at}.${q.validity_year?` Año de vigencia: ${q.validity_year}.`:''}`,''])].join('\n')
  await writeFile(new URL(`${territory}.md`,dir),md,'utf8')
}
if(process.argv.includes('--publish')){
  const territory=process.argv.find(a=>a.startsWith('--territory='))?.split('=')[1]
  const subset=territory?pack.questions.filter(q=>q.territory===territory):pack.questions
  const block=territory&&report.counts[territory]
  const ready=territory?block&&block.total===50&&Object.entries(pack.manifest.formats_per_territory).every(([f,n])=>block.formats[f]===n)&&!subset.some(q=>q.next_review_at<=report.reference_date)&&!report.errors.length:report.complete
  if(!ready)throw Error('Publicación bloqueada: faltan entradas, revisiones o validaciones. Consulta docs/suizamente-content/informe.json.')
  await writeFile(new URL(`../supabase/suizamente_expansion_${territory||'seed'}.sql`,import.meta.url),publicationSql(subset,pack.legacy),'utf8')
}
console.log(`${report.prepared_total}/${report.target_total} prepared; ${report.remaining} missing; ${report.errors.length} structural errors; ${report.reused_ids.length} reused IDs.`)
if(report.errors.length)console.error(report.errors.join('\n'))
if(report.errors.length||(!report.complete&&!process.argv.includes('--allow-incomplete')))process.exitCode=1
