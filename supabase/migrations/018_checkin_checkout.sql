-- Rename login_time/logout_time to checkin_time/checkout_time for clarity
-- and add is_checked_in flag on users for live status

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS checkin_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkout_time TIMESTAMPTZ;

-- Copy existing data
UPDATE public.attendance SET
  checkin_time = login_time,
  checkout_time = logout_time
WHERE checkin_time IS NULL;

-- Track live check-in status on users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_checked_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_checkin_at TIMESTAMPTZ;