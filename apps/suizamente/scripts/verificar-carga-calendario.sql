-- Read-only aggregate checks; never emits player identities or unpublished clues.
WITH sample AS MATERIALIZED(
 SELECT jugador_id FROM suizamente_private.suizamente_jugadores ORDER BY jugador_id LIMIT 10
),parity AS(
 SELECT bool_and(suizamente_private.v41_mapa_anterior(jugador_id)=suizamente_private.lectura_mapa(jugador_id)) ok,count(*) n FROM sample
)
SELECT (SELECT ok FROM parity) mapas_iguales,(SELECT n FROM parity) mapas_comparados,
 (SELECT count(*) FROM suizamente_private.misterios) dias_publicados,
 (SELECT min(fecha)::text FROM suizamente_private.misterios) primera_fecha,
 (SELECT max(fecha)::text FROM suizamente_private.misterios) ultima_fecha,
 (SELECT count(*) FROM generate_series(date '2026-11-28',date '2027-11-28',interval '1 day') d WHERE NOT EXISTS(SELECT 1 FROM suizamente_private.misterios m WHERE m.fecha=d::date)) fechas_ausentes,
 EXISTS(SELECT 1 FROM suizamente_private.misterios WHERE fecha=(clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date) misterio_hoy,
 (SELECT count(*) FROM suizamente_private.persona_decoraciones d JOIN suizamente_private.suizamente_mapa m ON m.jugador_id=d.persona AND m.vuelta=d.vuelta AND m.canton=d.canton WHERE m.nivel=0) decoraciones_en_nivel_cero,
 (SELECT config->>'cobroAutomatico' FROM suizamente_private.negocios_configuracion) stripe_activo,
 has_function_privilege('authenticated','public.suizamente_lectura(text,jsonb,uuid,text)','EXECUTE') lectura_para_cuentas,
 has_table_privilege('authenticated','suizamente_private.misterios','SELECT') calendario_publico;
