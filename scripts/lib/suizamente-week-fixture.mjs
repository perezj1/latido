// Deterministic fixtures for an isolated PostgreSQL database, never for production.
export async function weeklyFixture(db,week){
 const config=(await db.query('SELECT suizamente_private.v10_config_base() c')).rows[0].c
 const size=config.ligas.tamanoGrupo
 for(const [divisionIndex,division] of config.ligas.divisiones.entries()){
  for(let i=0;i<size+(divisionIndex===1?7:0);i++){
   const id='77777777-7777-4777-8777-'+String(divisionIndex*10000+i).padStart(12,'0')
   await db.query('INSERT INTO auth.users VALUES($1)',[id])
   await db.query('INSERT INTO suizamente_private.suizamente_jugadores(jugador_id,usuario_id,apodo) VALUES($1::text,$1::uuid,$2)',[id,'Prueba '+divisionIndex+' '+i])
   await db.query('INSERT INTO suizamente_private.suizamente_liga_estado VALUES($1,$2)',[id,division.id])
   await db.query("INSERT INTO suizamente_private.suizamente_movimientos(jugador_id,motivo,ref,creado_en) VALUES($1,'partida_perdida','semana-previa',($2::date-2)::timestamp AT TIME ZONE 'Europe/Zurich')",[id,week])
  }
 }
 await db.query("SELECT suizamente_private.v12_tick($1::date::timestamp AT TIME ZONE 'Europe/Zurich')",[week])
 const members=(await db.query('SELECT suizamente_private.v10_liga_filas($1::date) rows',[week])).rows[0].rows
 for(const member of members){
  // Every active participant finishes a game. Stamp receipts establish distinct scores.
  if(member.puesto===size)continue
  await db.query("INSERT INTO suizamente_private.suizamente_movimientos(jugador_id,motivo,ref,creado_en) VALUES($1,'partida_ganada','semana-actual',($2::date+1)::timestamp AT TIME ZONE 'Europe/Zurich')",[member.id,week])
  await db.query("INSERT INTO suizamente_private.suizamente_movimientos(jugador_id,motivo,ref,creado_en) SELECT $1,'sello_ganado','sello-'||i,($2::date+1)::timestamp AT TIME ZONE 'Europe/Zurich'+make_interval(mins=>i) FROM generate_series(1,$3::integer) i",[member.id,week,size-member.puesto])
 }
 return {config,rows:(await db.query('SELECT suizamente_private.v10_liga_filas($1::date) rows',[week])).rows[0].rows}
}
