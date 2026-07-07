-- Strike & Fine Accountability System
-- Adds: strikes, fines, grace_usage, cannot_complete_usage
-- Rule reference: STRICT ATTENDANCE & STRIKE SYSTEM spec

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS auto_checkout BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- FINES (created first — strikes references it)
-- ============================================================
CREATE TABLE public.fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL DEFAULT 100,
  strikes_count INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'waived')),
  deadline DATE NOT NULL, -- Sunday of the week it was raised (IST)
  proof_url TEXT,
  dispute_reason TEXT,
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- STRIKES
-- ============================================================
CREATE TABLE public.strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('late_checkin', 'missed_checkout', 'fine_deadline_missed')),
  source_id UUID, -- e.g. attendance.id that triggered it
  fine_id UUID REFERENCES public.fines(id),
  is_removed BOOLEAN NOT NULL DEFAULT false,
  removed_by UUID REFERENCES public.users(id),
  removed_reason TEXT,
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- GRACE USAGE (check-in grace, 2x per week)
-- ============================================================
CREATE TABLE public.grace_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL, -- Monday of the week (IST)
  used_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, week_start)
);

-- ============================================================
-- CANNOT-COMPLETE USAGE (1 free per day, 2nd+ needs approval)
-- ============================================================
CREATE TABLE public.cannot_complete_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  date DATE NOT NULL, -- IST calendar date
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'auto_accepted' CHECK (status IN ('auto_accepted', 'pending_approval', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_strikes_user_id ON public.strikes(user_id);
CREATE INDEX idx_strikes_is_removed ON public.strikes(is_removed);
CREATE INDEX idx_fines_user_id ON public.fines(user_id);
CREATE INDEX idx_fines_status ON public.fines(status);
CREATE INDEX idx_grace_usage_user_week ON public.grace_usage(user_id, week_start);
CREATE INDEX idx_cannot_complete_user_date ON public.cannot_complete_usage(user_id, date);
CREATE INDEX idx_cannot_complete_status ON public.cannot_complete_usage(status);

-- ============================================================
-- IMMUTABILITY: strikes & fines rows are never hard-deleted.
-- Strike "removal" = soft update (is_removed=true), never DELETE.
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_strike_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'strikes records cannot be deleted — use is_removed flag instead';
END;
$$;

CREATE TRIGGER strikes_prevent_delete
  BEFORE DELETE ON public.strikes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_strike_delete();

CREATE OR REPLACE FUNCTION public.prevent_fine_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'fines records cannot be deleted';
END;
$$;

CREATE TRIGGER fines_prevent_delete
  BEFORE DELETE ON public.fines
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_fine_delete();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.strikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grace_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cannot_complete_usage ENABLE ROW LEVEL SECURITY;

-- Everyone can read their own strikes; admins/super_admin read all.
CREATE POLICY strikes_select_own ON public.strikes
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin'))
  );

-- Only super_admin can update (removal) or insert directly via service role normally,
-- but keep an explicit policy for direct client safety.
CREATE POLICY strikes_update_super_admin_only ON public.strikes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

CREATE POLICY fines_select_own ON public.fines
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin'))
  );

CREATE POLICY fines_update_super_admin_only ON public.fines
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

-- Employee can insert their own dispute proof/reason (still status stays pending until super_admin acts)
CREATE POLICY fines_dispute_own ON public.fines
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY grace_usage_select_own ON public.grace_usage
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin'))
  );

CREATE POLICY cannot_complete_select_own ON public.cannot_complete_usage
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin'))
  );

CREATE POLICY cannot_complete_update_admin ON public.cannot_complete_usage
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

-- NOTE: all writes from the app happen via the admin (service-role) client in
-- strike-fine-engine.ts, so these policies are a safety net, not the primary gate.