-- Apply after v5. Only the five initial collections are active in this phase.
BEGIN;
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_cartas(
  jugador_id text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
  carta_id text NOT NULL,primera_en timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(jugador_id,carta_id)
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_sobres(
  id uuid PRIMARY KEY,jugador_id text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
  cartas jsonb NOT NULL,giradas integer NOT NULL DEFAULT 0 CHECK(giradas>=0),creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(jsonb_typeof(cartas)='array' AND jsonb_array_length(cartas)>0 AND giradas<=jsonb_array_length(cartas))
);
CREATE INDEX IF NOT EXISTS suizamente_sobres_jugador ON suizamente_private.suizamente_sobres(jugador_id,creado_en DESC);
CREATE OR REPLACE FUNCTION suizamente_private.v6_colecciones() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_agg(value ORDER BY (value->>'id')::integer) FROM suizamente_private.suizamente_configuracion,
    LATERAL jsonb_array_elements(album->'colecciones') WHERE value->>'mes' IS NULL
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v6_carta() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE rarity integer; roll numeric:=random(); cumulative numeric:=0; r record; card jsonb;
BEGIN
  FOR r IN SELECT key,value FROM jsonb_each_text(suizamente_private.v2_config()#>'{album,pesoRareza}') ORDER BY key::integer LOOP
    cumulative:=cumulative+r.value::numeric;
    IF roll<cumulative THEN rarity:=r.key::integer;EXIT; END IF;
  END LOOP;
  IF rarity IS NULL THEN RAISE EXCEPTION 'SZV2:503:Revisa los pesos de rareza del álbum'; END IF;
  SELECT k||jsonb_build_object('coleccion',c->>'nombre','coleccionId',(c->>'id')::integer) INTO card
    FROM jsonb_array_elements(suizamente_private.v6_colecciones()) c CROSS JOIN LATERAL jsonb_array_elements(c->'cartas') k
    WHERE (k->>'r')::integer=rarity ORDER BY random() LIMIT 1;
  IF card IS NULL THEN RAISE EXCEPTION 'SZV2:503:No hay cartas para esa rareza'; END IF;
  RETURN card;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v6_completar(actor text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE col jsonb;
BEGIN
  FOR col IN SELECT value FROM jsonb_array_elements(suizamente_private.v6_colecciones()) LOOP
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(col->'cartas') k WHERE NOT EXISTS(
      SELECT 1 FROM suizamente_private.suizamente_cartas WHERE jugador_id=actor AND carta_id=k->>'id'))
      AND NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='coleccion' AND ref=col->>'id') THEN
      PERFORM suizamente_private.v5_premiar(actor,'coleccion',col->>'id',(col#>>'{premio,monedas}')::integer,
        jsonb_build_object('quita',col#>'{premio,quita}','escudos',col#>'{premio,escudos}'));
    END IF;
  END LOOP;
  PERFORM suizamente_private.v3_logros(actor);
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v6_album(actor text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('colecciones',(SELECT jsonb_agg(c-'cartas'||jsonb_build_object('tengo',
    (SELECT count(*) FROM jsonb_array_elements(c->'cartas') k JOIN suizamente_private.suizamente_cartas a ON a.jugador_id=actor AND a.carta_id=k->>'id'),
    'completa',EXISTS(SELECT 1 FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='coleccion' AND ref=c->>'id'),
    'cartas',(SELECT jsonb_agg((CASE WHEN a.carta_id IS NULL THEN k-'dato' ELSE k END)||jsonb_build_object('conseguida',a.carta_id IS NOT NULL) ORDER BY ord)
      FROM jsonb_array_elements(c->'cartas') WITH ORDINALITY k(k,ord) LEFT JOIN suizamente_private.suizamente_cartas a ON a.jugador_id=actor AND a.carta_id=k->>'id')) ORDER BY (c->>'id')::integer)
      FROM jsonb_array_elements(suizamente_private.v6_colecciones()) c),
    'sobrePendiente',(SELECT id FROM suizamente_private.suizamente_sobres WHERE jugador_id=actor AND giradas<jsonb_array_length(cartas) ORDER BY creado_en LIMIT 1),
    'cofres',suizamente_private.v5_mapa(actor)->'cofres')
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v6_sobre_ver(sid uuid,actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pack suizamente_private.suizamente_sobres;
BEGIN
  SELECT * INTO pack FROM suizamente_private.suizamente_sobres WHERE id=sid AND jugador_id=actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'SZV2:404:Sobre no encontrado'; END IF;
  RETURN jsonb_build_object('id',pack.id,'giradas',pack.giradas,'total',jsonb_array_length(pack.cartas),
    'cartas',coalesce((SELECT jsonb_agg(value ORDER BY ord) FROM jsonb_array_elements(pack.cartas) WITH ORDINALITY k(value,ord) WHERE ord<=pack.giradas),'[]'),
    'colecciones',(SELECT jsonb_agg((c-'cartas')||jsonb_build_object('total',jsonb_array_length(c->'cartas'))) FROM jsonb_array_elements(suizamente_private.v6_album(actor)->'colecciones') c
      WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(pack.cartas) k WHERE k->>'coleccionId'=c->>'id')));
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v6_accion(action text,actor text,body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pack suizamente_private.suizamente_sobres; card jsonb; list jsonb:='[]'; sid uuid; inserted integer; i integer; count_cards integer;
  coins integer; c jsonb:=suizamente_private.v2_config();
BEGIN
  IF action='album' THEN RETURN suizamente_private.v6_album(actor);
  ELSIF action='abrir_sobre' THEN
    sid:=(body->>'clave')::uuid;
    IF sid IS NULL THEN RAISE EXCEPTION 'SZV2:400:Sobre no válido'; END IF;
    IF EXISTS(SELECT 1 FROM suizamente_private.suizamente_sobres WHERE id=sid) THEN RAISE EXCEPTION 'SZV2:409:Este sobre ya está abierto'; END IF;
    IF EXISTS(SELECT 1 FROM suizamente_private.suizamente_sobres WHERE jugador_id=actor AND giradas<jsonb_array_length(cartas)) THEN RAISE EXCEPTION 'SZV2:409:Termina de girar las cartas del sobre pendiente'; END IF;
    PERFORM suizamente_private.v3_anotar(actor,'sobre',sid::text,0,0,'{"sobres":-1}');
    count_cards:=(c#>>'{album,cartasPorSobre}')::integer;
    FOR i IN 0..count_cards-1 LOOP
      card:=suizamente_private.v6_carta();
      INSERT INTO suizamente_private.suizamente_cartas(jugador_id,carta_id) VALUES(actor,card->>'id') ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS inserted=ROW_COUNT;
      coins:=CASE WHEN inserted=0 THEN (c#>>'{recompensas,cartaRepetida,monedas}')::integer ELSE 0 END;
      PERFORM suizamente_private.v3_anotar(actor,CASE WHEN inserted=0 THEN 'carta_repetida' ELSE 'carta' END,sid::text||':'||i,coins);
      UPDATE suizamente_private.suizamente_movimientos SET detalle=jsonb_build_object('carta',card->>'id') WHERE jugador_id=actor AND ref=sid::text||':'||i AND motivo IN('carta','carta_repetida');
      list:=list||jsonb_build_array(card||jsonb_build_object('nueva',inserted>0,'monedas',coins));
    END LOOP;
    INSERT INTO suizamente_private.suizamente_sobres(id,jugador_id,cartas) VALUES(sid,actor,list);
    PERFORM suizamente_private.v6_completar(actor);
    RETURN suizamente_private.v6_sobre_ver(sid,actor);
  ELSIF action IN ('sobre','girar_carta') THEN
    sid:=(body->>'id')::uuid;
    SELECT * INTO pack FROM suizamente_private.suizamente_sobres WHERE id=sid AND jugador_id=actor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'SZV2:404:Sobre no encontrado'; END IF;
    IF action='girar_carta' THEN
      IF (body->>'indice')::integer IS DISTINCT FROM pack.giradas OR pack.giradas>=jsonb_array_length(pack.cartas) THEN RAISE EXCEPTION 'SZV2:409:Esta carta ya está girada'; END IF;
      UPDATE suizamente_private.suizamente_sobres SET giradas=giradas+1 WHERE id=sid;
    END IF;
    RETURN suizamente_private.v6_sobre_ver(sid,actor);
  END IF;
  RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v6_victoria() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.ganador IS NOT NULL AND NEW.terminada_en IS NOT NULL THEN
    PERFORM suizamente_private.v5_cofre(NEW.ganador,'victoria',NEW.id::text,'Cofre de victoria',NEW.reglas#>'{cofres,victoria}');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS suizamente_cofre_victoria ON suizamente_private.suizamente_partidas;
CREATE TRIGGER suizamente_cofre_victoria AFTER UPDATE OF estado ON suizamente_private.suizamente_partidas
  FOR EACH ROW WHEN(NEW.estado NOT IN ('buscando','jugando')) EXECUTE FUNCTION suizamente_private.v6_victoria();
DO $$ DECLARE m record; BEGIN
  FOR m IN SELECT * FROM suizamente_private.suizamente_partidas WHERE ganador IS NOT NULL AND terminada_en IS NOT NULL LOOP
    PERFORM suizamente_private.v5_cofre(m.ganador,'victoria',m.id::text,'Cofre de victoria',m.reglas#>'{cofres,victoria}');
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v6_vincular(actor text,guest_actor text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO suizamente_private.suizamente_cartas SELECT actor,carta_id,primera_en FROM suizamente_private.suizamente_cartas WHERE jugador_id=guest_actor
    ON CONFLICT(jugador_id,carta_id) DO UPDATE SET primera_en=least(suizamente_cartas.primera_en,excluded.primera_en);
  UPDATE suizamente_private.suizamente_sobres SET jugador_id=actor WHERE jugador_id=guest_actor;
  PERFORM suizamente_private.v6_completar(actor);
END $$;
DO $hooks$ DECLARE definition text; BEGIN
  SELECT pg_get_functiondef('suizamente_private.v5_vincular(text,text)'::regprocedure) INTO definition;
  IF definition NOT LIKE '%v6_vincular(actor,guest_actor)%' THEN EXECUTE replace(definition,'END $function$','  PERFORM suizamente_private.v6_vincular(actor,guest_actor);'||chr(10)||'END $function$'); END IF;
END $hooks$;
DO $$ BEGIN
  IF to_regprocedure('suizamente_private.v5_api(text,jsonb,uuid,text)') IS NULL THEN
    ALTER FUNCTION public.suizamente_v2(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
    ALTER FUNCTION suizamente_private.suizamente_v2(text,jsonb,uuid,text) RENAME TO v5_api;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE data jsonb; identity jsonb; actor text; cid uuid;
BEGIN
  IF jsonb_typeof(coalesce(p_args,'{}'))<>'object' OR octet_length(coalesce(p_args,'{}')::text)>10000 THEN RAISE EXCEPTION 'SZV2:400:Solicitud no válida'; END IF;
  IF p_action IN ('album','abrir_sobre','sobre','girar_carta') THEN
    identity:=suizamente_private.v2_api_base('jugador','{}',p_guest_id,p_guest_token);actor:=identity->>'identidad';
    IF identity->'jugador'='null'::jsonb THEN RAISE EXCEPTION 'SZV2:404:Crea primero tu perfil'; END IF;
    data:=suizamente_private.v3_enriquecer(suizamente_private.v6_accion(p_action,actor,p_args),actor);
  ELSE
    data:=suizamente_private.v5_api(p_action,p_args,p_guest_id,p_guest_token);
    actor:=CASE WHEN auth.uid() IS NOT NULL THEN auth.uid()::text ELSE 'invitado-'||p_guest_id::text END;
  END IF;
  IF jsonb_typeof(data)='object' AND data->>'tuId' IS NOT NULL AND data->>'fase'='terminada' THEN
    SELECT id INTO cid FROM suizamente_private.suizamente_cofres WHERE jugador_id=actor AND tipo='victoria' AND ref=data->>'id';
    IF cid IS NOT NULL THEN data:=data||jsonb_build_object('cofre',suizamente_private.v5_cofre_ver(cid,actor)); END IF;
  END IF;
  RETURN data;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='suizamente_private' AND tablename IN('suizamente_cartas','suizamente_sobres') LOOP
    EXECUTE format('ALTER TABLE suizamente_private.%I ENABLE ROW LEVEL SECURITY',r.tablename);
    EXECUTE format('REVOKE ALL ON suizamente_private.%I FROM PUBLIC,anon,authenticated',r.tablename);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND (p.proname LIKE 'v6_%' OR p.proname='v5_api') LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||r.signature||' FROM PUBLIC,anon,authenticated'; END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
