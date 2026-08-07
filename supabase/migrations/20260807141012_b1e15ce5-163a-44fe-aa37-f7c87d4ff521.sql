CREATE TABLE public.video_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid REFERENCES public.videos(id) ON DELETE SET NULL,
  source_url text NOT NULL,
  consent_text text NOT NULL,
  accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.video_consents TO authenticated;
GRANT ALL ON public.video_consents TO service_role;

ALTER TABLE public.video_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own consents select" ON public.video_consents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "own consents insert" ON public.video_consents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX video_consents_user_id_idx ON public.video_consents (user_id, accepted_at DESC);