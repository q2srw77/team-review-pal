

## Fix Email Notifications for New Review Requests

### Root Cause

The email sending infrastructure works correctly — I confirmed this by calling the function directly, and an email was successfully queued and sent. The problem is in the **client-side notification code** in `RequestForm.tsx`.

Two issues prevent notifications from being sent:

1. **Broken join query**: The query `supabase.from("team_members").select("user_id, profiles:user_id(email, full_name)")` uses a Supabase foreign-key join syntax, but there is **no foreign key** between `team_members.user_id` and `profiles.user_id`. This causes the join to fail silently, returning `null` for the profiles data. The code then hits `if (!profile?.email) continue` and skips every member.

2. **RLS visibility**: Even if the join worked, the `profiles` table RLS restricts which profiles a user can see (only self, admin, or same-team members). This could cause some profiles to be invisible depending on timing.

### Fix

Replace the single joined query with two separate queries that work reliably:

**In `src/components/RequestForm.tsx` (lines 66-80):**

Replace the team_members + profiles join with:
1. Fetch team member user IDs from `team_members`
2. Separately fetch profiles for those user IDs using `.in('user_id', memberIds)`
3. Match them up in code

```typescript
const { data: members } = await supabase
  .from("team_members")
  .select("user_id")
  .eq("team_id", teamId);

if (members && members.length > 0) {
  const otherMemberIds = members
    .filter((m) => m.user_id !== user.id)
    .map((m) => m.user_id);

  if (otherMemberIds.length > 0) {
    const { data: memberProfiles } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .in("user_id", otherMemberIds);

    const teamName = teams.find((t) => t.id === teamId)?.name || "";
    const { data: submitterProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberProfiles) {
      for (const profile of memberProfiles) {
        if (!profile.email) continue;
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "new-review-request",
            recipientEmail: profile.email,
            idempotencyKey: `review-notify-${requestId}-${profile.user_id}`,
            templateData: { ... },
          },
        });
      }
    }
  }
}
```

### Files to modify

| File | Change |
|------|--------|
| `src/components/RequestForm.tsx` | Replace joined query with two separate queries for team members and profiles |

