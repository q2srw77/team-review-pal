
-- Add report_pdf_path column to review_requests
ALTER TABLE public.review_requests ADD COLUMN report_pdf_path text;

-- Create review-reports storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-reports', 'review-reports', true);

-- Storage RLS: anyone authenticated can read
CREATE POLICY "Authenticated users can read review reports"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'review-reports');

-- Service role can insert
CREATE POLICY "Service role can insert review reports"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'review-reports' AND auth.role() = 'service_role');

-- Enable pg_net extension for async HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Update auto_update_request_status to call generate-review-report when completed
CREATE OR REPLACE FUNCTION public.auto_update_request_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  total_count int;
  completed_count int;
  in_review_count int;
  new_status text;
  current_status text;
  supabase_url text;
  service_role_key text;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE status = 'completed'),
         count(*) FILTER (WHERE status = 'in_review')
  INTO total_count, completed_count, in_review_count
  FROM public.review_statuses
  WHERE request_id = NEW.request_id;

  IF total_count > 0 AND completed_count = total_count THEN
    new_status := 'completed';
  ELSIF in_review_count > 0 OR completed_count > 0 THEN
    new_status := 'in_review';
  ELSE
    new_status := 'pending';
  END IF;

  -- Get current status to detect transition to completed
  SELECT status::text INTO current_status
  FROM public.review_requests
  WHERE id = NEW.request_id;

  UPDATE public.review_requests
  SET status = new_status::request_status
  WHERE id = NEW.request_id;

  -- If transitioning to completed, trigger PDF report generation
  IF new_status = 'completed' AND current_status != 'completed' THEN
    SELECT decrypted_secret INTO supabase_url
    FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
    SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1;

    IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
      PERFORM extensions.http_post(
        url := supabase_url || '/functions/v1/generate-review-report',
        body := json_build_object('request_id', NEW.request_id)::text,
        headers := json_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        )::jsonb
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
