-- After v21: three-step onboarding. Preserve practice answers, ledger and hints.
BEGIN;
UPDATE suizamente_private.suizamente_configuracion
 SET juego=jsonb_set(juego,'{primeraVez}',((juego->'primeraVez')-'ejemplos')||'{"pregunta":"r_s5o1xw"}'::jsonb);
DO $$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('suizamente_private.v21_api_base(text,jsonb,uuid,text)'::regprocedure) INTO definition;
 IF position('INTO examples' IN definition)>0 THEN
  definition:=replace(definition,';examples jsonb;',';');
  definition:=regexp_replace(definition,'  SELECT jsonb_agg\(suizamente_private.v20_pregunta\(p.payload\) ORDER BY n\) INTO examples[^;]+;','');
  definition:=replace(definition,'jsonb_build_object(''ejemplos'',examples,''pregunta'',','jsonb_build_object(''pregunta'',');
  IF position('examples' IN definition)>0 THEN RAISE EXCEPTION 'Unexpected practice API: examples were not removed';END IF;
  EXECUTE definition;
 END IF;
 SELECT pg_get_functiondef('public.suizamente_v2(text,jsonb,uuid,text)'::regprocedure) INTO definition;
 EXECUTE replace(definition,'''apiVersion'',21','''apiVersion'',22');
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
