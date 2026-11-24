-- Dedicated game photos. No writes to Latido profiles or its avatar bucket.
BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('suizamente-avatars','suizamente-avatars',true,200000,ARRAY['image/jpeg'])
ON CONFLICT(id) DO UPDATE SET public=true,file_size_limit=200000,allowed_mime_types=ARRAY['image/jpeg'];
-- Scope the guard to this bucket, even if another app has broad permissive policies.
DROP POLICY IF EXISTS suizamente_avatar_owner ON storage.objects;
CREATE POLICY suizamente_avatar_owner ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
 USING(bucket_id<>'suizamente-avatars' OR (storage.foldername(name))[1]=(SELECT auth.uid())::text)
 WITH CHECK(bucket_id<>'suizamente-avatars' OR (storage.foldername(name))[1]=(SELECT auth.uid())::text);
DROP POLICY IF EXISTS suizamente_avatar_insert ON storage.objects;
CREATE POLICY suizamente_avatar_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='suizamente-avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
DROP POLICY IF EXISTS suizamente_avatar_read ON storage.objects;
CREATE POLICY suizamente_avatar_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='suizamente-avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
DROP POLICY IF EXISTS suizamente_avatar_delete ON storage.objects;
CREATE POLICY suizamente_avatar_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='suizamente-avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
NOTIFY pgrst,'reload schema';
COMMIT;
