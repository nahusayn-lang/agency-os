-- CRM module

CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  business_name TEXT,
  phone TEXT,
  email TEXT,
  stage TEXT NOT NULL DEFAULT 'new_lead' CHECK (
    stage IN (
      'new_lead',
      'call_pending',
      'follow_up',
      'interested',
      'meeting_scheduled',
      'proposal_sent',
      'negotiation',
      'deal_won',
      'deal_lost'
    )
  ),
  deal_value NUMERIC(12, 2),
  assigned_to UUID NOT NULL REFERENCES public.users(id),
  notes TEXT,
  last_contact TIMESTAMPTZ,
  next_followup TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES public.users(id),
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX idx_leads_stage ON public.leads(stage);
CREATE INDEX idx_lead_audit_lead_id ON public.lead_audit(lead_id);
CREATE INDEX idx_lead_audit_changed_at ON public.lead_audit(changed_at);

CREATE OR REPLACE FUNCTION public.can_access_lead(lead_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_id
      AND (
        l.assigned_to = auth.uid()
        OR public.is_admin_or_super_admin()
      )
  );
$$;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR public.is_admin_or_super_admin()
  );

CREATE POLICY "leads_insert"
  ON public.leads FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_super_admin()
  );

CREATE POLICY "leads_update"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR public.is_admin_or_super_admin()
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR public.is_admin_or_super_admin()
  );

CREATE POLICY "lead_audit_select"
  ON public.lead_audit FOR SELECT
  TO authenticated
  USING (public.can_access_lead(lead_id));

CREATE POLICY "lead_audit_insert"
  ON public.lead_audit FOR INSERT
  TO authenticated
  WITH CHECK (
    changed_by = auth.uid()
    AND public.can_access_lead(lead_id)
  );

REVOKE UPDATE, DELETE ON public.lead_audit FROM authenticated;
REVOKE UPDATE, DELETE ON public.lead_audit FROM anon;
REVOKE UPDATE, DELETE ON public.lead_audit FROM service_role;

GRANT SELECT, INSERT, UPDATE ON public.leads TO authenticated;
GRANT SELECT, INSERT ON public.lead_audit TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_lead_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'lead_audit records are immutable and cannot be updated or deleted';
END;
$$;

CREATE TRIGGER lead_audit_prevent_update
  BEFORE UPDATE ON public.lead_audit
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_lead_audit_mutation();

CREATE TRIGGER lead_audit_prevent_delete
  BEFORE DELETE ON public.lead_audit
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_lead_audit_mutation();
