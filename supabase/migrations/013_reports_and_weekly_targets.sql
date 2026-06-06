-- Phase B: Reports and Weekly Targets

-- Reports table for daily member submissions
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  what_i_did_today TEXT NOT NULL,
  completed_work TEXT NOT NULL,
  pending_work TEXT NOT NULL,
  blockers TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weekly Targets table for admin assignment and member tracking
CREATE TABLE public.weekly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.users(id),
  target_name TEXT NOT NULL,
  completion_percentage INTEGER NOT NULL DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reports audit table
CREATE TABLE public.reports_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weekly targets audit table
CREATE TABLE public.weekly_targets_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_target_id UUID NOT NULL REFERENCES public.weekly_targets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  action TEXT NOT NULL,
  old_completion_percentage INTEGER,
  new_completion_percentage INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_reports_user_id ON public.reports(user_id);
CREATE INDEX idx_reports_created_at ON public.reports(created_at);
CREATE INDEX idx_weekly_targets_user_id ON public.weekly_targets(user_id);
CREATE INDEX idx_weekly_targets_admin_id ON public.weekly_targets(admin_id);
CREATE INDEX idx_weekly_targets_created_at ON public.weekly_targets(created_at);

-- RLS for reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can insert their own reports"
  ON public.reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can view their own reports and admins can view all"
  ON public.reports
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin_or_super_admin()
  );

CREATE POLICY "Members can update their own reports"
  ON public.reports
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS for weekly_targets
ALTER TABLE public.weekly_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert weekly targets"
  ON public.weekly_targets
  FOR INSERT
  WITH CHECK (public.is_admin_or_super_admin() AND auth.uid() = admin_id);

CREATE POLICY "Members see their targets and admins see all"
  ON public.weekly_targets
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin_or_super_admin()
  );

CREATE POLICY "Members can update their completion percentage"
  ON public.weekly_targets
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND completion_percentage >= 0 AND completion_percentage <= 100);

CREATE POLICY "Admins can update targets for notes and percentage"
  ON public.weekly_targets
  FOR UPDATE
  USING (public.is_admin_or_super_admin())
  WITH CHECK (public.is_admin_or_super_admin());

-- Audit tables: allow select
ALTER TABLE public.reports_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view report audits"
  ON public.reports_audit
  FOR SELECT
  USING (true);

ALTER TABLE public.weekly_targets_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view weekly target audits"
  ON public.weekly_targets_audit
  FOR SELECT
  USING (true);

-- Triggers to update updated_at
CREATE OR REPLACE FUNCTION public.set_reports_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_reports_updated_at
BEFORE UPDATE ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.set_reports_updated_at();

CREATE OR REPLACE FUNCTION public.set_weekly_targets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_weekly_targets_updated_at
BEFORE UPDATE ON public.weekly_targets
FOR EACH ROW
EXECUTE FUNCTION public.set_weekly_targets_updated_at();
