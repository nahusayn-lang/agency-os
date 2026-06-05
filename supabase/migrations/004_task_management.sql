-- Task Management module

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  deadline TIMESTAMPTZ,
  assigned_by UUID NOT NULL REFERENCES public.users(id),
  assigned_to UUID NOT NULL REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'in_progress',
      'waiting_review',
      'revision_required',
      'approved',
      'completed'
    )
  ),
  proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.task_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  performed_by UUID NOT NULL REFERENCES public.users(id),
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_assigned_by ON public.tasks(assigned_by);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX idx_task_activity_task_id ON public.task_activity(task_id);

CREATE OR REPLACE FUNCTION public.is_admin_or_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_task(task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
      AND (
        t.assigned_to = auth.uid()
        OR public.is_admin_or_super_admin()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.set_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tasks_updated_at();

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR public.is_admin_or_super_admin()
  );

CREATE POLICY "tasks_insert"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_super_admin()
    AND assigned_by = auth.uid()
  );

CREATE POLICY "tasks_update"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR public.is_admin_or_super_admin()
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR public.is_admin_or_super_admin()
  );

CREATE POLICY "task_comments_select"
  ON public.task_comments FOR SELECT
  TO authenticated
  USING (public.can_access_task(task_id));

CREATE POLICY "task_comments_insert"
  ON public.task_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_access_task(task_id)
  );

CREATE POLICY "task_activity_select"
  ON public.task_activity FOR SELECT
  TO authenticated
  USING (public.can_access_task(task_id));

CREATE POLICY "task_activity_insert"
  ON public.task_activity FOR INSERT
  TO authenticated
  WITH CHECK (
    performed_by = auth.uid()
    AND public.can_access_task(task_id)
  );

GRANT SELECT, INSERT, UPDATE ON public.tasks TO authenticated;
GRANT SELECT, INSERT ON public.task_comments TO authenticated;
GRANT SELECT, INSERT ON public.task_activity TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-proofs',
  'task-proofs',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "task_proofs_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'task-proofs'
    AND public.can_access_task((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "task_proofs_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'task-proofs'
    AND (storage.foldername(name))[1]::uuid IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = (storage.foldername(name))[1]::uuid
        AND t.assigned_to = auth.uid()
        AND t.status = 'in_progress'
    )
  );
