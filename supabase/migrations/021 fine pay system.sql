-- Fine Pay System v2
-- Adds: configurable fine amount (founder-only), 'submitted' status for the
-- pay-and-confirm flow, and a dedicated storage bucket for fine payment proof.

-- ============================================================
-- FINE SETTINGS (single row, founder-editable fine amount)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fine_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  amount NUMERIC(10,2) NOT NULL DEFAULT 149,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.fine_settings (id, amount)
VALUES (1, 149)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.fine_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY fine_settings_select_all ON public.fine_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY fine_settings_update_super_admin_only ON public.fine_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

-- ============================================================
-- FINES: add 'submitted' status (employee paid + uploaded proof,
-- awaiting founder confirmation) + a comment field (optional note).
-- ============================================================
ALTER TABLE public.fines DROP CONSTRAINT IF EXISTS fines_status_check;
ALTER TABLE public.fines ADD CONSTRAINT fines_status_check
  CHECK (status IN ('pending', 'submitted', 'paid', 'waived'));

ALTER TABLE public.fines ADD COLUMN IF NOT EXISTS payment_comment TEXT;
ALTER TABLE public.fines ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- ============================================================
-- STORAGE: fine-proofs bucket (private — screenshot of payment)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fine-proofs',
  'fine-proofs',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "fine_proofs_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'fine-proofs'
    AND (
      (storage.foldername(name))[1]::uuid = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin'))
    )
  );

CREATE POLICY "fine_proofs_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'fine-proofs'
    AND (storage.foldername(name))[1]::uuid = auth.uid()
  );