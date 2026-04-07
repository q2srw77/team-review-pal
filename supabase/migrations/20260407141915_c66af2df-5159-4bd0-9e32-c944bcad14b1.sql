-- Move any archived requests to completed
UPDATE public.review_requests SET status = 'completed' WHERE status = 'archived';

-- Drop the default before changing the type
ALTER TABLE public.review_requests ALTER COLUMN status DROP DEFAULT;

-- Recreate enum without 'archived'
ALTER TYPE public.request_status RENAME TO request_status_old;
CREATE TYPE public.request_status AS ENUM ('pending', 'in_review', 'completed');
ALTER TABLE public.review_requests
  ALTER COLUMN status TYPE public.request_status USING status::text::public.request_status;
DROP TYPE public.request_status_old;

-- Restore the default
ALTER TABLE public.review_requests ALTER COLUMN status SET DEFAULT 'pending'::request_status;

-- Drop archived_at column
ALTER TABLE public.review_requests DROP COLUMN IF EXISTS archived_at;

-- Drop cleanup function
DROP FUNCTION IF EXISTS public.cleanup_old_archived_requests();