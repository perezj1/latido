-- SOLO LECTURA. Ejecutar primero en Supabase SQL Editor.
-- Todos los requisitos deben mostrar OK antes de instalar Latido Card.
-- No reinstalar schema.sql ni business_promotion_plans.sql sobre una app existente.
SELECT requisito, CASE WHEN instalado THEN 'OK' ELSE 'FALTA' END AS estado
FROM (VALUES
 ('Supabase Auth', to_regclass('auth.users') IS NOT NULL AND to_regprocedure('auth.uid()') IS NOT NULL),
 ('Perfiles de Latido', to_regclass('public.profiles') IS NOT NULL),
 ('Negocios de Latido', to_regclass('public.providers') IS NOT NULL),
 ('Lista de administradores', to_regclass('public.business_promotion_admins') IS NOT NULL),
 ('Permiso de administrador', to_regprocedure('public.is_business_promotion_admin()') IS NOT NULL),
 ('Notificaciones de Latido', to_regclass('public.app_notifications') IS NOT NULL)
) AS requisitos(requisito, instalado);

-- Estado de Card: FALTA es normal antes de su primera instalación.
SELECT componente, CASE WHEN instalado THEN 'INSTALADO' ELSE 'PENDIENTE' END AS estado
FROM (VALUES
 ('Sistema Card', to_regclass('public.latido_card_memberships') IS NOT NULL),
 ('Solicitudes físicas', to_regclass('public.latido_card_physical_requests') IS NOT NULL),
 ('Cola email', to_regclass('public.latido_card_physical_email_queue') IS NOT NULL),
 ('Alta directa, QR automático y favoritas', to_regprocedure('public.lc_business_setup(uuid,text)') IS NOT NULL AND to_regclass('public.latido_card_saved_offers') IS NOT NULL)
) AS componentes(componente, instalado);
