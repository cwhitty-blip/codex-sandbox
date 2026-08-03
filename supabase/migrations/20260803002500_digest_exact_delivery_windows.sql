select cron.schedule(
  'send-job-update-digests',
  '0 * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'job_digest_project_url')
        || '/functions/v1/send-job-digests',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-digest-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'job_digest_cron_secret')
      ),
      body := jsonb_build_object('triggered_at', now()),
      timeout_milliseconds := 10000
    ) as request_id;
  $cron$
);
