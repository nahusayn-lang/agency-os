-- Attendance settings (Sunday off toggle) + Holidays + fix emergency-checkout/leave mixup

-- ============================================================
-- ATTENDANCE SETTINGS (single row, Sunday off toggle)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_settings (
  id INT PRIMARY KEY DEFAULT 1,
  sunday_off BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.attendance_settings (id, sunday_off)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- HOLIDAYS (manual date range)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_dates ON public.holidays (start_date, end_date);

-- ============================================================
-- FIX: emergency-checkout vs leave-request confusion.
-- Old code matched on message TITLE text (case-sensitive, fragile).
-- New: explicit boolean flag set at insert time.
-- ============================================================
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_emergency_checkout BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing emergency-checkout rows so old data keeps working
UPDATE public.messages
SET is_emergency_checkout = true
WHERE type = 'leave_request'
  AND title ILIKE 'emergency checkout request';

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_settings_select_all ON public.attendance_settings
  FOR SELECT USING (true);

CREATE POLICY attendance_settings_update_super_admin ON public.attendance_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

CREATE POLICY holidays_select_all ON public.holidays
  FOR SELECT USING (true);

CREATE POLICY holidays_write_super_admin ON public.holidays
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

-- NOTE: all writes from the app happen via the admin (service-role) client,
-- these policies are a safety net, same pattern as strikes/fines.