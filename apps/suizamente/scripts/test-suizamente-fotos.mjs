import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {database,A,B} from './lib/suizamente-v2-test-db.mjs'
const db=await database({independiente:true})
try{
 await db.exec(`CREATE SCHEMA storage;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(bucket_id text,name text);
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$;
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT USAGE ON SCHEMA storage TO authenticated,anon;
 GRANT ALL ON storage.objects TO authenticated,anon;
 -- Simulate an unrelated broad policy: it must not bypass this bucket's guard.
 CREATE POLICY unrelated_delete ON storage.objects FOR DELETE TO authenticated USING(true);`)
 const sql=await readFile('supabase/suizamente_v16_fotos.sql','utf8');await db.exec(sql);await db.exec(sql)
 const as=async(id,query,args=[])=>db.transaction(async tx=>{await tx.query("SELECT set_config('test.uid',$1,true)",[id||'']);await tx.exec('SET LOCAL ROLE '+(id?'authenticated':'anon'));return tx.query(query,args)})
 await as(A,'INSERT INTO storage.objects VALUES($1,$2)',['suizamente-avatars',A+'/photo.jpg'])
 await assert.rejects(as(B,'INSERT INTO storage.objects VALUES($1,$2)',['suizamente-avatars',A+'/other.jpg']),e=>e.code==='42501')
 await assert.rejects(as(null,'INSERT INTO storage.objects VALUES($1,$2)',['suizamente-avatars',A+'/anon.jpg']),e=>e.code==='42501')
 assert.equal((await as(B,'SELECT * FROM storage.objects')).rows.length,0)
 assert.equal((await as(B,'DELETE FROM storage.objects WHERE bucket_id=$1 RETURNING *',['suizamente-avatars'])).rows.length,0)
 assert.equal((await as(A,'SELECT * FROM storage.objects')).rows.length,1)
 const bucket=(await db.query("SELECT * FROM storage.buckets WHERE id='suizamente-avatars'")).rows[0]
 assert.equal(bucket.file_size_limit,200000);assert.deepEqual(bucket.allowed_mime_types,['image/jpeg'])
 assert.equal((await db.query('SELECT count(*) n FROM public.profiles')).rows[0].n,3)
 console.log('Game photos: isolated bucket, owner-only upload/delete, foreign/anonymous access denied, repeated migration passed.')
}finally{await db.close()}
