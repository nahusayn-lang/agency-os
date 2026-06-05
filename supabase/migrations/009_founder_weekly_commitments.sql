-- Phase A: founder weekly commitment (founder writes, team reads)

CREATE TABLE public.founder_weekly_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL UNIQUE,
  commitment_text TEXT NOT NULL,
  updated_by UUID NOT NULL REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_founder_weekly_commitments_week_start
  ON public.founder_weekly_commitments(week_start);

ALTER TABLE public.founder_weekly_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "founder_weekly_commitments_select_authenticated"
  ON public.founder_weekly_commitments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "founder_weekly_commitments_insert_super_admin"
  ON public.founder_weekly_commitments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "founder_weekly_commitments_update_super_admin"
  ON public.founder_weekly_commitments FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

GRANT SELECT ON public.founder_weekly_commitments TO authenticated;
GRANT INSERT, UPDATE ON public.founder_weekly_commitments TO authenticated;
