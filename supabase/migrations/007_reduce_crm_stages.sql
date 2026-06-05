-- Reduce CRM pipeline to 6 stages; remap legacy stage values (no row deletes).

UPDATE public.leads SET stage = 'call_pending' WHERE stage = 'follow_up';
UPDATE public.leads SET stage = 'interested' WHERE stage = 'meeting_scheduled';
UPDATE public.leads SET stage = 'negotiation' WHERE stage = 'proposal_sent';

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_stage_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_stage_check CHECK (
    stage IN (
      'new_lead',
      'call_pending',
      'interested',
      'negotiation',
      'deal_won',
      'deal_lost'
    )
  );
