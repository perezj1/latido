-- Removes a third-party image that returns HTTP 403 and cannot be embedded.
-- Latido will show the provider category fallback until an authorized logo is uploaded.

UPDATE public.providers
SET
  photo_url = NULL,
  updated_at = NOW()
WHERE photo_url = 'https://www.anwalt-luzern.ch/images/Logo/logo-text7.png';
