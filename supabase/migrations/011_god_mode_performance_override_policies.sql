-- Allow admins to insert performance score overrides (founder accountability / god mode audit)

CREATE POLICY "god_mode_overrides_insert_admin_performance"
  ON public.god_mode_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    action = 'override_performance_score'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
        AND is_active = true
    )
    AND super_admin_id = auth.uid()
  );
