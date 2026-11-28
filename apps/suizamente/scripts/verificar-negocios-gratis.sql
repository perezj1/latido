-- Aggregate production checks. No contact data or example businesses.
SELECT (SELECT config->>'gratis' FROM suizamente_private.negocios_configuracion) gratis,
 (SELECT config->>'cobroAutomatico' FROM suizamente_private.negocios_configuracion) cobro_automatico,
 (SELECT config->'planes' FROM suizamente_private.negocios_configuracion) precios_conservados,
 to_regprocedure('suizamente_private.neg44_api_base(text,jsonb,uuid,text)') IS NOT NULL alta_anterior_conservada,
 to_regprocedure('public.suizamente_negocios_cobros(text,jsonb)') IS NOT NULL cobros_conservados,
 (SELECT count(*) FROM suizamente_private.negocio_pagos) pagos,
 (SELECT count(*) FROM suizamente_private.negocio_cobros WHERE suscripcion IS NOT NULL) suscripciones,
 (SELECT count(*) FROM suizamente_private.negocios) negocios,
 (SELECT count(*) FROM suizamente_private.mapa_huecos WHERE tipo='plaza') plazas,
 has_function_privilege('authenticated','public.suizamente_negocios(text,jsonb,uuid,text)','EXECUTE') alta_para_cuentas,
 has_function_privilege('authenticated','suizamente_private.neg44_api_base(text,jsonb,uuid,text)','EXECUTE') motor_privado_accesible;
