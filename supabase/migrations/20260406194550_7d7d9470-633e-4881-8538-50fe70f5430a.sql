
-- 1. Create is_team_member helper function (SECURITY DEFINER, bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id
  )
$$;

-- 2. Fix team_members SELECT policy (was self-referencing)
DROP POLICY IF EXISTS "Team members viewable by own team or admin" ON public.team_members;
CREATE POLICY "Team members viewable by own team or admin"
ON public.team_members FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR is_team_member(auth.uid(), team_members.team_id)
);

-- 3. Fix teams SELECT policy
DROP POLICY IF EXISTS "Teams viewable by member or admin" ON public.teams;
CREATE POLICY "Teams viewable by member or admin"
ON public.teams FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR is_team_member(auth.uid(), teams.id)
);

-- 4. Fix profiles SELECT policy (was joining team_members to itself)
DROP POLICY IF EXISTS "Profiles viewable by team or self" ON public.profiles;
CREATE POLICY "Profiles viewable by team or self"
ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = profiles.user_id
      AND is_team_member(auth.uid(), tm.team_id)
  )
);

-- 5. Fix review_requests SELECT policy
DROP POLICY IF EXISTS "Requests viewable by team or submitter" ON public.review_requests;
CREATE POLICY "Requests viewable by team or submitter"
ON public.review_requests FOR SELECT TO authenticated
USING (
  auth.uid() = submitted_by
  OR has_role(auth.uid(), 'admin')
  OR is_team_member(auth.uid(), review_requests.team_id)
);

-- 6. Fix request_notes SELECT policy
DROP POLICY IF EXISTS "Notes viewable by team or submitter" ON public.request_notes;
CREATE POLICY "Notes viewable by team or submitter"
ON public.request_notes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.review_requests rr
    WHERE rr.id = request_notes.request_id
      AND (
        rr.submitted_by = auth.uid()
        OR has_role(auth.uid(), 'admin')
        OR is_team_member(auth.uid(), rr.team_id)
      )
  )
);

-- 7. Fix review_statuses SELECT policy
DROP POLICY IF EXISTS "Review statuses viewable by team or submitter" ON public.review_statuses;
CREATE POLICY "Review statuses viewable by team or submitter"
ON public.review_statuses FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.review_requests rr
    WHERE rr.id = review_statuses.request_id
      AND (
        rr.submitted_by = auth.uid()
        OR has_role(auth.uid(), 'admin')
        OR is_team_member(auth.uid(), rr.team_id)
      )
  )
);

-- 8. Fix storage policy for review-reports
DROP POLICY IF EXISTS "Users can read own team review reports" ON storage.objects;
CREATE POLICY "Users can read own team review reports"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'review-reports'
  AND (
    EXISTS (
      SELECT 1 FROM public.review_requests rr
      WHERE rr.report_pdf_path = name
        AND (
          rr.submitted_by = auth.uid()
          OR is_team_member(auth.uid(), rr.team_id)
          OR has_role(auth.uid(), 'admin')
        )
    )
  )
);
