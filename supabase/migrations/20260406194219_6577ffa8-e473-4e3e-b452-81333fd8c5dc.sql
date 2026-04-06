
-- 1. Make review-reports bucket private
UPDATE storage.buckets SET public = false WHERE id = 'review-reports';

-- 2. Drop existing overly broad storage SELECT policy and replace with scoped one
DROP POLICY IF EXISTS "Authenticated users can read review reports" ON storage.objects;

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
          OR EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = rr.team_id AND tm.user_id = auth.uid()
          )
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  )
);

-- 3. Add DELETE and UPDATE policies for admins on storage
CREATE POLICY "Admins can delete review reports"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'review-reports'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update review reports"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'review-reports'
  AND public.has_role(auth.uid(), 'admin')
);

-- 4. Tighten SELECT policies on core tables to team-scoped access

-- profiles: own profile OR same team OR admin
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles viewable by team or self"
ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.team_members tm1
    JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid() AND tm2.user_id = profiles.user_id
  )
);

-- user_roles: own roles or admin
DROP POLICY IF EXISTS "Roles viewable by authenticated users" ON public.user_roles;
CREATE POLICY "Roles viewable by self or admin"
ON public.user_roles FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
);

-- review_requests: submitter, team member, or admin
DROP POLICY IF EXISTS "Requests viewable by authenticated users" ON public.review_requests;
CREATE POLICY "Requests viewable by team or submitter"
ON public.review_requests FOR SELECT TO authenticated
USING (
  auth.uid() = submitted_by
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = review_requests.team_id AND tm.user_id = auth.uid()
  )
);

-- request_notes: notes on requests user can see
DROP POLICY IF EXISTS "Notes viewable by authenticated users" ON public.request_notes;
CREATE POLICY "Notes viewable by team or submitter"
ON public.request_notes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.review_requests rr
    WHERE rr.id = request_notes.request_id
      AND (
        rr.submitted_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.team_id = rr.team_id AND tm.user_id = auth.uid()
        )
      )
  )
);

-- review_statuses: statuses on requests user can see
DROP POLICY IF EXISTS "Review statuses viewable by authenticated users" ON public.review_statuses;
CREATE POLICY "Review statuses viewable by team or submitter"
ON public.review_statuses FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.review_requests rr
    WHERE rr.id = review_statuses.request_id
      AND (
        rr.submitted_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.team_id = rr.team_id AND tm.user_id = auth.uid()
        )
      )
  )
);

-- team_members: own teams or admin
DROP POLICY IF EXISTS "Team members viewable by authenticated users" ON public.team_members;
CREATE POLICY "Team members viewable by own team or admin"
ON public.team_members FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid()
  )
);

-- teams: own teams or admin
DROP POLICY IF EXISTS "Teams viewable by authenticated users" ON public.teams;
CREATE POLICY "Teams viewable by member or admin"
ON public.teams FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = teams.id AND tm.user_id = auth.uid()
  )
);
