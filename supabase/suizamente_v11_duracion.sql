-- Apply after the current data import and v10. Completes section 24.
BEGIN;
DO $$ BEGIN IF suizamente_private.v2_config()#>'{vueltasMapa,incrementoMultiplicador}' IS NULL OR suizamente_private.v2_config()#>'{vueltasMapa,premioMonedasPorVuelta}' IS NULL THEN RAISE EXCEPTION 'Apply the current suizamente_v2_datos.sql before v11';END IF;END $$;
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_vueltas(
 jugador_id text PRIMARY KEY REFERENCES suizamente_private.suizamente_jugadores ON DELETE CASCADE,
 vuelta integer NOT NULL DEFAULT 1 CHECK(vuelta>0)
);
ALTER TABLE suizamente_private.suizamente_asaltos ADD COLUMN IF NOT EXISTS vuelta_victima integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_misiones_dias(
 jugador_id text REFERENCES suizamente_private.suizamente_jugadores ON DELETE CASCADE,fecha date,cambios integer NOT NULL DEFAULT 0,
 PRIMARY KEY(jugador_id,fecha)
);
CREATE TABLE IF NOT EXISTS suizamente_private.suizamente_misiones(
 jugador_id text,fecha date,dificultad text,tipo text NOT NULL,categoria text,meta integer NOT NULL,
 texto text NOT NULL,premio jsonb NOT NULL,desde timestamptz NOT NULL,version integer NOT NULL DEFAULT 0,cobrada boolean NOT NULL DEFAULT false,
 PRIMARY KEY(jugador_id,fecha,dificultad),FOREIGN KEY(jugador_id,fecha) REFERENCES suizamente_private.suizamente_misiones_dias ON DELETE CASCADE
);
CREATE OR REPLACE FUNCTION suizamente_private.v11_vuelta(actor text) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT vuelta FROM suizamente_private.suizamente_vueltas WHERE jugador_id=actor),1)
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v11_marco(actor text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN v>1 THEN c#>ARRAY['vueltasMapa','vueltas',least(v-2,jsonb_array_length(c#>'{vueltasMapa,vueltas}')-1)::text] END
 FROM (SELECT suizamente_private.v11_vuelta(actor) v,suizamente_private.v2_config() c) s
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v11_factor(v integer) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (c#>>ARRAY['vueltasMapa','vueltas',least(v-1,n-1)::text,'multiplicadorCoste'])::numeric+
 greatest(0,v-n)*(c#>>'{vueltasMapa,incrementoMultiplicador}')::numeric
 FROM (SELECT c,jsonb_array_length(c#>'{vueltasMapa,vueltas}') n FROM (SELECT suizamente_private.v2_config() c) a) s
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v5_region(actor text) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb;idx integer:=0;c jsonb:=suizamente_private.v2_config();
BEGIN
 FOR r IN SELECT value FROM jsonb_array_elements(c#>'{mapa,regiones}') LOOP
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(r->'cantones') k LEFT JOIN suizamente_private.suizamente_mapa m
   ON m.jugador_id=actor AND m.vuelta=suizamente_private.v11_vuelta(actor) AND m.canton=k->>'id'
   WHERE coalesce(m.nivel,0)<(c#>>'{mapa,nivelesPorCanton}')::integer) THEN RETURN idx;END IF;
  idx:=idx+1;
 END LOOP;RETURN idx;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v11_coste(base numeric,v integer) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb:=suizamente_private.v10_config_base();round_to numeric:=(c#>>'{mapa,coste,redondeo}')::numeric;price numeric;
BEGIN
 price:=round(base*suizamente_private.v11_factor(v)/round_to)*round_to;
 IF suizamente_private.v10_activo()->>'tipo'='obras' THEN price:=round(price*(c#>>'{eventosFinDeSemana,efectos,obras,multiplicadorCoste}')::numeric);END IF;
 RETURN price::integer;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v5_mapa(actor text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('region',suizamente_private.v5_region(actor),'vuelta',v,'multiplicador',suizamente_private.v11_factor(v),
 'estilo',c#>ARRAY['vueltasMapa','vueltas',least(v-1,jsonb_array_length(c#>'{vueltasMapa,vueltas}')-1)::text],
 'niveles',coalesce((SELECT jsonb_object_agg(canton,nivel) FROM suizamente_private.suizamente_mapa WHERE jugador_id=actor AND vuelta=v),'{}'),
 'costes',(SELECT jsonb_object_agg(k->>'id',(SELECT jsonb_agg(suizamente_private.v11_coste((x#>>'{}')::numeric,v) ORDER BY n) FROM jsonb_array_elements(k->'costes') WITH ORDINALITY a(x,n)))
  FROM jsonb_array_elements(c#>'{mapa,regiones}') r CROSS JOIN LATERAL jsonb_array_elements(r->'cantones') k),
 'cofres',coalesce((SELECT jsonb_agg(suizamente_private.v5_cofre_ver(id,actor) ORDER BY creado_en) FROM suizamente_private.suizamente_cofres WHERE jugador_id=actor AND abierto_en IS NULL),'[]'))
 FROM(SELECT suizamente_private.v11_vuelta(actor) v,suizamente_private.v10_config_base() c) s
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v11_construir(actor text,body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb:=suizamente_private.v10_config_base();v integer;reg integer;lvl integer;k jsonb;cost integer;cid uuid;key text:=body->>'clave';finished jsonb;
BEGIN
 PERFORM 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor FOR UPDATE;
 v:=suizamente_private.v11_vuelta(actor);reg:=suizamente_private.v5_region(actor);
 IF coalesce(key,'')!~'^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'SZV2:400:Construcción no válida';END IF;
 IF body ? 'vuelta' AND (body->>'vuelta')::integer IS DISTINCT FROM v THEN RAISE EXCEPTION 'SZV2:409:Tu vuelta ha cambiado. Actualiza el mapa';END IF;
 IF EXISTS(SELECT 1 FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='construccion' AND ref=key) THEN RAISE EXCEPTION 'SZV2:409:Esta construcción ya está hecha';END IF;
 SELECT value INTO k FROM jsonb_array_elements(c#>ARRAY['mapa','regiones',reg::text,'cantones']) WHERE value->>'id'=body->>'canton';
 IF k IS NULL THEN RAISE EXCEPTION 'SZV2:409:Construye en tu región actual';END IF;
 SELECT coalesce((SELECT nivel FROM suizamente_private.suizamente_mapa WHERE jugador_id=actor AND vuelta=v AND canton=k->>'id'),0) INTO lvl;
 IF (body->>'nivel')::integer IS DISTINCT FROM lvl OR lvl>=(c#>>'{mapa,nivelesPorCanton}')::integer THEN RAISE EXCEPTION 'SZV2:409:El nivel del cantón ha cambiado';END IF;
 cost:=suizamente_private.v11_coste((k->'costes'->>lvl)::numeric,v);
 PERFORM suizamente_private.v3_anotar(actor,'construccion',key,-cost);
 UPDATE suizamente_private.suizamente_movimientos SET detalle=jsonb_build_object('canton',k->>'id','vuelta',v,'nivel',lvl+1) WHERE jugador_id=actor AND motivo='construccion' AND ref=key;
 INSERT INTO suizamente_private.suizamente_mapa VALUES(actor,v,k->>'id',lvl+1) ON CONFLICT(jugador_id,vuelta,canton) DO UPDATE SET nivel=excluded.nivel;
 IF suizamente_private.v5_region(actor)>reg THEN cid:=suizamente_private.v5_cofre(actor,'region',v||':'||reg,'¡'||(c#>>ARRAY['mapa','regiones',reg::text,'nombre'])||' completa!',c#>'{cofres,region}');END IF;
 IF suizamente_private.v5_region(actor)=jsonb_array_length(c#>'{mapa,regiones}') THEN
  PERFORM suizamente_private.v3_anotar(actor,'vuelta',v::text,v*(c#>>'{vueltasMapa,premioMonedasPorVuelta}')::integer);
  INSERT INTO suizamente_private.suizamente_vueltas VALUES(actor,v+1) ON CONFLICT(jugador_id) DO UPDATE SET vuelta=excluded.vuelta;
  finished:=jsonb_build_object('vuelta',v,'monedas',v*(c#>>'{vueltasMapa,premioMonedasPorVuelta}')::integer);
 END IF;
 PERFORM suizamente_private.v3_logros(actor);
 RETURN suizamente_private.v5_mapa(actor)||jsonb_build_object('vueltaCompleta',finished,'cofre',CASE WHEN cid IS NOT NULL THEN suizamente_private.v5_cofre_ver(cid,actor) END);
END $$;
-- Bind raids to the victim's actual lap, including the offer's immutable snapshot.
CREATE OR REPLACE FUNCTION suizamente_private.v11_asalto_vuelta() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN NEW.vuelta_victima:=suizamente_private.v11_vuelta(NEW.victima);RETURN NEW;END $$;
DROP TRIGGER IF EXISTS suizamente_asalto_vuelta ON suizamente_private.suizamente_asaltos;
CREATE TRIGGER suizamente_asalto_vuelta BEFORE INSERT ON suizamente_private.suizamente_asaltos FOR EACH ROW EXECUTE FUNCTION suizamente_private.v11_asalto_vuelta();
DO $$ DECLARE d text;BEGIN
 SELECT pg_get_functiondef('suizamente_private.v5_ofrecer(uuid,integer)'::regprocedure) INTO d;
 IF strpos(d,'t.vuelta=1')>0 THEN EXECUTE replace(d,'t.vuelta=1','t.vuelta=suizamente_private.v11_vuelta(p.jugador_id)');END IF;
 SELECT pg_get_functiondef('suizamente_private.v5_asalto_responder(uuid,text,integer,boolean)'::regprocedure) INTO d;
 IF strpos(d,'vuelta=1')>0 THEN
  d:=replace(d,'vuelta=1','vuelta=a.vuelta_victima');
  d:=replace(d,'a.victima IS NULL OR a.victima=actor','a.victima IS NULL OR a.victima=actor OR suizamente_private.v11_vuelta(a.victima)<>a.vuelta_victima');EXECUTE d;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v11_mes(t timestamptz DEFAULT clock_timestamp()) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT to_char(t AT TIME ZONE 'Europe/Zurich','YYYY-MM') $$;
CREATE OR REPLACE FUNCTION suizamente_private.v6_colecciones() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(value ORDER BY (value->>'id')::integer),'[]') FROM suizamente_private.suizamente_configuracion,
 LATERAL jsonb_array_elements(album->'colecciones') WHERE value->>'mes' IS NULL OR value->>'mes'<=suizamente_private.v11_mes()
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v6_carta() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE rarity integer;roll numeric:=random();cumulative numeric:=0;r record;card jsonb;monthly boolean;
BEGIN
 FOR r IN SELECT key,value FROM jsonb_each_text(suizamente_private.v2_config()#>'{album,pesoRareza}') ORDER BY key::integer LOOP cumulative:=cumulative+r.value::numeric;IF roll<cumulative THEN rarity:=r.key::integer;EXIT;END IF;END LOOP;
 monthly:=random()<(suizamente_private.v2_config()#>>'{coleccionDelMes,probabilidadEnSobres}')::numeric;
 SELECT k||jsonb_build_object('coleccion',c->>'nombre','coleccionId',(c->>'id')::integer) INTO card
 FROM jsonb_array_elements(suizamente_private.v6_colecciones()) c CROSS JOIN LATERAL jsonb_array_elements(c->'cartas') k
 WHERE (k->>'r')::integer=rarity ORDER BY ((coalesce(c->>'mes','')=suizamente_private.v11_mes())=monthly) DESC,random() LIMIT 1;
 IF card IS NULL THEN RAISE EXCEPTION 'SZV2:503:No hay cartas para esa rareza';END IF;RETURN card;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v11_mision_elegir(actor text,d date,diff text,changed boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb:=suizamente_private.v2_config();kind jsonb;cat jsonb;target integer;
BEGIN
 SELECT value INTO kind FROM jsonb_array_elements(c#>'{misiones,tipos}') WHERE value->'n' ? diff AND NOT EXISTS(
  SELECT 1 FROM suizamente_private.suizamente_misiones m WHERE m.jugador_id=actor AND m.fecha=d AND m.tipo=value->>'id')
 ORDER BY md5(actor||d||diff||changed||(value->>'id')) LIMIT 1;
 IF kind IS NULL THEN RAISE EXCEPTION 'SZV2:503:No hay una misión disponible';END IF;
 SELECT value INTO cat FROM jsonb_array_elements(c->'categorias') ORDER BY md5(actor||d||diff||(value->>'id')) LIMIT 1;
 target:=(kind#>>ARRAY['n',diff])::integer;
 INSERT INTO suizamente_private.suizamente_misiones(jugador_id,fecha,dificultad,tipo,categoria,meta,texto,premio,desde)
 VALUES(actor,d,diff,kind->>'id',CASE WHEN kind->>'id'='aciertos' THEN cat->>'id' END,target,
 replace(replace(kind->>'texto','{n}',target::text),'{categoria}',cat->>'nombre'),c#>ARRAY['misiones','premios',diff],CASE WHEN changed THEN clock_timestamp() ELSE d::timestamp AT TIME ZONE 'Europe/Zurich' END)
 ON CONFLICT(jugador_id,fecha,dificultad) DO UPDATE SET tipo=excluded.tipo,categoria=excluded.categoria,meta=excluded.meta,texto=excluded.texto,desde=excluded.desde,version=suizamente_misiones.version+1;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v11_misiones_preparar(actor text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE day date:=suizamente_private.v7_hoy();diff text;
BEGIN
 PERFORM 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor FOR UPDATE;IF NOT FOUND THEN RETURN;END IF;
 INSERT INTO suizamente_private.suizamente_misiones_dias VALUES(actor,day,0) ON CONFLICT DO NOTHING;
 FOREACH diff IN ARRAY ARRAY['facil','media','dificil'] LOOP
  IF NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_misiones WHERE jugador_id=actor AND fecha=day AND dificultad=diff) THEN PERFORM suizamente_private.v11_mision_elegir(actor,day,diff);END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v11_mision_progreso(m suizamente_private.suizamente_misiones) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;until_at timestamptz:=(m.fecha+1)::timestamp AT TIME ZONE 'Europe/Zurich';reason text;
BEGIN
 IF m.tipo='aciertos' THEN SELECT count(*) INTO n FROM suizamente_private.suizamente_partida_preguntas WHERE jugador_id=m.jugador_id AND categoria=m.categoria AND acierto AND NOT omitida AND respondida_en>=m.desde AND respondida_en<until_at;
 ELSIF m.tipo='seguidas' THEN
  SELECT coalesce(max(n_ok),0) INTO n FROM(SELECT count(*) FILTER(WHERE acierto) n_ok FROM(
   SELECT acierto,sum(CASE WHEN acierto THEN 0 ELSE 1 END) OVER(ORDER BY respondida_en,partida_id,suizamente_partida_preguntas.n) g FROM suizamente_private.suizamente_partida_preguntas
   WHERE jugador_id=m.jugador_id AND NOT omitida AND respondida_en>=m.desde AND respondida_en<until_at) a GROUP BY g) b;
 ELSE
  reason:=CASE m.tipo WHEN 'sellos' THEN 'sello_ganado' WHEN 'ganar' THEN 'partida_ganada' WHEN 'duelo' THEN 'duelo_sello' WHEN 'construir' THEN 'construccion' WHEN 'sobres' THEN 'sobre' WHEN 'dia' THEN 'pregunta_dia' WHEN 'turnos' THEN 'turno_jugado' END;
  SELECT count(*) INTO n FROM suizamente_private.suizamente_movimientos WHERE jugador_id=m.jugador_id AND (motivo=reason OR (m.tipo='sellos' AND motivo='duelo_sello')) AND creado_en>=m.desde AND creado_en<until_at;
 END IF;RETURN least(m.meta,coalesce(n,0));
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v11_misiones_cobrar(actor text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m suizamente_private.suizamente_misiones;d date:=suizamente_private.v7_hoy();
BEGIN
 FOR m IN SELECT * FROM suizamente_private.suizamente_misiones WHERE jugador_id=actor AND fecha=d AND NOT cobrada FOR UPDATE LOOP
  IF suizamente_private.v11_mision_progreso(m)>=m.meta THEN
   IF suizamente_private.v3_anotar(actor,'mision',d||':'||m.dificultad||':'||m.version,(m.premio->>'monedas')::integer,0,m.premio-'monedas') THEN
    PERFORM suizamente_private.v7_notificar(actor,'mision',d||':'||m.dificultad||':'||m.version,'🎯 Misión cumplida: '||m.texto||' · 🪙 +'||(m.premio->>'monedas'),'/suizamente/misiones');END IF;
   UPDATE suizamente_private.suizamente_misiones SET cobrada=true WHERE jugador_id=actor AND fecha=d AND dificultad=m.dificultad;
  END IF;
 END LOOP;
 IF (SELECT count(*) FROM suizamente_private.suizamente_misiones WHERE jugador_id=actor AND fecha=d AND cobrada)=(suizamente_private.v2_config()#>>'{misiones,porDia}')::integer THEN
  PERFORM suizamente_private.v5_cofre(actor,'misiones',d::text,'Cofre diario',suizamente_private.v2_config()#>'{misiones,cofreDiario}');END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v11_misiones_ver(actor text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('fecha',d,'misiones',(SELECT jsonb_agg(to_jsonb(m)-'jugador_id'||jsonb_build_object('avance',suizamente_private.v11_mision_progreso(m)) ORDER BY CASE dificultad WHEN 'facil' THEN 1 WHEN 'media' THEN 2 ELSE 3 END)
 FROM suizamente_private.suizamente_misiones m WHERE jugador_id=actor AND fecha=d),'cambiosRestantes',
 (suizamente_private.v2_config()#>>'{misiones,cambiosPorDia}')::integer-coalesce((SELECT cambios FROM suizamente_private.suizamente_misiones_dias WHERE jugador_id=actor AND fecha=d),0),
 'cofre',(SELECT suizamente_private.v5_cofre_ver(id,actor) FROM suizamente_private.suizamente_cofres WHERE jugador_id=actor AND tipo='misiones' AND ref=d::text))
 FROM(SELECT suizamente_private.v7_hoy() d) s
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v11_turno() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.turnos_jugados>OLD.turnos_jugados AND EXISTS(SELECT 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=OLD.turno) THEN
  PERFORM suizamente_private.v3_anotar(OLD.turno,'turno_jugado',NEW.id||':'||NEW.turnos_jugados);
  IF NEW.turnos_jugados-OLD.turnos_jugados=2 THEN
   PERFORM suizamente_private.v3_anotar(CASE WHEN OLD.turno=OLD.jugador_a THEN OLD.jugador_b ELSE OLD.jugador_a END,'turno_jugado',NEW.id||':'||NEW.turnos_jugados);
  END IF;
 END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS suizamente_turno_jugado ON suizamente_private.suizamente_partidas;
CREATE TRIGGER suizamente_turno_jugado AFTER UPDATE OF turnos_jugados ON suizamente_private.suizamente_partidas FOR EACH ROW EXECUTE FUNCTION suizamente_private.v11_turno();
DO $$ BEGIN
 IF to_regprocedure('suizamente_private.v11_logros_base(text)') IS NULL THEN ALTER FUNCTION suizamente_private.v3_logros(text) RENAME TO v11_logros_base;END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v3_logros(actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb:=suizamente_private.v11_logros_base(actor);a jsonb;n integer;inserted integer;
BEGIN
 FOR a IN SELECT value FROM jsonb_array_elements(suizamente_private.v2_config()->'logros') WHERE value->>'id' IN('suiza_oro','cumbre','misiones') LOOP
  n:=CASE a->>'id' WHEN 'suiza_oro' THEN greatest(0,suizamente_private.v11_vuelta(actor)-1) WHEN 'cumbre' THEN CASE WHEN EXISTS(SELECT 1 FROM suizamente_private.suizamente_logros WHERE jugador_id=actor AND logro='cumbre') THEN 1 ELSE 0 END ELSE
    (SELECT count(*) FROM(SELECT fecha FROM suizamente_private.suizamente_misiones WHERE jugador_id=actor AND cobrada GROUP BY fecha HAVING count(*)=(suizamente_private.v2_config()#>>'{misiones,porDia}')::integer) s) END;
  IF n>=(a->>'meta')::integer THEN INSERT INTO suizamente_private.suizamente_logros(jugador_id,logro) VALUES(actor,a->>'id') ON CONFLICT DO NOTHING;GET DIAGNOSTICS inserted=ROW_COUNT;
   IF inserted>0 THEN PERFORM suizamente_private.v7_notificar(actor,'logro',a->>'id','🏅 Logro nuevo: '||(a->>'nombre'),'/suizamente/logros');END IF;END IF;
  result:=result||jsonb_build_array(a||jsonb_build_object('avance',least(n,(a->>'meta')::integer),'conseguido',EXISTS(SELECT 1 FROM suizamente_private.suizamente_logros WHERE jugador_id=actor AND logro=a->>'id'),'conseguidoEn',(SELECT conseguido_en FROM suizamente_private.suizamente_logros WHERE jugador_id=actor AND logro=a->>'id')));
 END LOOP;RETURN result;
END $$;
DO $$ BEGIN
 IF to_regprocedure('suizamente_private.v11_resultado_base(text,text)') IS NULL THEN ALTER FUNCTION suizamente_private.v7_resultado(text,text) RENAME TO v11_resultado_base;END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_resultado(actor text,pid text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT suizamente_private.v11_resultado_base(actor,pid)||jsonb_build_object('total',(SELECT count(*) FROM suizamente_private.suizamente_votos WHERE pregunta_id=pid))
$$;
CREATE OR REPLACE FUNCTION suizamente_private.v11_liga(actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w date:=suizamente_private.v7_semana();own suizamente_private.suizamente_liga_miembros;c jsonb:=suizamente_private.v2_config();rows jsonb;
BEGIN
 SELECT * INTO own FROM suizamente_private.suizamente_liga_miembros WHERE semana=w AND jugador_id=actor;
 SELECT coalesce(jsonb_agg(r||jsonb_build_object('tu',r->>'id'=actor,'color',j.color,'nivel',suizamente_private.v2_nivel(j.xp),'marco',suizamente_private.v11_marco(j.jugador_id)) ORDER BY (r->>'puesto')::integer),'[]') INTO rows
 FROM jsonb_array_elements(suizamente_private.v10_liga_filas(w)) r JOIN suizamente_private.suizamente_jugadores j ON j.jugador_id=r->>'id'
 WHERE r->>'division'=own.division AND (r->>'grupo')::integer=own.grupo AND j.en_ranking AND NOT (r->>'excluido')::boolean;
 RETURN jsonb_build_object('semana',w,'fin',(w+7)::timestamp AT TIME ZONE 'Europe/Zurich','filas',rows,'grupo',own.grupo,
 'division',coalesce(own.division,(SELECT division FROM suizamente_private.suizamente_liga_estado WHERE jugador_id=actor),'pradera'),'reglas',coalesce((SELECT reglas FROM suizamente_private.suizamente_liga_semanas WHERE semana=w),c->'ligas'));
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v11_vincular_duracion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text:=auth.uid()::text;
BEGIN
 IF OLD.jugador_id LIKE 'invitado-%' AND actor IS NOT NULL AND EXISTS(SELECT 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor) THEN
  INSERT INTO suizamente_private.suizamente_vueltas SELECT actor,vuelta FROM suizamente_private.suizamente_vueltas WHERE jugador_id=OLD.jugador_id
   ON CONFLICT(jugador_id) DO UPDATE SET vuelta=greatest(suizamente_vueltas.vuelta,excluded.vuelta);
  INSERT INTO suizamente_private.suizamente_misiones_dias SELECT actor,fecha,cambios FROM suizamente_private.suizamente_misiones_dias WHERE jugador_id=OLD.jugador_id
   ON CONFLICT(jugador_id,fecha) DO UPDATE SET cambios=greatest(suizamente_misiones_dias.cambios,excluded.cambios);
  INSERT INTO suizamente_private.suizamente_misiones SELECT actor,fecha,dificultad,tipo,categoria,meta,texto,premio,desde,version,cobrada FROM suizamente_private.suizamente_misiones WHERE jugador_id=OLD.jugador_id
   ON CONFLICT(jugador_id,fecha,dificultad) DO UPDATE SET tipo=excluded.tipo,categoria=excluded.categoria,meta=excluded.meta,texto=excluded.texto,premio=excluded.premio,desde=excluded.desde,version=excluded.version,cobrada=true
   WHERE excluded.cobrada AND NOT suizamente_misiones.cobrada;
 END IF;RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS suizamente_vincular_duracion ON suizamente_private.suizamente_jugadores;
CREATE TRIGGER suizamente_vincular_duracion BEFORE DELETE ON suizamente_private.suizamente_jugadores FOR EACH ROW EXECUTE FUNCTION suizamente_private.v11_vincular_duracion();
DO $$ BEGIN
 IF to_regprocedure('suizamente_private.v11_persona_base(text)') IS NULL THEN ALTER FUNCTION suizamente_private.v7_persona(text) RENAME TO v11_persona_base;END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v7_persona(pid text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT suizamente_private.v11_persona_base(pid)||jsonb_build_object('marco',suizamente_private.v11_marco(pid)) $$;
DO $$ BEGIN
 IF to_regprocedure('suizamente_private.v11_api_base(text,jsonb,uuid,text)') IS NULL THEN
  ALTER FUNCTION public.suizamente_v2(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
  ALTER FUNCTION suizamente_private.suizamente_v2(text,jsonb,uuid,text) RENAME TO v11_api_base;END IF;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;answer jsonb;actor text;identity jsonb;m suizamente_private.suizamente_misiones;d date:=suizamente_private.v7_hoy();custom boolean:=p_action IN('misiones','cambiar_mision','liga','vuelta','construir');previous text;
BEGIN
 IF p_action IN('admin','config','capacidades') THEN
  IF p_action='admin' THEN
   IF NOT suizamente_private.v7_admin() THEN RAISE EXCEPTION 'SZV2:403:Solo administración de Latido';END IF;
   IF p_args->>'ruta'='economia' AND p_args->>'metodo'='PUT' AND (
    (p_args#>>'{juego,mapa,coste,redondeo}')::numeric<=0
    OR (p_args#>>'{juego,misiones,porDia}')::integer<>3
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_args#>'{juego,misiones,tipos}') t CROSS JOIN LATERAL jsonb_each(t->'n') n WHERE (n.value#>>'{}')::numeric<1))
    THEN RAISE EXCEPTION 'SZV2:400:Revisa las metas y el redondeo; las tres dificultades requieren migración';END IF;
  END IF;
  result:=suizamente_private.v11_api_base(p_action,p_args,p_guest_id,p_guest_token);
  IF p_action='config' THEN result:=result||jsonb_build_object('misiones',suizamente_private.v2_config()->'misiones','ligas',suizamente_private.v2_config()->'ligas','vueltasMapa',suizamente_private.v2_config()->'vueltasMapa');END IF;RETURN result;
 END IF;
 IF jsonb_typeof(coalesce(p_args,'{}'))<>'object' OR octet_length(p_args::text)>20000 THEN RAISE EXCEPTION 'SZV2:400:Solicitud no válida';END IF;
 actor:=auth.uid()::text;
 IF actor IS NULL OR custom THEN identity:=suizamente_private.v11_api_base('jugador','{}',p_guest_id,p_guest_token);actor:=identity->>'identidad';END IF;
 PERFORM suizamente_private.v11_misiones_preparar(actor);
 IF custom THEN
  IF identity->'jugador' IS NULL OR identity->'jugador'='null'::jsonb THEN RAISE EXCEPTION 'SZV2:404:Crea primero tu perfil';END IF;
  IF p_action IN('cambiar_mision','construir') AND EXISTS(SELECT 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor AND (bloqueado OR renombrar)) THEN RAISE EXCEPTION 'SZV2:403:Revisa el estado de tu perfil';END IF;
  IF p_action='construir' THEN previous:=coalesce(current_setting('suizamente.eventos',true),'off');PERFORM set_config('suizamente.eventos','on',true);result:=suizamente_private.v11_construir(actor,p_args);PERFORM set_config('suizamente.eventos',previous,true);
  ELSIF p_action='vuelta' THEN SELECT jsonb_build_object('vuelta',ref::integer,'monedas',monedas,'marco',suizamente_private.v11_marco(actor)) INTO result FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='vuelta' AND ref=p_args->>'vuelta';IF result IS NULL THEN RAISE EXCEPTION 'SZV2:404:Vuelta no encontrada';END IF;
  ELSIF p_action='cambiar_mision' THEN
   PERFORM suizamente_private.v11_misiones_cobrar(actor);
   SELECT * INTO m FROM suizamente_private.suizamente_misiones WHERE jugador_id=actor AND fecha=d AND dificultad=p_args->>'dificultad' FOR UPDATE;
   IF NOT FOUND OR m.cobrada OR m.version IS DISTINCT FROM (p_args->>'version')::integer OR (SELECT cambios FROM suizamente_private.suizamente_misiones_dias WHERE jugador_id=actor AND fecha=d)>=(suizamente_private.v2_config()#>>'{misiones,cambiosPorDia}')::integer THEN RAISE EXCEPTION 'SZV2:409:Esta misión ya no se puede cambiar';END IF;
   PERFORM suizamente_private.v11_mision_elegir(actor,d,m.dificultad,true);
   UPDATE suizamente_private.suizamente_misiones_dias SET cambios=cambios+1 WHERE jugador_id=actor AND fecha=d;
  END IF;
 ELSIF p_action='comprar' AND EXISTS(SELECT 1 FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='compra' AND ref=p_args->>'clave') THEN
  IF NOT EXISTS(SELECT 1 FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='compra' AND ref=p_args->>'clave' AND inventario ? (CASE p_args->>'articulo' WHEN 'sobre' THEN 'sobres' WHEN 'escudo' THEN 'escudos' ELSE p_args->>'articulo' END)) THEN RAISE EXCEPTION 'SZV2:409:La clave pertenece a otra compra';END IF;
  result:=suizamente_private.v11_api_base('jugador','{}',p_guest_id,p_guest_token)||jsonb_build_object('comprado',p_args->>'articulo','recuperada',true);
 ELSE result:=suizamente_private.v11_api_base(p_action,p_args,p_guest_id,p_guest_token);END IF;
 IF EXISTS(SELECT 1 FROM suizamente_private.suizamente_jugadores WHERE jugador_id=actor) THEN
  PERFORM suizamente_private.v11_misiones_preparar(actor);PERFORM suizamente_private.v11_misiones_cobrar(actor);
  IF p_action IN('misiones','cambiar_mision') THEN result:=suizamente_private.v11_misiones_ver(actor);END IF;
  IF p_action='liga' THEN result:=suizamente_private.v11_liga(actor);END IF;
  IF result IS NOT NULL AND jsonb_typeof(result)<>'object' THEN RETURN result;END IF;
  IF p_action LIKE 'asalto%' AND result->'resultado'<>'null'::jsonb THEN
   result:=jsonb_set(result,'{resultado,preguntaId}',(SELECT payload->'id' FROM suizamente_private.suizamente_asaltos WHERE id=(result->>'id')::uuid AND jugador_id=actor));
  END IF;
  answer:=result->'resultado';result:=coalesce(result,'{}')||jsonb_build_object('marco',suizamente_private.v11_marco(actor));
  result:=suizamente_private.v3_enriquecer(result,actor);result:=suizamente_private.v7_enriquecer(result,actor);
  IF answer IS NOT NULL THEN result:=jsonb_set(result,'{resultado}',answer);END IF;
  previous:=coalesce(current_setting('suizamente.eventos',true),'off');PERFORM set_config('suizamente.eventos','on',true);
  result:=result||jsonb_build_object('mapa',suizamente_private.v5_mapa(actor));PERFORM set_config('suizamente.eventos',previous,true);
  IF p_action='partidas' THEN result:=jsonb_set(result,'{partidas}',(SELECT coalesce(jsonb_agg(item||jsonb_build_object('terminadaEn',game.terminada_en) ORDER BY ord),'[]') FROM jsonb_array_elements(result->'partidas') WITH ORDINALITY a(item,ord) JOIN suizamente_private.suizamente_partidas game ON game.id=(item->>'id')::uuid));END IF;
  IF p_action='album' THEN result:=result||jsonb_build_object('mes',suizamente_private.v11_mes());END IF;
 END IF;RETURN result;
END $$;
DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='suizamente_private' AND tablename IN('suizamente_vueltas','suizamente_misiones','suizamente_misiones_dias') LOOP
  EXECUTE format('ALTER TABLE suizamente_private.%I ENABLE ROW LEVEL SECURITY',r.tablename);EXECUTE format('REVOKE ALL ON suizamente_private.%I FROM PUBLIC,anon,authenticated',r.tablename);END LOOP;
 FOR r IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND (p.proname LIKE 'v11_%' OR p.proname IN('v3_logros','v5_region','v5_mapa','v6_carta','v6_colecciones','v7_persona','v7_resultado')) LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||r.sig||' FROM PUBLIC,anon,authenticated';END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
