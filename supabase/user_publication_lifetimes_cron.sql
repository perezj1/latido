-- Public SELECT policies enforce the exact deadline; this job updates management state.
SELECT cron.schedule('latido-expire-user-publications','* * * * *',
  'SELECT public.expire_limited_user_publications();');
