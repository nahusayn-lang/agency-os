-- Tracks whether a user has initiated checkout but hasn't yet submitted
-- their mandatory daily report. Needed so the report modal can be
-- re-shown after a page refresh (it was previously only client-side
-- React state, which was lost on refresh, letting checkout silently
-- skip the report).
ALTER TABLE public.users
  ADD COLUMN checkout_report_pending BOOLEAN NOT NULL DEFAULT false;