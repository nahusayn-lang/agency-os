ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS leave_date DATE;

CREATE INDEX IF NOT EXISTS idx_messages_leave_date ON public.messages (leave_date);

ALTER TABLE public.strikes DROP CONSTRAINT IF EXISTS strikes_reason_check;
ALTER TABLE public.strikes ADD CONSTRAINT strikes_reason_check
  CHECK (reason IN ('late_checkin', 'missed_checkout', 'fine_deadline_missed', 'no_checkin', 'leave_rejected'));