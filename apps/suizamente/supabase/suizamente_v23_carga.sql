-- Batch the already-saved unread duel summaries into the existing match list.
-- No rewards, votes, deadlines, read flags or game state are changed here.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('suizamente_private.v23_api_base(text,jsonb,uuid,text)') IS NULL THEN
  ALTER FUNCTION public.suizamente_v2(text,jsonb,uuid,text) SET SCHEMA suizamente_private;
  ALTER FUNCTION suizamente_private.suizamente_v2(text,jsonb,uuid,text) RENAME TO v23_api_base;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.suizamente_v2(p_action text,p_args jsonb DEFAULT '{}',p_guest_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE data jsonb;actor text:=auth.uid()::text;matches jsonb;
BEGIN
 data:=suizamente_private.v23_api_base(p_action,p_args,p_guest_id,p_guest_token);
 IF actor IS NULL OR p_action NOT IN('inicio','partidas') OR jsonb_typeof(data->'partidas') IS DISTINCT FROM 'array' THEN RETURN data;END IF;
 SELECT coalesce(jsonb_agg(CASE WHEN d.id IS NOT NULL AND d.estado='terminado' AND
  NOT CASE WHEN actor=d.retador THEN d.visto_a ELSE d.visto_b END
  THEN item||jsonb_build_object('duelo',jsonb_build_object('id',d.id,'estado',d.estado,'sello',d.sello,'ganador',d.ganador,'mostrarResultado',true))
  ELSE item END ORDER BY ord),'[]'::jsonb) INTO matches
 FROM jsonb_array_elements(data->'partidas') WITH ORDINALITY e(item,ord)
 LEFT JOIN suizamente_private.suizamente_partidas m ON m.id=(item->>'id')::uuid AND actor IN(m.jugador_a,m.jugador_b)
 LEFT JOIN suizamente_private.suizamente_duelos_sello d ON d.id=m.duelo_id AND actor IN(d.retador,d.defensor);
 RETURN data||jsonb_build_object('partidas',matches,'duelosIncluidos',true);
END $$;
REVOKE ALL ON FUNCTION suizamente_private.v23_api_base(text,jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suizamente_v2(text,jsonb,uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
