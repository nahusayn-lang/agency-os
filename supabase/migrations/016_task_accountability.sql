-- Migration 016: Task accountability additions

-- Add estimated hours and total time columns to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC,
  ADD COLUMN IF NOT EXISTS total_time_spent_seconds INTEGER DEFAULT 0;

-- Add paused status to allowed task statuses
-- Drop existing check constraint if it exists (name may vary)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.tasks'::regclass AND conname = 'tasks_status_check'
  ) THEN
    ALTER TABLE public.tasks DROP CONSTRAINT tasks_status_check;
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- ignore
END$$;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check CHECK (
    status IN (
      'pending', 'in_progress', 'paused', 'waiting_review', 'revision_required', 'approved', 'completed'
    )
  );

-- Add strikes to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS strikes INTEGER NOT NULL DEFAULT 0;

-- Add auto_checkout flag to attendance
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS auto_checkout BOOLEAN NOT NULL DEFAULT false;
