-- Install after latido_card_experience.sql and app_notifications.sql.
-- Uses existing in-app delivery. No email addresses or push permissions are collected here.
BEGIN;
DO $$ DECLARE expression TEXT; BEGIN
 SELECT pg_get_expr(conbin,conrelid) INTO expression FROM pg_constraint
 WHERE conrelid='public.app_notifications'::regclass AND conname='app_notifications_kind_check';
 IF expression IS NULL THEN RAISE EXCEPTION 'Install app_notifications.sql first'; END IF;
 IF position('card_business' IN expression)=0 THEN
  ALTER TABLE public.app_notifications DROP CONSTRAINT app_notifications_kind_check;
  EXECUTE 'ALTER TABLE public.app_notifications ADD CONSTRAINT app_notifications_kind_check CHECK (('||expression||') OR kind IN (''card_business'',''card_member''))';
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.latido_card_notification_preferences (
 user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 new_offers BOOLEAN NOT NULL DEFAULT false,
 city TEXT NOT NULL DEFAULT '' CHECK (length(city)<=120),
 enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 last_new_offers_at TIMESTAMPTZ
);
ALTER TABLE public.latido_card_notification_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.latido_card_notification_preferences FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.latido_card_notification_preferences TO service_role;
-- Canton codes are stored separately; city is retained for older clients.
CREATE OR REPLACE FUNCTION public.lc_card_canton(p_value TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE clean TEXT;
BEGIN
 clean:=regexp_replace(translate(lower(btrim(coalesce(p_value,''))),
 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),'[^a-z]','','g');
 IF upper(clean)=ANY(ARRAY['AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH']) THEN RETURN upper(clean); END IF;
 RETURN CASE clean
  WHEN 'aargau' THEN 'AG'
  WHEN 'appenzella' THEN 'AR'
  WHEN 'appenzellausserrhoden' THEN 'AR'
  WHEN 'appenzelli' THEN 'AI'
  WHEN 'appenzellinnerrhoden' THEN 'AI'
  WHEN 'basel' THEN 'BS'
  WHEN 'baselland' THEN 'BL'
  WHEN 'basellandschaft' THEN 'BL'
  WHEN 'baselstadt' THEN 'BS'
  WHEN 'bern' THEN 'BE'
  WHEN 'berna' THEN 'BE'
  WHEN 'freiburg' THEN 'FR'
  WHEN 'fribourg' THEN 'FR'
  WHEN 'geneva' THEN 'GE'
  WHEN 'geneve' THEN 'GE'
  WHEN 'genf' THEN 'GE'
  WHEN 'ginebra' THEN 'GE'
  WHEN 'glarus' THEN 'GL'
  WHEN 'graubunden' THEN 'GR'
  WHEN 'jura' THEN 'JU'
  WHEN 'lucerna' THEN 'LU'
  WHEN 'lucerne' THEN 'LU'
  WHEN 'luzern' THEN 'LU'
  WHEN 'neuchatel' THEN 'NE'
  WHEN 'neuenburg' THEN 'NE'
  WHEN 'nidwalden' THEN 'NW'
  WHEN 'obwalden' THEN 'OW'
  WHEN 'schaffhausen' THEN 'SH'
  WHEN 'schwyz' THEN 'SZ'
  WHEN 'solothurn' THEN 'SO'
  WHEN 'stgallen' THEN 'SG'
  WHEN 'tessin' THEN 'TI'
  WHEN 'thurgau' THEN 'TG'
  WHEN 'ticino' THEN 'TI'
  WHEN 'uri' THEN 'UR'
  WHEN 'valais' THEN 'VS'
  WHEN 'vaud' THEN 'VD'
  WHEN 'waadt' THEN 'VD'
  WHEN 'wallis' THEN 'VS'
  WHEN 'zuerich' THEN 'ZH'
  WHEN 'zug' THEN 'ZG'
  WHEN 'zurich' THEN 'ZH'
  ELSE '' END;
END $$;
CREATE OR REPLACE FUNCTION public.lc_card_city_canton(p_city TEXT) RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE matches INTEGER; code TEXT;
BEGIN
 -- Prefer actual business locations, and never guess across ambiguous cantons.
 SELECT count(DISTINCT mapped.canton),min(mapped.canton) INTO matches,code
 FROM (SELECT public.lc_card_canton(to_jsonb(p)->>'canton') AS canton FROM public.providers p
 WHERE lower(btrim(p.city))=lower(btrim(p_city))) mapped WHERE mapped.canton<>'';
 IF matches>1 THEN RETURN ''; END IF;
 IF matches=1 THEN RETURN code; END IF;
 RETURN public.lc_card_canton(p_city);
END $$;
ALTER TABLE public.latido_card_notification_preferences ADD COLUMN IF NOT EXISTS canton TEXT NOT NULL DEFAULT ''
 CONSTRAINT lc_notification_canton CHECK(canton='' OR canton IN ('AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH'));
-- Preserve existing consent when the saved city has an identifiable canton.
UPDATE public.latido_card_notification_preferences SET canton=public.lc_card_city_canton(city)
 WHERE canton='' AND city<>'';
-- Unresolved locations require an explicit choice; disabled preferences stay disabled.
UPDATE public.latido_card_notification_preferences SET new_offers=false WHERE new_offers AND canton='';

-- Keep p_city as an optional compatibility argument, with the canton as the new preference.
DROP FUNCTION IF EXISTS public.lc_notification_preferences(BOOLEAN,TEXT);
CREATE OR REPLACE FUNCTION public.lc_notification_preferences(p_enabled BOOLEAN DEFAULT NULL,p_city TEXT DEFAULT NULL,p_canton TEXT DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE preference public.latido_card_notification_preferences; selected_canton TEXT;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT * INTO preference FROM public.latido_card_notification_preferences WHERE user_id=auth.uid();
 IF p_enabled IS NOT NULL THEN
  selected_canton:=CASE WHEN p_canton IS NOT NULL THEN public.lc_card_canton(p_canton)
   WHEN p_city IS NOT NULL THEN public.lc_card_city_canton(p_city) ELSE coalesce(preference.canton,'') END;
  IF nullif(btrim(p_canton),'') IS NOT NULL AND selected_canton='' THEN RAISE EXCEPTION 'CANTON_INVALID'; END IF;
  IF p_enabled AND selected_canton='' THEN RAISE EXCEPTION 'CANTON_REQUIRED'; END IF;
  INSERT INTO public.latido_card_notification_preferences(user_id,new_offers,canton,city)
  VALUES(auth.uid(),p_enabled,selected_canton,coalesce(btrim(p_city),''))
  ON CONFLICT(user_id) DO UPDATE SET new_offers=excluded.new_offers,canton=excluded.canton,
  city=CASE WHEN p_city IS NOT NULL THEN excluded.city ELSE latido_card_notification_preferences.city END,
  enabled_at=CASE WHEN (NOT latido_card_notification_preferences.new_offers AND excluded.new_offers)
   OR latido_card_notification_preferences.canton<>excluded.canton THEN now() ELSE latido_card_notification_preferences.enabled_at END;
 END IF;
 SELECT * INTO preference FROM public.latido_card_notification_preferences WHERE user_id=auth.uid();
 RETURN jsonb_build_object('new_offers',coalesce(preference.new_offers,false),'canton',coalesce(preference.canton,''),'city',coalesce(preference.city,''));
END $$;

CREATE OR REPLACE FUNCTION public.lc_notify_business_use() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_id UUID; business_name TEXT; remaining BIGINT;
BEGIN
 SELECT p.user_id,p.name INTO owner_id,business_name FROM public.providers p WHERE p.id=NEW.provider_id;
 IF owner_id IS NULL OR NEW.reversed_at IS NOT NULL THEN RETURN NEW; END IF;
 -- A constant source per business makes this exactly once, even on retries or concurrent uses.
 IF (SELECT count(*) FROM public.latido_card_redemptions WHERE provider_id=NEW.provider_id)=1 THEN
  INSERT INTO public.app_notifications(recipient_id,kind,source_id,data)
  VALUES(owner_id,'card_business','first:'||NEW.provider_id,jsonb_build_object('title','¡Primer socio en tu negocio!',
  'body',business_name,'action','first_use','href','/card/negocios?negocio='||NEW.provider_id)) ON CONFLICT DO NOTHING;
 END IF;
 SELECT o.stock_total-count(c.id) INTO remaining FROM public.latido_card_offers o LEFT JOIN public.latido_card_claims c
 ON c.offer_id=o.id AND (c.status='used' OR (c.status='claimed' AND c.expires_at>now()))
 WHERE o.id=NEW.offer_id AND o.requires_claim AND o.stock_total IS NOT NULL GROUP BY o.stock_total;
 IF remaining<=2 AND remaining>=0 THEN
  INSERT INTO public.app_notifications(recipient_id,kind,source_id,data)
  VALUES(owner_id,'card_business','stock:'||NEW.offer_id,jsonb_build_object('title','Quedan '||remaining||' unidades de tu promoción.',
  'body',NEW.offer_snapshot->>'title','href','/card/negocios?negocio='||NEW.provider_id)) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lc_business_use_notification ON public.latido_card_redemptions;
CREATE TRIGGER lc_business_use_notification AFTER INSERT ON public.latido_card_redemptions FOR EACH ROW EXECUTE FUNCTION public.lc_notify_business_use();

CREATE OR REPLACE FUNCTION public.lc_send_scheduled_notifications() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sent INTEGER:=0; affected INTEGER; preference public.latido_card_notification_preferences; new_count BIGINT; canton_name TEXT;
 week_start TIMESTAMPTZ:=date_trunc('week',now() AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich';
 today DATE:=(now() AT TIME ZONE 'Europe/Zurich')::date;
BEGIN
 -- Only cron/owner and service_role may execute; no client execute grant.
 INSERT INTO public.app_notifications(recipient_id,kind,source_id,data)
 SELECT p.user_id,'card_business','ending:'||o.id||':'||o.ends_at,
 jsonb_build_object('title','Tu oferta termina en 3 días.','body',o.title,'href','/card/negocios?negocio='||p.id)
 FROM public.latido_card_offers o JOIN public.providers p ON p.id=o.provider_id
 JOIN public.latido_card_businesses b ON b.provider_id=p.id
 WHERE o.active AND o.deleted_at IS NULL AND o.ends_at<>'infinity'::timestamptz
 AND (o.ends_at AT TIME ZONE 'Europe/Zurich')::date=today+3
 AND b.active AND NOT b.suspended AND p.user_id IS NOT NULL AND coalesce((to_jsonb(p)->>'active')::boolean,true) AND to_jsonb(p)->>'deleted_at' IS NULL
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS affected=ROW_COUNT; sent:=sent+affected;

 INSERT INTO public.app_notifications(recipient_id,kind,source_id,data)
 SELECT p.user_id,'card_business','weekly:'||p.id||':'||week_start,
 jsonb_build_object('title',count(DISTINCT r.membership_id)||' socios usaron tu oferta la última semana',
 'body',p.name,'href','/card/negocios?negocio='||p.id)
 FROM public.providers p JOIN public.latido_card_redemptions r ON r.provider_id=p.id
 WHERE extract(isodow FROM now() AT TIME ZONE 'Europe/Zurich')=1 AND p.user_id IS NOT NULL
 AND r.redeemed_at>=((week_start AT TIME ZONE 'Europe/Zurich')-interval '7 days') AT TIME ZONE 'Europe/Zurich'
 AND r.redeemed_at<week_start AND r.reversed_at IS NULL AND to_jsonb(p)->>'deleted_at' IS NULL
 GROUP BY p.id,p.user_id,p.name ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS affected=ROW_COUNT; sent:=sent+affected;

 INSERT INTO public.app_notifications(recipient_id,kind,source_id,data)
 SELECT m.user_id,'card_member','membership:'||m.id||':'||m.valid_until,
 jsonb_build_object('title','Tu membresía de Latido Club caduca en 7 días.','body','Solicita la renovación para seguir usando tus descuentos.','href','/card')
 FROM public.latido_card_memberships m WHERE m.status='active' AND m.starts_at<=now()
 AND (m.valid_until AT TIME ZONE 'Europe/Zurich')::date=today+7 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS affected=ROW_COUNT; sent:=sent+affected;

 -- Lock preferences to serialize overlapping cron runs. Consent is explicit and revocable.
 FOR preference IN SELECT pref.* FROM public.latido_card_notification_preferences pref
 JOIN public.latido_card_memberships m ON m.user_id=pref.user_id AND public.lc_active_member(m.id)
 WHERE pref.new_offers AND (pref.last_new_offers_at IS NULL OR pref.last_new_offers_at<=now()-interval '7 days')
 FOR UPDATE OF pref LOOP
  SELECT count(*) INTO new_count FROM public.latido_card_offers o JOIN public.providers p ON p.id=o.provider_id
  JOIN public.latido_card_businesses b ON b.provider_id=p.id
  WHERE public.lc_card_canton(to_jsonb(p)->>'canton')=preference.canton AND b.active AND NOT b.suspended AND o.active AND o.deleted_at IS NULL
  AND o.starts_at<=now() AND o.ends_at>now() AND o.created_at>greatest(preference.enabled_at,coalesce(preference.last_new_offers_at,preference.enabled_at))
  AND coalesce((to_jsonb(p)->>'active')::boolean,true) AND to_jsonb(p)->>'deleted_at' IS NULL;
  IF new_count>0 THEN
   canton_name:='{"AG": "Aargau", "AI": "Appenzell I.", "AR": "Appenzell A.", "BE": "Bern", "BL": "Basel-Land", "BS": "Basel-Stadt", "FR": "Fribourg", "GE": "Genève", "GL": "Glarus", "GR": "Graubünden", "JU": "Jura", "LU": "Luzern", "NE": "Neuchâtel", "NW": "Nidwalden", "OW": "Obwalden", "SG": "St. Gallen", "SH": "Schaffhausen", "SO": "Solothurn", "SZ": "Schwyz", "TG": "Thurgau", "TI": "Ticino", "UR": "Uri", "VD": "Vaud", "VS": "Valais", "ZG": "Zug", "ZH": "Zürich"}'::jsonb->>preference.canton;
   INSERT INTO public.app_notifications(recipient_id,kind,source_id,data)
   VALUES(preference.user_id,'card_member','new-offers:'||week_start,
   jsonb_build_object('title','Descuentos nuevos en '||canton_name,'body','Descubre '||new_count||CASE WHEN new_count=1 THEN ' nueva oferta' ELSE ' nuevas ofertas' END||' en tu cantón.','canton',preference.canton,'href','/card')) ON CONFLICT DO NOTHING;
   GET DIAGNOSTICS affected=ROW_COUNT; sent:=sent+affected;
   UPDATE public.latido_card_notification_preferences SET last_new_offers_at=now() WHERE user_id=preference.user_id;
  END IF;
 END LOOP;
 RETURN sent;
END $$;
REVOKE ALL ON FUNCTION public.lc_card_canton(TEXT),public.lc_card_city_canton(TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.lc_notification_preferences(BOOLEAN,TEXT,TEXT),public.lc_notify_business_use(),public.lc_send_scheduled_notifications() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_notification_preferences(BOOLEAN,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lc_send_scheduled_notifications() TO service_role;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  PERFORM cron.schedule('latido-card-notifications','15 * * * *','SELECT public.lc_send_scheduled_notifications()');
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
