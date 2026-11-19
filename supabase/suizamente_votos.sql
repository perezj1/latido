-- Suizamente de referencia: instalación aditiva, independiente del juego antiguo.
-- Ejecutar completo en el SQL Editor de Supabase. Nunca ejecutar eliminar_juego.
BEGIN;
CREATE TABLE IF NOT EXISTS public.suizamente_catalogo_votos (
  pregunta_id text PRIMARY KEY,
  opciones smallint NOT NULL CHECK (opciones BETWEEN 2 AND 3)
);
CREATE TABLE IF NOT EXISTS public.suizamente_votos (
  pregunta_id text NOT NULL REFERENCES public.suizamente_catalogo_votos(pregunta_id),
  jugador_id text NOT NULL,
  opcion smallint NOT NULL CHECK (opcion BETWEEN 0 AND 2),
  creado_en timestamptz NOT NULL DEFAULT now(),
  usuario_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (pregunta_id, jugador_id)
);
CREATE INDEX IF NOT EXISTS suizamente_votos_jugador ON public.suizamente_votos(jugador_id);
CREATE TABLE IF NOT EXISTS public.suizamente_votos_limites (
  clave text PRIMARY KEY, ventana timestamptz NOT NULL, peticiones integer NOT NULL
);
ALTER TABLE public.suizamente_catalogo_votos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suizamente_votos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suizamente_votos_limites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.suizamente_catalogo_votos, public.suizamente_votos, public.suizamente_votos_limites FROM anon, authenticated;

-- CATALOGO: generado a partir de las preguntas originales; índices intactos.
INSERT INTO public.suizamente_catalogo_votos(pregunta_id, opciones) VALUES
('cena_vida', 2),
('tren_pueblo', 2),
('vecino_ruido', 2),
('votar_mucho', 2),
('domingo_monte', 2),
('choco_queso', 2),
('nota_vecino', 2),
('fronterizo', 2),
('esqui_tarde', 2),
('lavanderia', 2),
('vaca_cisne', 2),
('puntualidad', 2),
('dialecto', 2),
('domingo_tiendas', 2),
('niebla_wifi', 2),
('herejia', 2),
('billete_1000', 2),
('1_agosto', 2),
('bandera', 2),
('bici_tren', 2),
('yodel', 2),
('alquilar', 2),
('zopf_gipfeli', 2),
('cervino', 2),
('du_sie', 2),
('aleman_frances', 3),
('osos_cabras', 2),
('reloj_viaje', 2),
('agua_fuente', 2),
('rosti_desayuno', 2),
('apero_cena', 2),
('jass_coro', 2),
('sauna_lago', 2),
('tren_coche', 2),
('verein', 2),
('invierno_verano', 2),
('carta_email', 2),
('chocolate_tipo', 2),
('montana_lago', 2),
('compra_frontera', 2),
('septante', 2),
('fasnacht_elige', 2),
('cabana_hotel', 2),
('tren_perdido', 2),
('regalo_casa', 3),
('ventilar', 2),
('badi_rio', 2),
('palabra_suiza', 3),
('cervelat_raclette', 2),
('idioma_extra', 3),
('vidrio_domingo', 3),
('bolsa_negra', 3),
('seguro_basico', 3),
('registro_plazo', 3),
('pan_fondue', 3),
('tarta_cumple', 3),
('besos', 3),
('cena_hora', 3),
('descanso_noche', 3),
('agujeros', 3),
('capital', 3),
('consejo_federal', 3),
('idiomas', 3),
('bunker', 3),
('gotardo', 3),
('alpabzug', 3),
('schwingen', 3),
('en_guete', 3),
('natel', 3),
('rostigraben', 3),
('iglesia', 3),
('serafe', 3),
('carnet', 3),
('senderos', 3),
('onu_ue', 3),
('kafi', 3),
('orden_pago', 3),
('samichlaus', 3),
('escalade', 3),
('boogg', 3),
('salario_minimo', 3),
('sin_billete', 3),
('lavar_coche', 3),
('fianza_max', 3),
('certificado_deudas', 3),
('seguro_plazo', 3),
('franquicia', 3),
('cambio_seguro', 3),
('emergencias', 3),
('halbtax', 3),
('vineta', 3),
('pilas_tienda', 3),
('pet_super', 3),
('sueldo_13', 3),
('vacaciones_min', 3),
('periodo_prueba', 3),
('garrapatas', 3),
('setas', 3),
('perro_impuesto', 3),
('nacionalidad_anios', 3)
ON CONFLICT (pregunta_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.suizamente_votos_api(
  accion text, jugador text DEFAULT NULL, pregunta text DEFAULT NULL,
  eleccion integer DEFAULT NULL, direccion text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  resultado jsonb;
  cantidad integer;
  original integer;
  insertado integer;
  clave_limite text;
  pedidos integer;
  minuto timestamptz := date_trunc('minute', clock_timestamp());
BEGIN
  IF accion NOT IN ('resumen','mios','votar') OR direccion IS NULL THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE = 'Solicitud no válida';
  END IF;
  -- Both limits are durable across server instances. Atomic upserts serialize
  -- concurrent requests; an error rolls the whole transaction back.
  FOREACH clave_limite IN ARRAY array_remove(ARRAY['ip:' || direccion, jugador], NULL) LOOP
    INSERT INTO public.suizamente_votos_limites AS l VALUES (clave_limite, minuto, 1)
    ON CONFLICT (clave) DO UPDATE SET ventana = minuto,
      peticiones = CASE WHEN l.ventana = minuto THEN l.peticiones + 1 ELSE 1 END
    RETURNING peticiones INTO pedidos;
    IF pedidos > 60 THEN RAISE SQLSTATE 'PT429' USING MESSAGE = 'Demasiadas peticiones'; END IF;
  END LOOP;
  DELETE FROM public.suizamente_votos_limites WHERE ventana < minuto - interval '1 day';

  IF accion = 'resumen' THEN
    SELECT coalesce(jsonb_object_agg(pregunta_id, reparto), '{}'::jsonb) INTO resultado
    FROM (SELECT pregunta_id, jsonb_build_array(
      count(*) FILTER (WHERE opcion=0), count(*) FILTER (WHERE opcion=1), count(*) FILTER (WHERE opcion=2)) reparto
      FROM public.suizamente_votos GROUP BY pregunta_id) c;
    RETURN jsonb_build_object('conteos', resultado, 'actualizado', clock_timestamp());
  END IF;
  IF jugador IS NULL OR jugador !~ '^(user|anon):[a-fA-F0-9-]{36}$' THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE = 'Jugador no válido';
  END IF;
  IF accion = 'mios' THEN
    SELECT coalesce(jsonb_object_agg(pregunta_id, opcion), '{}'::jsonb) INTO resultado
      FROM public.suizamente_votos WHERE jugador_id = jugador;
    RETURN jsonb_build_object('votos', resultado);
  END IF;
  SELECT opciones INTO cantidad FROM public.suizamente_catalogo_votos WHERE pregunta_id = pregunta;
  IF cantidad IS NULL OR eleccion IS NULL OR eleccion < 0 OR eleccion >= cantidad THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE = 'Pregunta u opción no válida';
  END IF;
  INSERT INTO public.suizamente_votos(pregunta_id, jugador_id, opcion, usuario_id)
    VALUES (pregunta, jugador, eleccion, CASE WHEN jugador LIKE 'user:%' THEN substring(jugador FROM 6)::uuid END)
    ON CONFLICT (pregunta_id, jugador_id) DO NOTHING;
  GET DIAGNOSTICS insertado = ROW_COUNT;
  SELECT opcion INTO original FROM public.suizamente_votos WHERE pregunta_id = pregunta AND jugador_id = jugador;
  SELECT jsonb_build_array(count(*) FILTER (WHERE opcion=0), count(*) FILTER (WHERE opcion=1), count(*) FILTER (WHERE opcion=2))
    INTO resultado FROM public.suizamente_votos WHERE pregunta_id = pregunta;
  RETURN jsonb_build_object('reparto', resultado, 'yaVotado', insertado=0, 'opcion', original);
END;
$$;
REVOKE ALL ON FUNCTION public.suizamente_votos_api(text,text,text,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.suizamente_votos_api(text,text,text,integer,text) TO service_role;
COMMIT;
