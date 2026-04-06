

## Fix Infinite Recursion in team_members RLS Policy

### Problem
The `team_members` table has a SELECT policy that references itself, causing infinite recursion. The policy "Team members viewable by own team or admin" does `EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid())` -- this sub-select triggers the same RLS policy, creating an infinite loop. This breaks the entire app: profiles, teams, review_requests, and review_statuses all fail with 500 errors because their policies also reference `team_members`.

### Solution
Create a `SECURITY DEFINER` function `is_team_member` that checks team membership without going through RLS (same pattern as the existing `has_role` function). Then replace the recursive policies on `team_members` and `teams` with calls to this function. Also update the `profiles` policy which joins `team_members` to itself.

### Database Migration

1. Create helper function:
```sql
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
```

2. Replace `team_members` SELECT policy:
```sql
DROP POLICY "Team members viewable by own team or admin" ON public.team_members;
CREATE POLICY "Team members viewable by own team or admin"
ON public.team_members FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin') 
  OR is_team_member(auth.uid(), team_members.team_id)
);
```

3. Replace `teams` SELECT policy:
```sql
DROP POLICY "Teams viewable by member or admin" ON public.teams;
CREATE POLICY "Teams viewable by member or admin"
ON public.teams FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR is_team_member(auth.uid(), teams.id)
);
```

4. Replace `profiles` SELECT policy (uses self-join on team_members):
```sql
DROP POLICY "Profiles viewable by team or self" ON public.profiles;
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
```

5. Similarly fix `review_requests`, `request_notes`, `review_statuses`, and storage policies that reference `team_members` -- replace `EXISTS (SELECT 1 FROM team_members tm WHERE ...)` with `is_team_member(auth.uid(), ...)`.

### No code changes needed
The client-side code is correct. Only the database policies need fixing.

### Files to modify

| File | Change |
|------|--------|
| New migration | Create `is_team_member` function + replace 7 recursive RLS policies |

