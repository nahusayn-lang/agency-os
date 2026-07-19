-- Fix: due-strikes (fine_deadline_missed) should:
-- 1. Fire once per week per unpaid fine (not on every cron run within the same week)
-- 2. NOT feed into the general 3-strike-to-fine pool (isolated, standalone)

ALTER TABLE public.fines
  ADD COLUMN IF NOT EXISTS last_overdue_strike_week DATE;