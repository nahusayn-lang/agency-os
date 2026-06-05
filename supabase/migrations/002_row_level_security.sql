-- Agency OS: row-level security policies

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.god_mode_overrides ENABLE ROW LEVEL SECURITY;

-- users: authenticated users read their own profile
CREATE POLICY "users_select_own"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- attendance: authenticated users read their own records
CREATE POLICY "attendance_select_own"
  ON public.attendance
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- audit_log: INSERT and SELECT only — no UPDATE or DELETE policies
CREATE POLICY "audit_log_insert_own"
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "audit_log_select_own"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- god_mode_overrides: super_admin only (schema ready for future use)
CREATE POLICY "god_mode_overrides_insert_super_admin"
  ON public.god_mode_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "god_mode_overrides_select_super_admin"
  ON public.god_mode_overrides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Table-level grants: audit_log is append-only for every role
REVOKE UPDATE, DELETE ON public.audit_log FROM authenticated;
REVOKE UPDATE, DELETE ON public.audit_log FROM anon;
REVOKE UPDATE, DELETE ON public.audit_log FROM service_role;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.attendance TO authenticated;
GRANT INSERT, SELECT ON public.audit_log TO authenticated;
