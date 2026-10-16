-- Existing minimal Card installations: public directory of participating businesses.
-- Fresh installations already include this function in latido_card_minimal.sql.
-- Read-only API; exposes only public display fields, never owner or membership data.
BEGIN;
CREATE OR REPLACE FUNCTION public.lc_participating_businesses() RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'city',p.city,'photo_url',p.photo_url)
 ORDER BY lower(p.name),p.id),'[]'::jsonb)
 FROM public.latido_card_businesses b JOIN public.providers p ON p.id=b.provider_id
 WHERE b.active AND NOT b.suspended
$$;
REVOKE ALL ON FUNCTION public.lc_participating_businesses() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_participating_businesses() TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
