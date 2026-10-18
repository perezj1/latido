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
CREATE OR REPLACE FUNCTION public.lc_notification_preferences(p_enabled BOOLEAN DEFAULT NULL,p_city TEXT DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE preference public.latido_card_notification_preferences;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_enabled IS NOT NULL THEN
  IF p_enabled AND nullif(btrim(p_city),'') IS NULL THEN RAISE EXCEPTION 'CITY_REQUIRED'; END IF;
  INSERT INTO public.latido_card_notification_preferences(user_id,new_offers,city) VALUES(auth.uid(),p_enabled,coalesce(btrim(p_city),''))
  ON CONFLICT(user_id) DO UPDATE SET new_offers=excluded.new_offers,city=excluded.city,
  enabled_at=CASE WHEN NOT latido_card_notification_preferences.new_offers AND excluded.new_offers THEN now() ELSE latido_card_notification_preferences.enabled_at END;
 END IF;
 SELECT * INTO preference FROM public.latido_card_notification_preferences WHERE user_id=auth.uid();
 RETURN jsonb_build_object('new_offers',coalesce(preference.new_offers,false),'city',coalesce(preference.city,''));
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
DECLARE sent INTEGER:=0; affected INTEGER; preference public.latido_card_notification_preferences; new_count BIGINT;
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
 jsonb_build_object('title','Tu Tarjeta Latido caduca en 7 días.','body','Solicita la renovación para seguir usando tus descuentos.','href','/card')
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
  WHERE p.city=preference.city AND b.active AND NOT b.suspended AND o.active AND o.deleted_at IS NULL
  AND o.starts_at<=now() AND o.ends_at>now() AND o.created_at>greatest(preference.enabled_at,coalesce(preference.last_new_offers_at,preference.enabled_at))
  AND coalesce((to_jsonb(p)->>'active')::boolean,true) AND to_jsonb(p)->>'deleted_at' IS NULL;
  IF new_count>0 THEN
   INSERT INTO public.app_notifications(recipient_id,kind,source_id,data)
   VALUES(preference.user_id,'card_member','new-offers:'||week_start,
   jsonb_build_object('title','Descuentos nuevos en '||preference.city,'body',new_count||' nuevas ofertas para descubrir.','href','/card')) ON CONFLICT DO NOTHING;
   GET DIAGNOSTICS affected=ROW_COUNT; sent:=sent+affected;
   UPDATE public.latido_card_notification_preferences SET last_new_offers_at=now() WHERE user_id=preference.user_id;
  END IF;
 END LOOP;
 RETURN sent;
END $$;
REVOKE ALL ON FUNCTION public.lc_notification_preferences(BOOLEAN,TEXT),public.lc_notify_business_use(),public.lc_send_scheduled_notifications() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lc_notification_preferences(BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lc_send_scheduled_notifications() TO service_role;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  PERFORM cron.schedule('latido-card-notifications','15 * * * *','SELECT public.lc_send_scheduled_notifications()');
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
