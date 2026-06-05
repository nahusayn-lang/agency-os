-- Phase A: performance_scores (immutable — insert only)

CREATE TABLE public.performance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  task_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  attendance_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  lead_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  report_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  total_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT performance_scores_period_check CHECK (period_end >= period_start),
  CONSTRAINT performance_scores_unique_period UNIQUE (user_id, period_start, period_end)
);

CREATE INDEX idx_performance_scores_user_id ON public.performance_scores(user_id);
CREATE INDEX idx_performance_scores_period ON public.performance_scores(period_start, period_end);

CREATE OR REPLACE FUNCTION public.prevent_performance_scores_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'performance_scores records are immutable and cannot be updated or deleted';
END;
$$;

CREATE TRIGGER performance_scores_prevent_update
  BEFORE UPDATE ON public.performance_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_performance_scores_mutation();

CREATE TRIGGER performance_scores_prevent_delete
  BEFORE DELETE ON public.performance_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_performance_scores_mutation();

CREATE OR REPLACE FUNCTION public.compute_total_performance_score(
  p_task_score NUMERIC,
  p_attendance_score NUMERIC,
  p_lead_score NUMERIC,
  p_report_score NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ROUND(
    (p_task_score * 0.4)
    + (p_attendance_score * 0.2)
    + (p_lead_score * 0.2)
    + (p_report_score * 0.2),
    2
  );
$$;

CREATE OR REPLACE FUNCTION public.score_user_task_performance(
  p_user_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    ROUND(
      100.0 * COUNT(*) FILTER (
        WHERE t.status IN ('completed', 'approved')
      ) / NULLIF(COUNT(*), 0),
      2
    ),
    0
  )
  FROM public.tasks t
  WHERE t.assigned_to = p_user_id
    AND t.created_at::date <= p_period_end
    AND (
      t.updated_at::date BETWEEN p_period_start AND p_period_end
      OR t.created_at::date BETWEEN p_period_start AND p_period_end
    );
$$;

CREATE OR REPLACE FUNCTION public.score_user_attendance_performance(
  p_user_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    ROUND(
      AVG(
        CASE a.status
          WHEN 'present' THEN 100
          WHEN 'late' THEN 70
          WHEN 'early_exit' THEN 50
          ELSE 0
        END
      ),
      2
    ),
    0
  )
  FROM public.attendance a
  WHERE a.user_id = p_user_id
    AND a.date BETWEEN p_period_start AND p_period_end;
$$;

CREATE OR REPLACE FUNCTION public.score_user_lead_performance(
  p_user_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  WITH assigned AS (
    SELECT l.id
    FROM public.leads l
    WHERE l.assigned_to = p_user_id
  ),
  active_leads AS (
    SELECT DISTINCT la.lead_id
    FROM public.lead_audit la
    INNER JOIN assigned a ON a.id = la.lead_id
    WHERE la.changed_at::date BETWEEN p_period_start AND p_period_end
  )
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM assigned) = 0 THEN 0
    ELSE COALESCE(
      ROUND(
        100.0 * (SELECT COUNT(*) FROM active_leads)
          / NULLIF((SELECT COUNT(*) FROM assigned), 0),
        2
      ),
      0
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_performance_scores_for_period(
  p_period_start DATE DEFAULT NULL,
  p_period_end DATE DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
  v_user RECORD;
  v_task_score NUMERIC;
  v_attendance_score NUMERIC;
  v_lead_score NUMERIC;
  v_report_score NUMERIC := 0;
  v_total_score NUMERIC;
  v_inserted INTEGER := 0;
BEGIN
  IF p_period_start IS NOT NULL AND p_period_end IS NOT NULL THEN
    v_period_start := p_period_start;
    v_period_end := p_period_end;
  ELSE
    -- Sunday job: score the Mon–Sat week that just ended (run at Sunday 00:00).
    v_period_end := CURRENT_DATE - 1;
    v_period_start := v_period_end - 6;
  END IF;

  FOR v_user IN
    SELECT id FROM public.users WHERE is_active = true
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.performance_scores ps
      WHERE ps.user_id = v_user.id
        AND ps.period_start = v_period_start
        AND ps.period_end = v_period_end
    ) THEN
      CONTINUE;
    END IF;

    v_task_score := public.score_user_task_performance(
      v_user.id,
      v_period_start,
      v_period_end
    );
    v_attendance_score := public.score_user_attendance_performance(
      v_user.id,
      v_period_start,
      v_period_end
    );
    v_lead_score := public.score_user_lead_performance(
      v_user.id,
      v_period_start,
      v_period_end
    );
    v_total_score := public.compute_total_performance_score(
      v_task_score,
      v_attendance_score,
      v_lead_score,
      v_report_score
    );

    INSERT INTO public.performance_scores (
      user_id,
      period_start,
      period_end,
      task_score,
      attendance_score,
      lead_score,
      report_score,
      total_score
    ) VALUES (
      v_user.id,
      v_period_start,
      v_period_end,
      v_task_score,
      v_attendance_score,
      v_lead_score,
      v_report_score,
      v_total_score
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;

ALTER TABLE public.performance_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "performance_scores_select_own"
  ON public.performance_scores FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "performance_scores_select_admin"
  ON public.performance_scores FOR SELECT
  TO authenticated
  USING (public.is_admin_or_super_admin());

REVOKE UPDATE, DELETE ON public.performance_scores FROM authenticated;
REVOKE UPDATE, DELETE ON public.performance_scores FROM anon;
REVOKE UPDATE, DELETE ON public.performance_scores FROM service_role;

GRANT SELECT ON public.performance_scores TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_performance_scores_for_period(DATE, DATE) TO service_role;
