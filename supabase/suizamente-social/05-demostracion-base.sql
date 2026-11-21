-- Perfiles de ejemplo independientes de las cuentas y los votos reales.
-- Las filas las añade scripts/generar-suizamente-desgloses.mjs.
BEGIN;
CREATE TABLE IF NOT EXISTS suizamente_social.demo_perfiles (
  id text PRIMARY KEY CHECK(id ~ '^demo-[0-9]+$'),
  apodo text NOT NULL, canton text NOT NULL REFERENCES suizamente_social.cantones(codigo),
  pais text NOT NULL, anos_suiza text NOT NULL CHECK(anos_suiza IN ('menos1','1a3','3a10','mas10')),
  puntos integer NOT NULL CHECK(puntos>=0), origen text NOT NULL DEFAULT 'ejemplo' CHECK(origen='ejemplo')
);
CREATE TABLE IF NOT EXISTS suizamente_social.demo_repartos (
  pregunta text PRIMARY KEY REFERENCES public.suizamente_catalogo_votos(pregunta_id),
  conteos integer[] NOT NULL CHECK(cardinality(conteos)=3 AND conteos[1]>=0 AND conteos[2]>=0 AND conteos[3]>=0
    AND conteos[1]+conteos[2]+conteos[3]=320),
  origen text NOT NULL DEFAULT 'ejemplo' CHECK(origen='ejemplo')
);
ALTER TABLE suizamente_social.demo_perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suizamente_social.demo_repartos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON suizamente_social.demo_perfiles,suizamente_social.demo_repartos FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION suizamente_social.desglose_demo(p_pregunta text,p_por text) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog,suizamente_social AS $$
  WITH ordered AS (
    -- Una respuesta por perfil. La permutación cambia por pregunta y conserva
    -- exactamente el reparto de 320 respuestas que muestra el juego.
    SELECT p.*,row_number() OVER(ORDER BY md5(p_pregunta||':'||p.id),p.id)-1 posicion
    FROM suizamente_social.demo_perfiles p
  ), answers AS (
    SELECT CASE WHEN p_por='pais' THEN p.pais ELSE p.anos_suiza END grupo,
      CASE WHEN p.posicion<r.conteos[1] THEN 0 WHEN p.posicion<r.conteos[1]+r.conteos[2] THEN 1 ELSE 2 END opcion
    FROM ordered p JOIN suizamente_social.demo_repartos r ON r.pregunta=p_pregunta
  ), groups AS (
    SELECT grupo,count(*) votos,jsonb_build_array(count(*) FILTER(WHERE opcion=0),
      count(*) FILTER(WHERE opcion=1),count(*) FILTER(WHERE opcion=2)) conteos
    FROM answers GROUP BY grupo HAVING count(*)>=20
  ) SELECT jsonb_build_object('demo',true,'total',320,'minimo',20,
    'grupos',coalesce(jsonb_agg(groups ORDER BY votos DESC,grupo),'[]'::jsonb)) FROM groups
$$;
REVOKE ALL ON FUNCTION suizamente_social.desglose_demo(text,text) FROM PUBLIC,anon,authenticated;
COMMIT;
