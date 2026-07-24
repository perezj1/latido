-- Reemplaza la imagen externa eliminada de DJ Sebastián Vega.
UPDATE public.providers
SET photo_url = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop'
WHERE name = 'DJ Sebastián Vega'
  AND category = 'dj'
  AND photo_url = 'https://images.unsplash.com/photo-1571266028243-3716f02d2d50?w=400&h=300&fit=crop';
