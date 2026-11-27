BEGIN;
CREATE TABLE IF NOT EXISTS suizamente_private.misterios(
 fecha date PRIMARY KEY,payload jsonb NOT NULL CHECK(jsonb_array_length(payload->'opciones')=4 AND jsonb_array_length(payload->'pistas')=3)
);
CREATE TABLE IF NOT EXISTS suizamente_private.misterio_intentos(
 persona text NOT NULL REFERENCES suizamente_private.suizamente_jugadores(jugador_id) ON DELETE CASCADE,
 fecha date NOT NULL REFERENCES suizamente_private.misterios,pistas_abiertas integer NOT NULL DEFAULT 1,fallos smallint[] NOT NULL DEFAULT '{}',
 resuelto boolean NOT NULL DEFAULT false,terminado boolean NOT NULL DEFAULT false,premio jsonb NOT NULL DEFAULT '{}',
 finalizado timestamptz,PRIMARY KEY(persona,fecha)
);
ALTER TABLE suizamente_private.misterios ENABLE ROW LEVEL SECURITY;
ALTER TABLE suizamente_private.misterio_intentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON suizamente_private.misterios,suizamente_private.misterio_intentos FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION suizamente_private.mej_misterio_racha(actor text,hoy date) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE d date;total integer:=0;
BEGIN
 SELECT max(fecha) INTO d FROM suizamente_private.misterio_intentos WHERE persona=actor AND resuelto AND fecha<=hoy;
 IF d IS NULL OR d<hoy-1 THEN RETURN 0;END IF;
 WHILE EXISTS(SELECT 1 FROM suizamente_private.misterio_intentos WHERE persona=actor AND fecha=d AND resuelto) LOOP total:=total+1;d:=d-1;END LOOP;
 RETURN total;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_misterio_vista(actor text,hoy date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE m jsonb;i suizamente_private.misterio_intentos;responses integer;solved integer;
BEGIN

 SELECT payload INTO m FROM suizamente_private.misterios WHERE fecha=hoy;
 IF NOT FOUND THEN RETURN jsonb_build_object('disponible',false);END IF;
 SELECT * INTO i FROM suizamente_private.misterio_intentos WHERE persona=actor AND fecha=hoy;
 SELECT count(*),count(*) FILTER(WHERE resuelto) INTO responses,solved FROM suizamente_private.misterio_intentos WHERE fecha=hoy AND terminado;
 RETURN jsonb_build_object('disponible',true,'fecha',hoy,'tipo',m->>'tipo','imagen',m->'silueta','pregunta',m->>'pregunta',
 'pistas',(SELECT jsonb_agg(value ORDER BY n) FROM jsonb_array_elements(m->'pistas') WITH ORDINALITY p(value,n) WHERE n<=coalesce(i.pistas_abiertas,1)),
 'opciones',(SELECT jsonb_agg(jsonb_build_object('indice',n-1,'t',value) ORDER BY n) FROM jsonb_array_elements(m->'opciones') WITH ORDINALITY p(value,n)),
 'falladas',coalesce(i.fallos,'{}'::smallint[]),'pistasAbiertas',coalesce(i.pistas_abiertas,1),'resuelto',coalesce(i.resuelto,false),'terminado',coalesce(i.terminado,false),
 'premio',i.premio,'racha',suizamente_private.mej_misterio_racha(actor,hoy),'servidorAhora',clock_timestamp(),'siguiente',(hoy+1)::timestamp AT TIME ZONE 'Europe/Zurich')
 ||CASE WHEN i.terminado THEN jsonb_build_object('correcta',m->'correcta','solucion',m#>>ARRAY['opciones',m->>'correcta'],'dato',m->>'dato',
 'porcentaje',CASE WHEN responses>=(suizamente_private.v2_config()->>'minimoVotosParaPorcentajes')::integer THEN round(solved*100.0/responses) ELSE NULL END) ELSE '{}'::jsonb END;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.mej_misterio(actor text,action text,args jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE hoy date:=(clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date;m jsonb;i suizamente_private.misterio_intentos;opt integer;ok boolean;rules jsonb:=suizamente_private.mej_config()->'misterio';coins integer;
BEGIN
 IF action IN('avisos','avisos_guardar') THEN
  INSERT INTO suizamente_private.mejoras_ajustes(persona) VALUES(actor) ON CONFLICT DO NOTHING;
  IF action='avisos_guardar' THEN
   IF jsonb_typeof(args->'misterio') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'SZV2:400:Ajustes no válidos';END IF;
   UPDATE suizamente_private.mejoras_ajustes SET misterio=(args->>'misterio')::boolean WHERE persona=actor;
  END IF;
  RETURN (SELECT jsonb_build_object('misterio',misterio) FROM suizamente_private.mejoras_ajustes WHERE persona=actor);
 END IF;
 SELECT payload INTO m FROM suizamente_private.misterios WHERE fecha=hoy;
 IF NOT FOUND THEN RETURN jsonb_build_object('disponible',false);END IF;
 INSERT INTO suizamente_private.misterio_intentos(persona,fecha) VALUES(actor,hoy) ON CONFLICT DO NOTHING;
 SELECT * INTO i FROM suizamente_private.misterio_intentos WHERE persona=actor AND fecha=hoy FOR UPDATE;
 IF i.terminado OR action='hoy' THEN RETURN suizamente_private.mej_misterio_vista(actor,hoy);END IF;
 IF args->>'fecha' IS DISTINCT FROM hoy::text THEN RAISE EXCEPTION 'SZV2:409:Ha empezado un misterio nuevo. Vuelve a abrirlo';END IF;
 IF action='pista' THEN
  IF (args->>'pista')::integer>i.pistas_abiertas+1 OR (args->>'pista')::integer>(rules->>'pistas')::integer THEN RAISE EXCEPTION 'SZV2:400:Abre primero la pista anterior';END IF;
  UPDATE suizamente_private.misterio_intentos SET pistas_abiertas=greatest(pistas_abiertas,(args->>'pista')::integer) WHERE persona=actor AND fecha=hoy;
 ELSIF action='respuesta' THEN
  IF NOT coalesce(args->>'opcion','') ~ '^[0-9]+$' OR (args->>'opcion')::integer>=jsonb_array_length(m->'opciones') THEN RAISE EXCEPTION 'SZV2:400:Opción no válida';END IF;
  opt:=(args->>'opcion')::integer;
  IF opt=ANY(i.fallos) THEN RAISE EXCEPTION 'SZV2:409:Ya probaste esa opción';END IF;
  ok:=opt=(m->>'correcta')::integer;
  IF ok THEN
   coins:=(rules->'monedasPorPistas'->>(i.pistas_abiertas-1))::integer;
   PERFORM suizamente_private.v3_anotar(actor,'misterio',hoy::text,coins,(rules->>'xp')::integer);
   UPDATE suizamente_private.misterio_intentos SET resuelto=true,terminado=true,finalizado=clock_timestamp(),premio=jsonb_build_object('monedas',coins,'xp',(rules->>'xp')::integer) WHERE persona=actor AND fecha=hoy;
   PERFORM suizamente_private.v3_actividad(actor,clock_timestamp());
  ELSE
   UPDATE suizamente_private.misterio_intentos SET fallos=array_append(fallos,opt::smallint),terminado=i.pistas_abiertas>=(rules->>'pistas')::integer,
   finalizado=CASE WHEN i.pistas_abiertas>=(rules->>'pistas')::integer THEN clock_timestamp() END,pistas_abiertas=least(i.pistas_abiertas+1,(rules->>'pistas')::integer) WHERE persona=actor AND fecha=hoy;
  END IF;
 END IF;
 RETURN suizamente_private.mej_misterio_vista(actor,hoy);
END $$;
DO $$ DECLARE f regprocedure;BEGIN FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='suizamente_private' AND p.proname LIKE 'mej_%' LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||f||' FROM PUBLIC,anon,authenticated';END LOOP;END $$;
COMMIT;
