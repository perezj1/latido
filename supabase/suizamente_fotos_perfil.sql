-- Fotos propias de Suizamente. No modifica los perfiles ni fotos de Latido.
BEGIN;
ALTER TABLE suizamente_social.jugadores ADD COLUMN IF NOT EXISTS foto_url text;

CREATE OR REPLACE FUNCTION public.suizamente_social_fotos(p_usuarios uuid[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',usuario_id,'url',foto_url)),'[]'::jsonb)
  FROM suizamente_social.jugadores
  WHERE usuario_id=ANY(p_usuarios) AND foto_url IS NOT NULL;
$$;
CREATE OR REPLACE FUNCTION public.suizamente_social_foto_guardar(p_usuario uuid,p_url text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF p_url IS NULL OR length(p_url)>2048 OR p_url !~ '^https://[^/]+/storage/v1/object/public/avatars/' THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE='Foto no válida';
  END IF;
  UPDATE suizamente_social.jugadores SET foto_url=p_url WHERE usuario_id=p_usuario;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Perfil no encontrado'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.suizamente_social_fotos(uuid[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.suizamente_social_foto_guardar(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.suizamente_social_fotos(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.suizamente_social_foto_guardar(uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
