-- Phase A: schedule weekly performance score calculation (Sunday 00:00, database timezone).
-- After deploy, enable the Edge Function schedule in Supabase Dashboard or via CLI:
--   supabase functions deploy calculate-weekly-performance-scores
-- Cron expression: 0 0 * * 0

COMMENT ON FUNCTION public.calculate_performance_scores_for_period IS
  'Inserts immutable performance_scores for active users. Skips existing (user_id, period_start, period_end). Called by calculate-weekly-performance-scores Edge Function on schedule.';
