-- Migration 014: Messaging and Realtime Notifications System

-- Messages Table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- Nullable for announcements
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('direct', 'announcement', 'leave_request', 'task_clarification')),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE, -- Optional reference for clarification
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications Table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_messages_sender ON public.messages (sender_id);
CREATE INDEX idx_messages_recipient ON public.messages (recipient_id);
CREATE INDEX idx_messages_type ON public.messages (type);
CREATE INDEX idx_notifications_user ON public.notifications (user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications (is_read);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Messages RLS Policies
CREATE POLICY messages_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR recipient_id IS NULL
    OR public.is_admin_or_super_admin()
  );

CREATE POLICY messages_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      type != 'announcement'
      OR public.is_admin_or_super_admin()
    )
  );

CREATE POLICY messages_update ON public.messages
  FOR UPDATE TO authenticated
  USING (
    recipient_id = auth.uid()
    OR public.is_admin_or_super_admin()
  )
  WITH CHECK (
    recipient_id = auth.uid()
    OR public.is_admin_or_super_admin()
  );

-- Notifications RLS Policies
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true); -- Triggers or server actions can insert

CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Triggers for automatic notifications generation

-- Function to create notification when a new message is inserted
CREATE OR REPLACE FUNCTION public.create_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Direct messages, task clarifications, or leave requests
  IF NEW.recipient_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, link)
    VALUES (
      NEW.recipient_id,
      CASE 
        WHEN NEW.type = 'direct' THEN 'New Direct Message'
        WHEN NEW.type = 'leave_request' THEN 'New Leave Request'
        WHEN NEW.type = 'task_clarification' THEN 'New Task Clarification'
        ELSE 'New Message'
      END,
      SUBSTRING(NEW.content FROM 1 FOR 100),
      '/messages'
    );
  -- Announcements: notify all active users except the sender
  ELSIF NEW.type = 'announcement' THEN
    INSERT INTO public.notifications (user_id, title, message, link)
    SELECT id, 'Announcement: ' || NEW.title, SUBSTRING(NEW.content FROM 1 FOR 100), '/messages'
    FROM public.users
    WHERE id != NEW.sender_id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_message_notification
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.create_message_notification();

-- Function to notify the sender when leave request status is updated
CREATE OR REPLACE FUNCTION public.update_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.type = 'leave_request' THEN
    INSERT INTO public.notifications (user_id, title, message, link)
    VALUES (
      NEW.sender_id,
      'Leave Request ' || INITCAP(NEW.status),
      'Your leave request has been ' || NEW.status || ' by the administrator.',
      '/messages'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_message_update_notification
  AFTER UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_message_notification();

-- Update updated_at trigger for messages
CREATE OR REPLACE FUNCTION public.set_messages_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_messages_updated_at();

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
