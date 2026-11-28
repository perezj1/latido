-- Add focused reads. Purchases, invitations and games keep their original RPC.
BEGIN;
CREATE OR REPLACE FUNCTION suizamente_private.lectura_mapa(actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb:=suizamente_private.v10_config_base();v integer:=suizamente_private.v11_vuelta(actor);factor numeric:=suizamente_private.v11_factor(v);
 step numeric:=(c#>>'{mapa,coste,redondeo}')::numeric;works boolean:=suizamente_private.v10_activo()->>'tipo'='obras';prices jsonb;
BEGIN
 -- Evaluate the common cost inputs once, rather than once for every level.
 SELECT jsonb_object_agg(k->>'id',(SELECT jsonb_agg(CASE WHEN works THEN round(round((x#>>'{}')::numeric*factor/step)*step*(c#>>'{eventosFinDeSemana,efectos,obras,multiplicadorCoste}')::numeric)::integer ELSE (round((x#>>'{}')::numeric*factor/step)*step)::integer END ORDER BY n) FROM jsonb_array_elements(k->'costes') WITH ORDINALITY a(x,n))) INTO prices
 FROM jsonb_array_elements(c#>'{mapa,regiones}') r CROSS JOIN LATERAL jsonb_array_elements(r->'cantones') k;
 RETURN jsonb_build_object('region',suizamente_private.v5_region(actor),'vuelta',v,'multiplicador',factor,
  'estilo',c#>ARRAY['vueltasMapa','vueltas',least(v-1,jsonb_array_length(c#>'{vueltasMapa,vueltas}')-1)::text],
  'niveles',coalesce((SELECT jsonb_object_agg(canton,nivel) FROM suizamente_private.suizamente_mapa WHERE jugador_id=actor AND vuelta=v),'{}'),
  'costes',prices,'cofres',coalesce((SELECT jsonb_agg(suizamente_private.v5_cofre_ver(id,actor) ORDER BY creado_en) FROM suizamente_private.suizamente_cofres WHERE jugador_id=actor AND abierto_en IS NULL),'[]'));
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.lectura_album(actor text,mp jsonb) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('colecciones',(SELECT jsonb_agg(c-'cartas'||jsonb_build_object('tengo',
  (SELECT count(*) FROM jsonb_array_elements(c->'cartas') k JOIN suizamente_private.suizamente_cartas a ON a.jugador_id=actor AND a.carta_id=k->>'id'),
  'completa',EXISTS(SELECT 1 FROM suizamente_private.suizamente_movimientos WHERE jugador_id=actor AND motivo='coleccion' AND ref=c->>'id'),
  'cartas',(SELECT jsonb_agg((CASE WHEN a.carta_id IS NULL THEN k-'dato' ELSE k END)||jsonb_build_object('conseguida',a.carta_id IS NOT NULL) ORDER BY ord)
   FROM jsonb_array_elements(c->'cartas') WITH ORDINALITY k(k,ord) LEFT JOIN suizamente_private.suizamente_cartas a ON a.jugador_id=actor AND a.carta_id=k->>'id')) ORDER BY (c->>'id')::integer)
   FROM jsonb_array_elements(suizamente_private.v6_colecciones()) c),
  'sobrePendiente',(SELECT id FROM suizamente_private.suizamente_sobres WHERE jugador_id=actor AND giradas<jsonb_array_length(cartas) ORDER BY creado_en LIMIT 1),
  'cofres',mp->'cofres','mes',suizamente_private.v11_mes())
$$;
REVOKE ALL ON FUNCTION suizamente_private.lectura_mapa(text),suizamente_private.lectura_album(text,jsonb) FROM PUBLIC,anon,authenticated;
-- Preserve the previous serializer for parity checks and a simple rollback.
DO $$ BEGIN
 IF to_regprocedure('suizamente_private.v41_mapa_anterior(text)') IS NULL THEN
  ALTER FUNCTION suizamente_private.v5_mapa(text) RENAME TO v41_mapa_anterior;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION suizamente_private.v5_mapa(actor text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT suizamente_private.lectura_mapa(actor) $$;
REVOKE ALL ON FUNCTION suizamente_private.v5_mapa(text),suizamente_private.v41_mapa_anterior(text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.suizamente_lectura(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text:=auth.uid()::text;identity jsonb;data jsonb;photos jsonb;c jsonb;mp jsonb;available boolean;target text;r record;
 previous text:=coalesce(current_setting('suizamente.eventos',true),'off');
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'SZV2:401:Entra con tu cuenta de Latido para jugar';END IF;
 IF p_action NOT IN('tienda','album','nueva','amigos') OR p_action IS NULL THEN RAISE EXCEPTION 'SZV2:404:Lectura no disponible';END IF;
 IF jsonb_typeof(coalesce(p_args,'{}'))<>'object' OR octet_length(coalesce(p_args,'{}')::text)>10000 THEN RAISE EXCEPTION 'SZV2:400:Solicitud no válida';END IF;
 -- Same lock order, identity, ban checks, player lock and rate limit as the game.
 PERFORM pg_advisory_xact_lock(hashtextextended('suizamente:api:'||actor,0));
 PERFORM suizamente_private.v10_ligas_actualizar();
 PERFORM set_config('suizamente.eventos','on',true);
 identity:=suizamente_private.v2_api_base('jugador','{}',p_guest_id,p_guest_token);
 IF identity->'jugador' IS NULL OR identity->'jugador'='null'::jsonb THEN RAISE EXCEPTION 'SZV2:404:Crea primero tu perfil';END IF;
 PERFORM suizamente_private.v11_misiones_preparar(actor);
 UPDATE suizamente_private.suizamente_jugadores SET ultimo_visto_en=clock_timestamp() WHERE jugador_id=actor;
 PERFORM suizamente_private.v7_cobrar_dia(actor);
 IF p_action='tienda' THEN data:=suizamente_private.v4_accion('tienda',actor,'{}');
 ELSIF p_action='album' THEN data:='{}';
 ELSIF p_action='amigos' THEN data:=suizamente_private.v7_accion('amigos',actor,'{}')||jsonb_build_object('identidad',actor);
 ELSE
  -- One authenticated request replaces three independently prepared snapshots.
  FOR r IN SELECT id FROM suizamente_private.suizamente_partidas WHERE actor IN(jugador_a,jugador_b) AND estado IN('buscando','jugando') ORDER BY id LOOP
   PERFORM suizamente_private.v2_actualizar(r.id);
  END LOOP;
  c:=suizamente_private.v2_config();
  available:=(SELECT count(*) FROM suizamente_private.suizamente_partidas WHERE actor IN(jugador_a,jugador_b) AND estado IN('buscando','jugando'))<(c#>>'{partida,partidasAbiertasMax}')::integer;
  IF available THEN
   SELECT v.jugador_id INTO target FROM suizamente_private.v26_rivales(actor) v WHERE v.online AND v.diferencia<=(c#>>'{partida,rivalAlAzar,margenNivel}')::integer ORDER BY v.diferencia,v.partidas,random() LIMIT 1;
   available:=EXISTS(SELECT 1 FROM suizamente_private.v26_rivales(actor));
  END IF;
  data:=jsonb_build_object('amigos',suizamente_private.v7_accion('amigos',actor,'{}'),
   'partidas',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'estado',m.estado,'rival',suizamente_private.v7_persona(CASE WHEN m.jugador_a=actor THEN m.jugador_b ELSE m.jugador_a END)) ORDER BY m.creada_en DESC),'[]') FROM suizamente_private.suizamente_partidas m WHERE actor IN(m.jugador_a,m.jugador_b) AND m.estado IN('buscando','jugando')),
   'emparejamiento',jsonb_build_object('disponible',available,'jugadores',CASE WHEN target IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(suizamente_private.v7_persona(target)) END,'asincrono',true,'servidorAhora',clock_timestamp()));
 END IF;
 PERFORM suizamente_private.v11_misiones_cobrar(actor);
 data:=suizamente_private.v7_enriquecer(suizamente_private.v3_enriquecer(data,actor),actor);
 mp:=suizamente_private.lectura_mapa(actor);
 IF p_action='album' THEN data:=data||suizamente_private.lectura_album(actor,mp);END IF;
 data:=data||jsonb_build_object('mapa',mp,'marco',suizamente_private.v11_marco(actor),'evento',suizamente_private.v10_activo());
 SELECT coalesce(jsonb_object_agg(pid,suizamente_private.v18_foto(pid)),'{}') INTO photos FROM (SELECT DISTINCT unnest(suizamente_private.v18_identidades(data)) pid) people;
 PERFORM set_config('suizamente.eventos',previous,true);
 RETURN data||jsonb_build_object('avatares',photos);
END $$;
REVOKE ALL ON FUNCTION public.suizamente_lectura(text,jsonb,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.suizamente_lectura(text,jsonb,uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
