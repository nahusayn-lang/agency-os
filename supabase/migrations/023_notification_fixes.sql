-- Migration 022: Notification system fixes
--
-- Fixes three real bugs:
-- 1. "notifications" had RLS enabled but NO delete policy, so Clear All /
--    swipe-to-delete looked like it worked (optimistic UI) but never
--    actually removed the row — it reappeared on next load.
-- 2. "push_subscriptions" was referenced by the push API routes but the
--    table was never created in any migration — every subscribe/send call
--    was failing against a relation that doesn't exist.
-- 3. Adds tracking columns so a daily reminder sweep can notify users
--    about approaching task/fine deadlines exactly once (not every run).

-- ============================================================
-- 1. Allow users to delete their own notifications
-- ============================================================
CREATE POLICY notifications_delete ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 2. push_subscriptions table (Web Push)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subscription TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- A user may only see/manage their own subscription row via the normal
-- client. All server-side inserts/sends go through the admin (service role)
-- client in src/lib/notifications/push.ts, which bypasses RLS entirely —
-- these policies only matter if a user's own session ever queries this table.
CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY push_subscriptions_insert_own ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY push_subscriptions_update_own ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER set_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_messages_updated_at();

-- ============================================================
-- 3. Deadline-reminder tracking columns (so the daily cron sweep
--    only pings once per deadline instead of every run)
-- ============================================================
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS deadline_reminder_sent BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.fines
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT false;