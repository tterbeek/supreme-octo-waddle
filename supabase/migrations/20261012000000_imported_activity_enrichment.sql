-- Imported workouts are real activities; enrichment is optional and independent of source.
ALTER TABLE public.activities DROP CONSTRAINT activities_source_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_source_check
  CHECK (source IN ('manual', 'strava', 'polar'));

ALTER TABLE public.activities ADD COLUMN user_enrichment_status text NOT NULL DEFAULT 'completed';
ALTER TABLE public.activities ADD CONSTRAINT activities_user_enrichment_status_check
  CHECK (user_enrichment_status IN ('pending', 'completed'));

-- Token storage is service-role only. Never grant direct access to browser roles.
CREATE TABLE public.user_polar_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_polar_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_polar_connections FROM anon, authenticated;
GRANT ALL ON public.user_polar_connections TO service_role;
