-- Allow admins to read all user profiles; members can read task-related users

CREATE POLICY "users_select_admin"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_super_admin());

CREATE POLICY "users_select_task_related"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.assigned_to = auth.uid()
        AND (t.assigned_by = users.id OR t.assigned_to = users.id)
    )
  );

CREATE POLICY "users_select_lead_related"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.assigned_to = auth.uid()
        AND l.assigned_to = users.id
    )
  );
