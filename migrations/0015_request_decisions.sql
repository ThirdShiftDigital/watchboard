-- Denial reasons + who/when decided a days-off request.
-- Idempotent: safe to re-run by hand in the Supabase SQL editor. The app also
-- runs the same statements at startup (src/lib/schema-ensure.ts), because
-- migrations only apply on Netlify production builds and a failed connection
-- there does not fail the build.
--
-- denial_reason: optional note shown to the requesting officer ("Denied: …")
--   and to approvers. Kept as history after a Restore, but only shown while
--   the request is denied.
-- decided_by / decided_at: last approve / deny / restore (null for older rows).
alter table time_off_requests add column if not exists denial_reason text;
alter table time_off_requests add column if not exists decided_by text;
alter table time_off_requests add column if not exists decided_at timestamptz;
