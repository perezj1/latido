// Editorial catalogue: reuses immutable, sourced questions rather than paying
// twice for copies of the same question. Never import this private data in React.
import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {publicationSql} from './lib/suizamente-content-pack.mjs'

const read=async path=>JSON.parse(await readFile(path,'utf8'))
const expansion=await read('supabase/seed-data/suizamente-expansion/questions.json')
const base=await read('supabase/seed-data/suizamente-questions.json')
const short={
  'szx-zh-plato-ternera':'¿Qué carne lleva el Zürcher Geschnetzeltes tradicional?',
  'szx-zh-festival-estacion':'¿En qué fiesta de Zürich se quema el Böögg?',
  'szx-zh-vidrieras-autor':'¿Quién creó las cinco famosas vidrieras del Fraumünster?',
  'szx-zh-gross-torre':'¿Cómo se llama una de las torres del Grossmünster?',
  'szx-zh-bahnhof-paseo':'¿Hacia dónde lleva Bahnhofstrasse desde Zürich HB?',
  'szx-zh-bosque-cima-local':'¿Cuál es la montaña más emblemática de Zürich?',
  'szx-zh-planetas-paseo':'¿A qué está dedicado el paseo Uetliberg–Felsenegg?',
  'szx-zh-imagen-torres':'¿Qué iglesia de Zürich reconoces?',
  'szx-zh-imagen-boogg':'¿A qué fiesta pertenece este muñeco?',
  'game-6-v1':'¿De qué cantón es este escudo?',
  'szx-ge-jet-origen':'¿Para qué servía originalmente el Jet d’Eau?',
  'szx-ge-jet-color':'¿Por qué se ve tan blanca el agua del Jet d’Eau?',
  'szx-ge-reloj-jardin':'¿En qué parque está el reloj de flores de Genève?',
  'szx-ge-escalade-historia':'¿Qué recuerda l’Escalade de Genève?',
  'szx-ge-cern-que-estudia':'¿Qué se investiga principalmente en el CERN?',
  'szx-ge-cern-frontera':'¿Entre qué dos países se extiende el CERN?',
  'szx-ge-lema-luz':'¿Qué significa «Post tenebras lux», el lema de Genève?',
  'szx-ge-imagen-jet':'¿Qué símbolo de Genève reconoces?',
  'szx-ge-imagen-reloj':'¿Qué lugar de Genève reconoces?',
  'szx-ge-imagen-marmita':'¿En qué fiesta se rompe esta marmita de chocolate?',
  'szx-lu-puente-incendio':'¿Qué le pasó a la Kapellbrücke en los años noventa?',
  'szx-lu-reuss-puente':'¿Qué río cruza la Kapellbrücke?',
  'szx-lu-leon-historia':'¿A quién recuerda el León de Lucerna?',
  'szx-lu-guggen-musica':'¿Qué tipo de música es la Guggenmusik?',
  'szx-lu-samichlaus-epoca':'¿En qué época aparece Samichlaus?',
  'szx-lu-imagen-escudo':'¿De qué cantón es este escudo?',
  'szx-lu-imagen-puente':'¿Qué lugar de Luzern reconoces?',
  'szx-lu-imagen-leon':'¿Qué monumento de Luzern reconoces?',
  'szx-lu-imagen-mascara':'¿Qué fiesta de Luzern representan estas máscaras?',
  'szx-be-cebollas-fiesta':'¿Qué se vende sobre todo en el Zibelemärit de Berna?',
  'szx-be-mercado-cuando':'¿Cuándo se celebra el Zibelemärit?',
  'szx-be-torre-antes':'Antes de ser un reloj, ¿qué era la Zytglogge?',
  'szx-be-berna-rio':'¿Qué río rodea el casco antiguo de Berna?',
  'szx-be-arcadas-lluvia':'¿Qué son las «Lauben» de Berna?',
  'szx-be-queso-agujeros':'¿Cómo se forman los agujeros del Emmentaler AOP?',
  'szx-be-bienne-dos-lenguas':'¿Qué dos lenguas son oficiales en Biel/Bienne?',
  'szx-be-jungfrau-tunel':'¿Qué dos montañas atraviesa la Jungfraubahn?',
  'szx-be-imagen-reloj':'¿Qué torre de Berna reconoces?',
  'szx-be-imagen-mercado':'¿A qué mercado de Berna pertenecen estas trenzas?',
  'szx-be-imagen-arcadas':'¿Cómo se llaman estas galerías de Berna?',
  'szx-be-imagen-queso':'¿Qué rasgo distingue al Emmentaler del dibujo?',
  'ti-canton-capital':'¿Cuál es la capital de Ticino?',
  'szx-ti-grotto-que-es':'Te invitan a un grotto en Ticino. ¿Qué es?',
  'szx-ti-monte-fosiles':'¿Por qué es famoso el Monte San Giorgio?',
  'szx-ti-imagen-castillos':'¿Qué fortaleza de Ticino reconoces?',
  'szx-ti-imagen-polenta':'¿Qué plato de Ticino reconoces?',
  'szx-ti-imagen-escudo':'¿De qué cantón es este escudo?',
  'szx-vd-papet-ingredientes':'¿Qué dos verduras lleva el papet vaudois?',
  'szx-vd-lavaux-paisaje':'¿Qué paisaje hace famoso a Lavaux?',
  'szx-vd-guet-voz':'¿Quién anuncia la hora de noche desde la catedral de Lausanne?',
  'szx-vd-chillon-poeta':'¿Quién escribió «The Prisoner of Chillon»?',
  'vd-canton-capital':'¿Cuál es la capital de Vaud?',
  'szx-vd-imagen-lavaux':'¿Qué paisaje suizo reconoces?',
  'szx-vd-imagen-chillon':'¿Qué castillo del Léman reconoces?',
  'szx-vd-imagen-papet':'¿Qué plato de Vaud reconoces?',
  'szx-vd-imagen-escudo-vd':'¿De qué cantón es este escudo?',
  'szx-bl-romanos-augst':'¿A qué época viajas en Augusta Raurica?',
  'szx-bl-tesoro-material':'¿De qué metal es el tesoro de Kaiseraugst?',
  'szx-bl-imagen-chienbase-bl':'¿Qué tradición de Liestal reconoces?',
  'szx-bs-corriente-ferry':'¿Qué mueve los transbordadores tradicionales del Rin en Basel?',
  'szx-bs-fuente-movimiento':'¿Quién creó la fuente de Basel con máquinas que juegan con agua?',
  'szx-bs-imagen-munster-bs':'¿Qué monumento de Basel reconoces?',
  'szx-bs-imagen-linterna-bs':'¿En qué fiesta de Basel desfilan estas linternas?',
  'szx-bs-imagen-papel-bs':'¿Qué están fabricando en este taller de Basel?',
  'szx-fr-azafran-cuchaule':'¿Qué especia da su color amarillo a la cuchaule?',
  'szx-fr-quesos-mitad':'¿Qué dos quesos lleva la fondue moitié-moitié de Fribourg?',
  'szx-fr-poya-subida':'¿Qué escena representa una poya?',
  'szx-fr-imagen-cuchaule-fr':'¿Qué especialidad de Fribourg reconoces?',
  'szx-fr-imagen-poya-fr':'¿Qué tradición artística de Fribourg reconoces?',
  'szx-vs-luizet-fruta':'¿Qué fruta es la variedad Luizet del Valais?',
  'szx-vs-reinas-herens':'En un «combat de reines» del Valais, ¿quiénes son las reinas?',
  'szx-vs-barry-martigny':'¿En qué ciudad está Barryland, dedicado al San Bernardo?',
  'szx-vs-imagen-raclette-vs':'¿Qué especialidad suiza reconoces?',
  'szx-vs-imagen-abricot-vs':'¿Qué fruta del Valais reconoces?',
  'szx-sg-manuscritos':'¿Qué tesoro guarda la biblioteca de la abadía de St. Gallen?',
  'szx-sg-textiles':'¿Qué artesanía hizo famosa a St. Gallen?',
  'szx-sg-biber-relleno':'¿De qué va relleno un St. Galler Biber?',
  'szx-sg-burli':'En St. Gallen te ofrecen un Bürli. ¿Qué es?',
  'szx-sg-imagen-bratwurst':'¿Qué especialidad de St. Gallen reconoces?',
  'szx-sg-imagen-bordado':'¿Qué artesanía de St. Gallen reconoces?',
  'szx-gr-capuns-hoja':'¿En qué hojas se envuelven los capuns?',
  'szx-gr-chalandamarz':'¿Qué fiesta engadinesa despide el invierno con campanas?',
  'szx-gr-imagen-landwasser':'¿Qué famoso viaducto suizo reconoces?',
  'szx-gr-imagen-nusstorte':'¿Qué tarta de Graubünden reconoces?',
  'szx-gr-imagen-capuns':'¿Qué plato de Graubünden reconoces?',
  'szx-ar-bloch-que':'¿Qué arrastran en el desfile del Bloch?',
  'szx-ar-zaeuerli':'¿Qué es un Zäuerli de Appenzell?',
  'szx-ar-dunant-heiden':'¿Qué fundador de la Cruz Roja recuerda Heiden?',
  'szx-ar-witzweg-humor':'¿Qué hace especial al Witzweg de Appenzell?',
  'szx-ar-imagen-hackbrett':'¿Qué instrumento suizo reconoces?',
  'szx-ar-imagen-bloch':'¿Qué tradición de Appenzell reconoces?',
  'szx-ur-tell-manzana':'Según la leyenda, ¿qué debía acertar Guillermo Tell con su ballesta?',
  'szx-ur-puente-primer-cruce':'En la leyenda de la Teufelsbrücke, ¿quién cruza primero para burlar al diablo?',
  'szx-ur-postre-brischtner':'¿Qué fruta protagoniza el postre Brischtner Nytlä de Uri?',
  'szx-ur-imagen-escudo':'¿De qué cantón es este escudo?',
  'szx-ur-imagen-ballesta':'¿Qué objeto del relato de Guillermo Tell reconoces?',
  'szx-ow-engelberg-exclave':'¿A qué cantón pertenece Engelberg?',
  'szx-nw-vidrio-materia':'¿Qué materia prima se transforma en vidrio en la Glasi Hergiswil?',
  'szx-nw-imagen-soplar':'¿Qué oficio de Hergiswil reconoces?',
  'szx-gl-martinsloch-luz':'¿Qué edificio ilumina el Sol al atravesar el Martinsloch?',
  'szx-gl-imagen-ziger':'¿Qué queso de Glarus reconoces?',
  'szx-zg-sturm-significado':'¿Qué anuncia la campana del Chriesisturm de Zug?',
  'szx-zg-imagen-carrera-zg':'¿Qué fiesta de Zug empieza con una carrera de escaleras?',
  'szx-so-numero-local':'¿Qué número es especialmente famoso en Solothurn?',
  'szx-so-torta-avellana':'¿Qué fruto seco lleva la Solothurner Torte?',
  'szx-so-altreu-observar':'¿Qué aves anidan sobre los tejados de Altreu?',
  'szx-so-imagen-ciguena-so':'¿Qué ave de Altreu reconoces?',
  'szx-sh-stein-fachadas-sh':'¿Por qué merece la pena mirar las fachadas de Stein am Rhein?',
  'szx-sh-rin-cataratas-sh':'¿Qué río forma las cataratas del Rheinfall?',
  'szx-sh-imagen-munot-sh':'¿Qué fortaleza de Schaffhausen reconoces?',
  'szx-sh-imagen-catarata-sh':'¿Qué cataratas suizas reconoces?',
  'szx-ag-vindonissa-epoca':'¿A qué época viajas en Vindonissa?',
  'szx-ag-habsburg-familia':'¿Qué dinastía da nombre al castillo de Habsburg?',
  'szx-ag-baden-agua':'¿Qué recurso natural hizo famosa a Baden?',
  'szx-tg-fruta-paisaje':'¿Qué fruta es protagonista en Thurgau?',
  'szx-tg-principe-arenenberg':'¿Qué futuro emperador creció en Arenenberg?',
  'szx-ne-dos-ciudades-reloj':'¿Qué dos ciudades de Neuchâtel son patrimonio UNESCO por su urbanismo relojero?',
  'szx-ne-creux-forma':'¿Qué paisaje caracteriza al Creux du Van?',
  'szx-ne-imagen-reloj-ne':'¿Qué oficio de Neuchâtel reconoces?',
  'szx-ju-caballo-region':'¿Qué raza de caballo da fama a las Franches-Montagnes?',
  'szx-ju-toetche-crema':'En el Jura te ofrecen toétché. ¿Qué es?',
  'szx-ju-imagen-toetche-ju':'¿Qué especialidad del Jura reconoces?'
}
const byId=new Map([...base,...expansion].map(q=>[q.id,q]))
for(const id of Object.keys(short))assert.ok(byId.has(id),id)
// Only the explicitly reviewed, concise selection goes into the national
// discovery pool. Other cultural questions remain local to the chosen canton.
const generalIds=new Set(Object.keys(short))
for(const q of expansion)if(q.topic==='cultura'&&['tf','match','order','multi'].includes(q.game_type)&&q.prompt.length<=155&&!/FAQ|comprobar|consult|accesib|gratuit|sin supervisión|condici|información|especificación|receta presentada|derecho de voto|situación actual|publicación/iu.test(q.prompt))generalIds.add(q.id)
const topic=q=>/escudo|bandera/u.test(q.prompt)?'simbolos':/plato|queso|fruta|postre|tarta|polenta|fondue|biber|bürli|papet|cuchaule|capuns|toétché|raclette|geschnetzeltes/iu.test(q.prompt)?'sabores':/fiesta|carnaval|celebraci|fasnacht|tradici|böögg|chlaus|bloch|escalade|chalandamarz|zibele|chriesi/iu.test(q.prompt)?'tradiciones':q.topic==='naturaleza'?'naturaleza':/río|lago|montaña|castillo|catedral|ciudad|puente|torre|fortaleza|paisaje|capital|iglesia|parque|viaducto|catarata|monumento|cantón/iu.test(q.prompt)?'lugares':'curiosidades'
const catalog=[...byId.values()].filter(q=>['cultura','naturaleza'].includes(q.topic)||generalIds.has(q.id)).map(q=>({id:q.id,topic:topic({...q,prompt:short[q.id]||q.prompt}),national:generalIds.has(q.id),original_prompt:q.prompt,prompt:short[q.id]||q.prompt}))

const sources={
  flag:['https://www.aboutswitzerland.eda.admin.ch/en/swiss-flag','DFAE · Bandera suiza','Origins and history; Form, colour and size'],
  rigi:['https://www.myswitzerland.com/en-ch/experiences/route/chaeserenholz-schneeschuhtrail/','Suiza Turismo / Rigi Plus · Rigi Kulm','Description: lakes of Central Switzerland; highest peak at 1798 m'],
  traditions:['https://www.aboutswitzerland.eda.admin.ch/en/traditions','DFAE · Tradiciones suizas','Traditions – facts and figures; Heidi, Jass and Schwingen'],
  food:['https://www.aboutswitzerland.eda.admin.ch/en/switzerlands-national-dishes','DFAE · Platos nacionales','Cheese fondue; Rösti; Raclette; Muesli'],
  language:['https://www.aboutswitzerland.eda.admin.ch/en/language','DFAE · Lenguas de Suiza','Facts and figures on languages in Switzerland']
}
const fresh=[]
function add(id,topic,type,prompt,options,correct,explanation,source,extra={}){
  const [source_url,source_title,locator]=sources[source]
  const q={id:`szt-${id}`,collection:'suizamente-trivia-13',territory:'CH',scope:'CH',canton:null,category:'sociedad',difficulty:extra.difficulty||1,language:'es',status:'published',game_type:type,game_only:type!=='choice',prompt,options,correct_index:correct,explanation,source_url,source_title,reviewed_at:'2026-11-18',verified_at:'2026-11-18',validation_status:'verified',next_review_at:'2027-11-01',sources:[{url:source_url,title:source_title,checked_at:'2026-11-18',locator}],...extra}
  fresh.push(q);catalog.push({id:q.id,topic,national:true,original_prompt:prompt,prompt})
}
add('bandera','simbolos','image','¿De qué país es esta bandera?',['Suiza','Dinamarca','Austria','Suecia'],0,'Suiza: cruz blanca centrada sobre fondo rojo cuadrado.','flag',{image_key:'swiss-trivia-flag'})
add('bandera-cuadrada','simbolos','tf','La bandera nacional suiza es cuadrada.',['Verdadero','Falso'],0,'Sí: su forma habitual es cuadrada.','flag')
add('bandera-vaticano','simbolos','choice','¿Qué otro Estado tiene una bandera nacional cuadrada?',['Ciudad del Vaticano','Italia','Francia','Alemania'],0,'La bandera del Vaticano también es cuadrada.','flag',{difficulty:3})
add('rigi-donde','lugares','choice','¿Dónde está el Rigi?',['En la Suiza central, junto al lago de Lucerna','En el Jura, junto a Delémont','En Ticino, junto a Lugano','En el Valais, junto a Zermatt'],0,'El Rigi se alza en la Suiza central, junto al lago de Lucerna.','rigi')
add('rigi-altura','lugares','choice','¿Qué altura tiene Rigi Kulm?',['1798 m','870 m','3967 m','4478 m'],0,'Rigi Kulm, la cima más alta del Rigi, alcanza 1798 metros.','rigi',{difficulty:3})
add('heidi-autora','curiosidades','choice','¿Quién escribió Heidi?',['Johanna Spyri','Astrid Lindgren','Agatha Christie','Enid Blyton'],0,'Johanna Spyri creó a la niña de los Alpes en el siglo XIX.','traditions',{difficulty:3})
add('jass-cartas','curiosidades','choice','Te invitan a jugar al Jass. ¿Qué necesitas?',['Una baraja de cartas','Un tablero de ajedrez','Unos patines','Un arco y flechas'],0,'El Jass es un popular juego de cartas suizo.','traditions')
add('schwingen','tradiciones','choice','¿Qué deporte es el Schwingen?',['Lucha suiza','Salto de esquí','Hockey sobre hielo','Carrera de trineos'],0,'El Schwingen es una modalidad tradicional de lucha suiza.','traditions')
add('alpes-regreso','tradiciones','tf','En la bajada del ganado desde los Alpes, las vacas pueden llevar adornos y campanas.',['Verdadero','Falso'],0,'La bajada tradicional del ganado suele terminar con una fiesta en el valle.','traditions')
add('fondue-olla','sabores','choice','¿Cómo se llama la olla de la fondue?',['Caquelon','Samovar','Tajín','Wok'],0,'El caquelon mantiene caliente el queso de la fondue.','food',{difficulty:3})
add('rosti-base','sabores','choice','¿Cuál es el ingrediente principal del rösti?',['Patata','Arroz','Maíz','Garbanzos'],0,'El rösti se prepara con patata rallada y dorada en la sartén.','food')
add('raclette-canton','sabores','choice','¿Con qué cantón se asocia originalmente la raclette?',['Valais','Zug','Jura','Thurgau'],0,'La raclette es una especialidad tradicional del Valais.','food')
add('bircher-invento','curiosidades','choice','¿Qué profesión tenía el creador del Birchermüesli?',['Médico','Relojero','Maquinista','Alpinista'],0,'Max Bircher-Benner era médico y lo desarrolló a comienzos del siglo XX.','food',{difficulty:3})
add('lenguas-elegir','curiosidades','multi','¿Cuáles de estas lenguas son nacionales en Suiza?',['Italiano','Romanche','Inglés','Español'],0,'El italiano y el romanche son lenguas nacionales, junto con el alemán y el francés.','language',{correct_indices:[0,1]})
assert.equal(new Set(catalog.map(q=>q.id)).size,catalog.length)
// Better distractors, with the same correct answer and index. Publish a new
// immutable version; a previously assigned round keeps its original options.
const options={
  'szx-lu-imagen-puente':['Kapellbrücke y Wasserturm','Teufelsbrücke','Ponte dei Salti','Pont de Berne'],
  'szx-be-imagen-reloj':['Zytglogge','Zytturm de Zug','Munot','Spalentor'],
  'szx-be-imagen-mercado':['Zibelemärit','Mercado de Navidad','Mercado de flores','Mercado de quesos'],
  'szx-be-imagen-arcadas':['Lauben','Laubengänge de madera sobre un lago','Pasos subterráneos','Puentes cubiertos sobre un río'],
  'szx-be-imagen-queso':['Grandes ojos formados durante la maduración','Una capa central de moho azul','Una capa de ceniza en el centro','Un corazón de crema líquida'],
  'szx-ti-imagen-castillos':['Fortaleza de Bellinzona','Castillo de Chillon','Castillo de Habsburg','Castillo de Hallwyl'],
  'szx-ti-imagen-polenta':['Polenta','Rösti','Risotto','Capuns'],
  'szx-vd-imagen-chillon':['Chillon','Hallwyl','Habsburg','Castelgrande de Bellinzona'],
  'szx-vd-imagen-papet':['Papet vaudois','Rösti bernés','Älplermagronen','Capuns'],
  'szx-bs-imagen-munster-bs':['Basler Münster','Grossmünster','Catedral de St. Gallen','Catedral de St. Ursen'],
  'szx-bs-imagen-papel-bs':['Una hoja de papel artesanal','Una pieza de fieltro','Una lámina de cera','Una tela de lino'],
  'szx-fr-imagen-cuchaule-fr':['Cuchaule','Zopf','Bürli','Pan de centeno del Valais'],
  'szx-fr-imagen-poya-fr':['Una poya','Un sgraffito engadinés','Un bordado de Appenzell','Una pintura sobre vidrio'],
  'szx-vs-imagen-raclette-vs':['Raclette','Fondue','Rösti con queso','Älplermagronen'],
  'szx-vs-imagen-abricot-vs':['Albaricoque','Melocotón','Ciruela amarilla','Nectarina'],
  'szx-gr-imagen-landwasser':['Landwasserviadukt','Wiesener Viadukt','Solisviadukt','Lorrainebrücke'],
  'szx-gr-imagen-nusstorte':['Solothurner Torte','Bündner Nusstorte','Zuger Kirschtorte','Basler Läckerli'],
  'szx-gr-imagen-capuns':['Capuns','Älplermagronen','Maluns','Pizokel'],
  'szx-sg-imagen-bratwurst':['Cervelat','St. Galler Bratwurst','Saucisson vaudois','Luganighe'],
  'szx-sg-imagen-bordado':['Encaje de bolillos','Tejido con telar','Bordado','Estampación textil'],
  'szx-ur-imagen-ballesta':['Un arco largo','Una ballesta','Una honda','Una catapulta'],
  'szx-nw-imagen-soplar':['Cerámica','Forja','Soplado de vidrio','Fundición de bronce'],
  'szx-gl-imagen-ziger':['Gruyère en rueda','Schabzigerstöckli','Appenzeller en rueda','Tête de Moine'],
  'szx-sh-imagen-munot-sh':['Munot','Castillo de Hallwyl','Château de Chillon','Castillo de Habsburg'],
  'szx-sh-imagen-catarata-sh':['Staubbachfall','Rheinfall','Giessbachfälle','Trümmelbachfälle'],
  'szx-ju-imagen-toetche-ju':['Cuchaule','Bündner Nusstorte','Zuger Kirschtorte','Toétché']
}
// Keep generic naming questions generic where the options name whole dishes.
catalog.find(q=>q.id==='szx-gr-imagen-nusstorte').prompt='¿Qué especialidad suiza reconoces?'
const refinements=Object.entries(options).map(([id,options])=>{
  const original=byId.get(id);assert.ok(original,id);assert.equal(options.length,4)
  assert.equal(options[original.correct_index],original.options[original.correct_index],`Never change the correct answer: ${id}`)
  return {...original,options}
})
await writeFile('supabase/seed-data/suizamente-trivia.json',JSON.stringify({catalog,questions:fresh,refinements},null,2)+'\n')
await writeFile('supabase/suizamente_trivia_preguntas_13.sql',publicationSql([...fresh,...refinements],[...byId.values()].map(q=>({...q,status:'published'}))))
console.log(`Trivia: ${catalog.length} cultural entries; ${catalog.filter(q=>q.national).length} nationwide discoveries; ${fresh.length} new questions; ${refinements.length} improved option sets.`)
