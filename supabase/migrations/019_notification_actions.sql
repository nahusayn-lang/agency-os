-- Migration 019: Notification actions (inline approve/reject) + better deep-links

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS reference_id UUID;

-- Recreate: use the message's own title/content instead of a generic string,
-- and stamp type + reference_id so the client can render inline actions.
CREATE OR REPLACE FUNCTION public.create_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.recipient_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, link, type, reference_id)
    VALUES (
      NEW.recipient_id,
      NEW.title,
      SUBSTRING(NEW.content FROM 1 FOR 100),
      '/messages',
      NEW.type,
      NEW.id
    );
  ELSIF NEW.type = 'announcement' THEN
    INSERT INTO public.notifications (user_id, title, message, link, type, reference_id)
    SELECT id, 'Announcement: ' || NEW.title, SUBSTRING(NEW.content FROM 1 FOR 100), '/messages', 'announcement', NEW.id
    FROM public.users
    WHERE id != NEW.sender_id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.type = 'leave_request' THEN
    INSERT INTO public.notifications (user_id, title, message, link, type, reference_id)
    VALUES (
      NEW.sender_id,
      'Leave Request ' || INITCAP(NEW.status),
      'Your leave request has been ' || NEW.status || ' by the administrator.',
      '/messages',
      'leave_request_result',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;