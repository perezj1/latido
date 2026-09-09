-- Alemania Deutschschule AG: shared profile and content management.
-- Run in Supabase SQL editor AFTER creator_shared_access.sql.
-- Keeps the original owner and both users' personal accounts unchanged.
BEGIN;

DO $$
DECLARE
  target_creator CONSTANT TEXT := 'b5d83715-025e-44cd-8d36-e0dfa96f50fa';
  original_owner UUID;
  additional_admin UUID;
BEGIN
  SELECT id INTO STRICT original_owner
  FROM auth.users WHERE lower(email) = 'c.alvarez@alemania.ch';

  SELECT id INTO STRICT additional_admin
  FROM auth.users WHERE lower(email) = 'bryan@monterobrandconsulting.ch';

  PERFORM 1 FROM public.creator_profiles
  WHERE id = target_creator
    AND name = 'Alemania Deutschschule AG'
    AND owner_id = original_owner
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected Alemania Deutschschule AG profile owned by c.alvarez@alemania.ch; no access changed';
  END IF;

  INSERT INTO public.creator_members (creator_id, user_id, invited_by)
  VALUES (target_creator, additional_admin, original_owner)
  ON CONFLICT (creator_id, user_id) DO NOTHING;
END;
$$;

-- Verify the original owner and the additional administrator together.
SELECT profile.name, account.email, 'owner' AS access
FROM public.creator_profiles AS profile
JOIN auth.users AS account ON account.id = profile.owner_id
WHERE profile.id = 'b5d83715-025e-44cd-8d36-e0dfa96f50fa'
UNION ALL
SELECT profile.name, account.email, 'member' AS access
FROM public.creator_profiles AS profile
JOIN public.creator_members AS member ON member.creator_id = profile.id
JOIN auth.users AS account ON account.id = member.user_id
WHERE profile.id = 'b5d83715-025e-44cd-8d36-e0dfa96f50fa';

COMMIT;
