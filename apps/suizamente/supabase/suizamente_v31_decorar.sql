BEGIN;
CREATE TABLE IF NOT EXISTS suizamente_private.persona_decoraciones(
 persona text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,decoracion text NOT NULL,
 desbloqueada timestamptz NOT NULL DEFAULT clock_timestamp(),vista boolean NOT NULL DEFAULT false,vuelta integer,canton text,hueco text,
 PRIMARY KEY(persona,decoracion),UNIQUE(persona,vuelta,canton,hueco)
);
CREATE TABLE IF NOT EXISTS suizamente_private.decoraciones_gustos(
 persona text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
 amigo text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
 PRIMARY KEY(persona,amigo),CHECK(persona<>amigo)
);
ALTER TABLE suizamente_private.persona_decoraciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE suizamente_private.decoraciones_gustos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON suizamente_private.persona_decoraciones,suizamente_private.decoraciones_gustos FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION suizamente_private.mej_decorar_contadores(actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE win integer;cantons integer;regions integer;collections integer;duels integer;promotions integer;festive integer;season jsonb;
BEGIN
 SELECT count(*) INTO win FROM suizamente_private.suizamente_partidas WHERE ganador=actor AND estado='terminada';
 SELECT count(DISTINCT detalle->>'canton') INTO cantons FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='construccion' AND (detalle->>'nivel')::integer=(suizamente_private.v2_config()#>>'{mapa,nivelesPorCanton}')::integer;
 SELECT greatest(cantons,count(DISTINCT canton)) INTO cantons FROM suizamente_private.suizamente_mapa WHERE jugador_id=actor AND nivel=(suizamente_private.v2_config()#>>'{mapa,nivelesPorCanton}')::integer;
 SELECT count(*) INTO regions FROM suizamente_private.suizamente_cofres WHERE jugador_id=actor AND tipo='region';
 SELECT count(*) INTO collections FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='coleccion';
 SELECT count(*) INTO duels FROM suizamente_private.suizamente_duelos_sello WHERE ganador=actor AND estado='terminado';
 SELECT count(*) INTO promotions FROM suizamente_private.suizamente_liga_miembros l JOIN suizamente_private.suizamente_liga_semanas s USING(semana)
 WHERE l.jugador_id=actor AND (SELECT n FROM jsonb_array_elements(s.reglas->'divisiones') WITH ORDINALITY d(v,n) WHERE v->>'id'=l.destino)>(SELECT n FROM jsonb_array_elements(s.reglas->'divisiones') WITH ORDINALITY d(v,n) WHERE v->>'id'=l.division);
 SELECT value->'condicion' INTO season FROM suizamente_private.mejoras_configuracion,LATERAL jsonb_array_elements(decoraciones->'tipos') WHERE value->>'id'='abeto';
 SELECT count(*) INTO festive FROM suizamente_private.suizamente_actividad_dias WHERE jugador_id=actor AND extract(month FROM fecha)=(season->>'mes')::integer AND extract(day FROM fecha) BETWEEN (season->>'desde')::integer AND (season->>'hasta')::integer;
 RETURN jsonb_build_object('victorias',win,'cantones',cantons,'regiones',regions,'colecciones',collections,'duelos',duels,'ascensos',promotions,'navidad',festive,'racha',suizamente_private.v3_racha(actor));
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_decorar_desbloquear(actor text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE stats jsonb:=suizamente_private.mej_decorar_contadores(actor);d jsonb;added integer;
BEGIN
 FOR d IN SELECT value FROM suizamente_private.mejoras_configuracion,LATERAL jsonb_array_elements(decoraciones->'tipos') LOOP
  IF coalesce((stats->>(d#>>'{condicion,contador}'))::integer,0)>=(d#>>'{condicion,meta}')::integer THEN
   INSERT INTO suizamente_private.persona_decoraciones(persona,decoracion) VALUES(actor,d->>'id') ON CONFLICT DO NOTHING;
   GET DIAGNOSTICS added=ROW_COUNT;
   IF added=1 THEN PERFORM suizamente_private.v3_anotar(actor,'decoracion',d->>'id');END IF;
  END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_decorar_vista(actor text,target text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE data jsonb;mp jsonb;types jsonb;stats jsonb;
BEGIN
 SELECT decoraciones INTO data FROM suizamente_private.mejoras_configuracion;
 mp:=suizamente_private.v5_mapa(target);
 IF actor=target THEN
  stats:=suizamente_private.mej_decorar_contadores(actor);
  SELECT jsonb_agg(t||jsonb_build_object('avance',coalesce((stats->>(t#>>'{condicion,contador}'))::integer,0),'tuya',p.persona IS NOT NULL,'nueva',p.persona IS NOT NULL AND p.canton IS NULL,'momentoPendiente',p.persona IS NOT NULL AND NOT p.vista,
  'colocada',CASE WHEN p.canton IS NOT NULL THEN jsonb_build_object('canton',p.canton,'hueco',p.hueco,'vuelta',p.vuelta) END)) INTO types
  FROM jsonb_array_elements(data->'tipos') t LEFT JOIN suizamente_private.persona_decoraciones p ON p.persona=actor AND p.decoracion=t->>'id';
 END IF;
 RETURN jsonb_build_object('persona',suizamente_private.mej_persona(target),'mapa',jsonb_build_object('vuelta',mp->'vuelta','region',mp->'region','niveles',mp->'niveles','estilo',mp->'estilo','multiplicador',mp->'multiplicador'),
 'tipos',types,'huecos',CASE WHEN actor=target THEN data->'huecos' ELSE NULL END,
 'puestas',(SELECT coalesce(jsonb_agg((SELECT h FROM jsonb_array_elements(data->'huecos') h WHERE h->>'id'=p.hueco)||jsonb_build_object('k',p.decoracion,'vuelta',p.vuelta)),'[]') FROM suizamente_private.persona_decoraciones p WHERE p.persona=target AND p.canton IS NOT NULL),
 'conseguidas',(SELECT count(*) FROM suizamente_private.persona_decoraciones WHERE persona=target),
 'gustos',(SELECT count(*) FROM suizamente_private.decoraciones_gustos WHERE amigo=target AND suizamente_private.mej_amigos(target,persona)),
 'teGusta',EXISTS(SELECT 1 FROM suizamente_private.decoraciones_gustos WHERE persona=actor AND amigo=target),
 'cantonesCompletos',(SELECT count(*) FROM jsonb_each_text(mp->'niveles') WHERE value::integer=(suizamente_private.v2_config()#>>'{mapa,nivelesPorCanton}')::integer));
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_decorar(actor text,action text,args jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target text:=coalesce(args->>'amigo',actor);h jsonb;t jsonb;mp jsonb;v integer;changed integer;item text:=args->>'decoracion';
BEGIN
 IF target<>actor AND NOT suizamente_private.mej_amigos(actor,target) THEN RAISE EXCEPTION 'SZV2:403:Solo puedes visitar la Suiza de tus amigos';END IF;
 IF action IN('visitar','gustar') THEN
  IF action='gustar' THEN
   IF target=actor THEN RAISE EXCEPTION 'SZV2:400:Elige la Suiza de un amigo';END IF;
   IF coalesce((args->>'activo')::boolean,false) THEN INSERT INTO suizamente_private.decoraciones_gustos(persona,amigo) VALUES(actor,target) ON CONFLICT DO NOTHING;
   ELSE DELETE FROM suizamente_private.decoraciones_gustos WHERE persona=actor AND amigo=target;END IF;
  END IF;
  RETURN suizamente_private.mej_decorar_vista(actor,target)||jsonb_build_object('tuSuiza',suizamente_private.mej_decorar_vista(actor,actor)-'tipos'-'huecos'-'puestas');
 END IF;
 IF target<>actor THEN RAISE EXCEPTION 'SZV2:403:Solo puedes decorar tu Suiza';END IF;
 PERFORM suizamente_private.mej_decorar_desbloquear(actor);
 IF action='momento' THEN
  UPDATE suizamente_private.persona_decoraciones SET vista=true WHERE persona=actor AND decoracion=item AND NOT vista;
  GET DIAGNOSTICS changed=ROW_COUNT;RETURN jsonb_build_object('mostrar',changed=1);
 END IF;
 IF action='visto' THEN UPDATE suizamente_private.persona_decoraciones SET vista=true WHERE persona=actor AND decoracion=item;
 ELSIF action IN('poner','quitar') THEN
  IF NOT EXISTS(SELECT 1 FROM suizamente_private.persona_decoraciones WHERE persona=actor AND decoracion=item) THEN RAISE EXCEPTION 'SZV2:403:Todavía no tienes esta decoración';END IF;
  IF action='quitar' THEN UPDATE suizamente_private.persona_decoraciones SET vuelta=NULL,canton=NULL,hueco=NULL WHERE persona=actor AND decoracion=item;
  ELSE
   SELECT h1 INTO h FROM suizamente_private.mejoras_configuracion,LATERAL jsonb_array_elements(decoraciones->'huecos') h1 WHERE h1->>'id'=args->>'hueco';
   SELECT t1 INTO t FROM suizamente_private.mejoras_configuracion,LATERAL jsonb_array_elements(decoraciones->'tipos') t1 WHERE t1->>'id'=item;
   IF h IS NULL OR t->>'hueco'<>h->>'tipo' THEN RAISE EXCEPTION 'SZV2:400:Esta decoración no cabe en ese hueco';END IF;
   mp:=suizamente_private.v5_mapa(actor);v:=(mp->>'vuelta')::integer;
   IF (args->>'vuelta')::integer IS DISTINCT FROM v THEN RAISE EXCEPTION 'SZV2:409:Tu vuelta ha cambiado';END IF;
   IF coalesce((mp#>>ARRAY['niveles',h->>'canton'])::integer,0)<1 THEN RAISE EXCEPTION 'SZV2:409:Construye primero ese cantón';END IF;
   IF EXISTS(SELECT 1 FROM suizamente_private.persona_decoraciones WHERE persona=actor AND vuelta=v AND hueco=h->>'id' AND decoracion<>item) THEN RAISE EXCEPTION 'SZV2:409:Este hueco ya está ocupado';END IF;
   UPDATE suizamente_private.persona_decoraciones SET vuelta=v,canton=h->>'canton',hueco=h->>'id',vista=true WHERE persona=actor AND decoracion=item;
  END IF;
 END IF;
 RETURN suizamente_private.mej_decorar_vista(actor,actor);
END $$;
DO $$ DECLARE f regprocedure;BEGIN FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND p.proname LIKE 'mej_%' LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||f||' FROM PUBLIC,anon,authenticated';END LOOP;END $$;
COMMIT;
