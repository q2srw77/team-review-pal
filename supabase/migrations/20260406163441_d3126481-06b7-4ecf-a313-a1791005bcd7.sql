
-- Create platforms table
CREATE TABLE public.platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view platforms
CREATE POLICY "Platforms viewable by authenticated users"
  ON public.platforms FOR SELECT TO authenticated
  USING (true);

-- Admins can manage platforms
CREATE POLICY "Admins can manage platforms"
  ON public.platforms FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Change review_requests.platform from enum to text
ALTER TABLE public.review_requests ALTER COLUMN platform TYPE text;

-- Seed platforms with existing enum values
INSERT INTO public.platforms (name) VALUES
  ('Storylane'),
  ('Document'),
  ('AI Project'),
  ('MSP Project');
