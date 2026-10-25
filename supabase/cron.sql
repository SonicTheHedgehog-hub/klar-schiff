-- Klar Schiff – Zeitplan für die Morgen-Erinnerung (nach schema.sql und dem Deploy der Edge Function ausführen).
-- <PROJECT_REF> durch die eigene Projekt-ID ersetzen. Die Funktion läuft mit verify_jwt = false
-- und verschickt jede Erinnerung höchstens einmal pro Tag, daher braucht der Aufruf keinen Schlüssel.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'klar-schiff-erinnerung',
  '*/15 * * * *',
  $$ select net.http_post(
       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/klar-schiff-push',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{"action":"cron"}'::jsonb,
       timeout_milliseconds := 20000
     ); $$
);
