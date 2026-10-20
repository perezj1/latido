-- OPCIONAL: SOLO EN DESARROLLO, después de minimal, cleanup_legacy y verify.
-- Crear primero estas 3 cuentas en Authentication > Users > Add user,
-- con contraseña propia y Auto Confirm User activado. El alta debe crear profiles.
-- No se crean contraseñas ni se insertan usuarios directamente en auth.users.
-- Los negocios son ficticios y públicos en el catálogo de ESTA base de pruebas.
-- No crea solicitudes físicas, credenciales, notificaciones ni envíos de email.
-- Se puede repetir: conserva reservas, canjes y modificaciones de los ejemplos.
BEGIN;
DO $$
DECLARE
 member_email TEXT := 'card.socio@latido.test';
 paused_email TEXT := 'card.inactivo@latido.test';
 owner_email TEXT := 'card.negocio@latido.test';
 member_id UUID; paused_id UUID; owner_id UUID;
 item RECORD;
BEGIN
 SELECT p.id INTO member_id FROM public.profiles p JOIN auth.users u ON u.id=p.id
 WHERE lower(p.email)=member_email AND lower(u.email)=member_email;
 SELECT p.id INTO paused_id FROM public.profiles p JOIN auth.users u ON u.id=p.id
 WHERE lower(p.email)=paused_email AND lower(u.email)=paused_email;
 SELECT p.id INTO owner_id FROM public.profiles p JOIN auth.users u ON u.id=p.id
 WHERE lower(p.email)=owner_email AND lower(u.email)=owner_email;
 IF member_id IS NULL OR paused_id IS NULL OR owner_id IS NULL THEN
  RAISE EXCEPTION 'Faltan cuentas Auth/perfiles de prueba. Crear card.socio@latido.test, card.inactivo@latido.test y card.negocio@latido.test con email confirmado.';
 END IF;

 -- Refuse collisions instead of changing an unrelated membership or business.
 IF EXISTS (SELECT 1 FROM public.latido_card_memberships WHERE
  (user_id=member_id AND id<>'ca4d0000-0000-4000-8000-000000000001') OR
  (user_id=paused_id AND id<>'ca4d0000-0000-4000-8000-000000000002') OR
  (id='ca4d0000-0000-4000-8000-000000000001' AND user_id<>member_id) OR
  (id='ca4d0000-0000-4000-8000-000000000002' AND user_id<>paused_id)) THEN
  RAISE EXCEPTION 'Una cuenta o UUID de prueba ya pertenece a otra membresía; no se modifica.';
 END IF;
 IF EXISTS (SELECT 1 FROM public.latido_card_memberships WHERE user_id=owner_id) THEN
  RAISE EXCEPTION 'El propietario de prueba debe estar sin membresía para verificar la participación gratuita.';
 END IF;
 INSERT INTO public.latido_card_memberships(id,user_id,status,valid_until) VALUES
 ('ca4d0000-0000-4000-8000-000000000001',member_id,'active',now()+interval '30 days'),
 ('ca4d0000-0000-4000-8000-000000000002',paused_id,'paused',now()+interval '30 days')
 ON CONFLICT (id) DO NOTHING;

 FOR item IN SELECT * FROM (VALUES
  ('ca4d0000-0000-4000-8000-000000000101'::uuid,'[TEST] Restaurante Sabor Latino','restaurante','Zürich','ZH'),
  ('ca4d0000-0000-4000-8000-000000000102'::uuid,'[TEST] Peluquería Brisa Latina','peluqueria','Luzern','LU'),
  ('ca4d0000-0000-4000-8000-000000000103'::uuid,'[TEST] Tienda Raíces','tienda','Bern','BE')
 ) AS examples(id,name,category,city,canton) LOOP
  IF EXISTS (SELECT 1 FROM public.providers p WHERE p.id=item.id
    AND (p.user_id IS DISTINCT FROM owner_id OR p.name<>item.name)) THEN
   RAISE EXCEPTION 'UUID de negocio de prueba ocupado; no se modifica: %',item.id;
  END IF;
  INSERT INTO public.providers(id,user_id,name,category,city,canton,description,active)
  VALUES(item.id,owner_id,item.name,item.category,item.city,item.canton,
   'Negocio ficticio para pruebas de Latido Card. No es una oferta comercial real.',true)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.latido_card_businesses(provider_id,active) VALUES(item.id,true)
  ON CONFLICT (provider_id) DO NOTHING;
 END LOOP;

 FOR item IN SELECT * FROM (VALUES
  ('ca4d0000-0000-4000-8000-000000000201'::uuid,'ca4d0000-0000-4000-8000-000000000101'::uuid,
   '[TEST] 15 % desde CHF 50','15 % en la cuenta del restaurante. El empleado verifica el consumo mínimo.',
   'percent',15::numeric,50::numeric,false,NULL::integer,'month'),
  ('ca4d0000-0000-4000-8000-000000000202'::uuid,'ca4d0000-0000-4000-8000-000000000101'::uuid,
   '[TEST] Café gratis','Un café de cortesía con tu visita. Reclama primero; reserva durante 7 días.',
   'gift',NULL::numeric,0::numeric,true,20,'lifetime'),
  ('ca4d0000-0000-4000-8000-000000000203'::uuid,'ca4d0000-0000-4000-8000-000000000102'::uuid,
   '[TEST] 10 % en tu corte','Descuento en servicios de corte; incluido en la membresía y sin límite de visitas.',
   'percent',10::numeric,0::numeric,false,NULL::integer,'unlimited'),
  ('ca4d0000-0000-4000-8000-000000000204'::uuid,'ca4d0000-0000-4000-8000-000000000102'::uuid,
   '[TEST] Asesoría capilar','Una asesoría de cuidado capilar de 15 minutos. Sujeta a cita previa.',
   'service',NULL::numeric,0::numeric,true,5,'lifetime'),
  ('ca4d0000-0000-4000-8000-000000000205'::uuid,'ca4d0000-0000-4000-8000-000000000103'::uuid,
   '[TEST] CHF 10 desde CHF 80','CHF 10 de descuento en compras desde CHF 80. Una vez por mes natural.',
   'fixed',10::numeric,80::numeric,false,NULL::integer,'month'),
  ('ca4d0000-0000-4000-8000-000000000206'::uuid,'ca4d0000-0000-4000-8000-000000000103'::uuid,
   '[TEST] 2×1 en productos seleccionados','El producto de menor precio es gratuito. Consulta la selección en tienda.',
   'two_for_one',NULL::numeric,0::numeric,true,10,'lifetime')
 ) AS examples(id,provider_id,title,description,benefit_type,benefit_value,minimum_spend,requires_claim,stock_total,usage_period) LOOP
  IF EXISTS (SELECT 1 FROM public.latido_card_offers o WHERE o.id=item.id AND o.provider_id<>item.provider_id) THEN
   RAISE EXCEPTION 'UUID de oferta de prueba ocupado; no se modifica: %',item.id;
  END IF;
  INSERT INTO public.latido_card_offers(id,provider_id,title,description,benefit_type,benefit_value,
   minimum_spend,requires_claim,stock_total,usage_period,ends_at)
  VALUES(item.id,item.provider_id,item.title,item.description,item.benefit_type,item.benefit_value,
   item.minimum_spend,item.requires_claim,item.stock_total,item.usage_period,now()+interval '60 days')
  ON CONFLICT (id) DO NOTHING;
 END LOOP;
END $$;
COMMIT;

SELECT p.email,m.status,m.member_number,m.valid_until FROM public.latido_card_memberships m
JOIN public.profiles p ON p.id=m.user_id
WHERE m.id IN ('ca4d0000-0000-4000-8000-000000000001','ca4d0000-0000-4000-8000-000000000002');
SELECT p.name,o.title,o.benefit_type,o.requires_claim,o.stock_total FROM public.latido_card_offers o
JOIN public.providers p ON p.id=o.provider_id
WHERE o.id IN ('ca4d0000-0000-4000-8000-000000000201','ca4d0000-0000-4000-8000-000000000202',
 'ca4d0000-0000-4000-8000-000000000203','ca4d0000-0000-4000-8000-000000000204',
 'ca4d0000-0000-4000-8000-000000000205','ca4d0000-0000-4000-8000-000000000206');
