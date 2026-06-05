-- Admins may read performance score override audit entries

CREATE POLICY "god_mode_overrides_select_admin_performance"
  ON public.god_mode_overrides
  FOR SELECT
  TO authenticated
  USING (
    action = 'override_performance_score'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
        AND is_active = true
    )
  );
