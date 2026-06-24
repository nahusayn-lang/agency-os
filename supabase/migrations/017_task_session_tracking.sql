ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS session_start_time TIMESTAMPTZ;