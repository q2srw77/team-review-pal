## Verification result

PDFs are now generated correctly on auto-close (both `0a3a8673…` and `141ff5a5…` have `report_pdf_path` set), but the **completion email to the submitter is still failing**.

Edge logs show a `POST 401` on `send-transactional-email` at the exact moment the auto-close ran (2026-05-06 04:20:56). And `email_send_log` has zero `review-completed` rows ever — only the older `review-all-complete` template has been delivered successfully.

## Root cause

`supabase/functions/send-transactional-email/index.ts` still validates the bearer token with `tmpClient.auth.getClaims(...)`, which only accepts end-user JWTs. When `generate-review-report` runs under the service role and calls `supabase.functions.invoke('send-transactional-email', …)`, the invoke uses the **service-role JWT** as the bearer. `getClaims` rejects it → 401 → no email.

This is the same class of bug we just fixed in `generate-review-report`, but one layer down. Auto-close also reaches `send-transactional-email` directly (for `review-all-complete`), so the same fix protects that path too.

Note: the `review-all-complete` rows that did succeed earlier were sent from the auto-close function but on an older deploy — the current code path now hits the same 401.

## Fix

1. **Allow service-role bearer tokens in `send-transactional-email`**
   - Decode the JWT; if `payload.role === 'service_role'`, skip the `getClaims` check.
   - Otherwise keep the existing user JWT validation.
   - Mirrors the pattern already used in `auto-close-overdue-requests` and `generate-review-report`.

2. **Backfill the two stuck completion emails**
   - For request `0a3a8673…` (Test Labels) and `141ff5a5…` (Test Auto Close): re-invoke `generate-review-report` with the service role. The function early-returns when `report_pdf_path` is already set, so it won't regenerate the PDF — but it also won't send the email. So the backfill needs to either:
     - temporarily clear `report_pdf_path` for these two rows, re-run `generate-review-report`, OR
     - call `send-transactional-email` directly with `templateName: review-completed` and a fresh signed URL for each existing PDF.
   - Preferred: call `send-transactional-email` directly so we don't regenerate PDFs.

3. **Smoke test**
   - After deploy, run a single test invocation of `send-transactional-email` with the service role to confirm the 401 is gone.
   - Verify a new `review-completed` row lands in `email_send_log` with `status=sent`.

## Files to change

- `supabase/functions/send-transactional-email/index.ts` — accept service-role bearer tokens.

## Technical detail

```ts
const token = authHeader.replace('Bearer ', '')
let isServiceRole = false
try {
  const payloadB64 = token.split('.')[1]
  const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4)
  const payload = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')))
  isServiceRole = payload?.role === 'service_role'
} catch { /* fall through */ }

if (!isServiceRole) {
  const tmpClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { error: claimsErr } = await tmpClient.auth.getClaims(token)
  if (claimsErr) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}
```

No DB schema, RLS, or template changes required.
