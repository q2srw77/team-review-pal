## Root Cause

When `auto-close-overdue-requests` flips an overdue request to `completed`, it calls `generate-review-report` with the **service role JWT** as the bearer token.

`generate-review-report/index.ts` validates that token with `anonClient.auth.getClaims(...)`, which is designed for end-user JWTs. The service-role token does not parse as user claims, so the function returns **401 Unauthorized** before it ever generates the PDF or sends the `review-completed` email.

Evidence:
- `audit_logs` shows `auto_closed` rows for both overdue requests, so `auto-close-overdue-requests` ran.
- `review_requests.report_pdf_path` is `NULL` for both auto-closed requests.
- `email_send_log` has no `review-completed` rows on the auto-close timestamps.
- No edge logs for `generate-review-report` invocations (rejected at the auth gate, log already rotated for the older one).

The same auth pattern works fine for user-initiated PDF generation from the UI, which is why this only breaks on auto-close.

## Fix

1. **Accept service-role calls in `generate-review-report`**
   - Decode the bearer token; if the JWT `role` claim is `service_role`, skip the `getClaims` user check and proceed.
   - Otherwise keep the existing user JWT validation.
   - Mirrors the pattern already used in `auto-close-overdue-requests`.

2. **Backfill the two stuck requests**
   - For `0a3a8673…` (Test Labels) and `141ff5a5…` (Test Auto Close): re-invoke `generate-review-report` with the service role so the PDF is generated, `report_pdf_path` is set, and the `review-completed` email is queued to the submitter.

## Files to change

- `supabase/functions/generate-review-report/index.ts` — allow service-role bearer tokens to bypass the user-claims check.

## Technical detail

```ts
const token = authHeader.slice('Bearer '.length)
let isServiceRole = false
try {
  const payload = JSON.parse(
    atob((token.split('.')[1] + '===').replace(/-/g, '+').replace(/_/g, '/'))
  )
  isServiceRole = payload?.role === 'service_role'
} catch { /* ignore, fall through to user check */ }

if (!isServiceRole) {
  const { data: claimsData, error: claimsError } =
    await anonClient.auth.getClaims(token)
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}
```

After deploy, trigger `generate-review-report` once for each of the two existing auto-closed requests so they get their PDF + completion email.

No DB schema, RLS, or template changes required.