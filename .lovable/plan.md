## Goal
Add a **Correction** stage between Active (pending/in_review) and Completed. After all reviewers finish, the request enters Correction where the submitter accepts/rejects each comment, then either Re-Submits (new round, comments archived) or Completes (locks request, generates final PDF, emails submitter).

## 1. Database migrations

### Migration A — enum value (must run alone)
- `ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'correction' BEFORE 'completed';`

### Migration B — schema, RLS, trigger
- `request_notes`: add `decision` (text, default 'pending', check accepted/rejected/pending), `rejection_comment`, `decided_at`, `decided_by`, `round_number` (default 1), `archived` (default false). Add index `(request_id, round_number, archived)`.
- `review_requests`: add `current_round int default 1`.
- New RLS policy: submitter can UPDATE notes on own request while status='correction'.
- Re-create reviewer INSERT/UPDATE policies on `request_notes` to require parent status IN ('pending','in_review').
- Update `prevent_note_edit_when_completed` to also block on 'correction'.
- Replace `auto_update_request_status`: when all reviewer statuses complete → status `correction` (not completed). Skip if already `correction`/`completed`.
- Remove auto report-generation hook on completion if present (final PDF now triggered by submitter Complete action).

## 2. Edge functions

### `resubmit-for-review` (new)
- Verify caller = submitter; status must be `correction`.
- Archive current round notes (`UPDATE request_notes SET archived=true WHERE request_id=$1 AND round_number=current_round`).
- `UPDATE review_requests SET current_round = current_round + 1`.
- Reset all `review_statuses` for request to `pending` (trigger lands status on `pending`/`in_review`).
- Send `review-resubmitted` email to each reviewer (loop one-per-reviewer; each is transactional/individual).
- Audit log: `resubmitted_for_review`.

### `finalize-review-request` (new)
- Verify caller = submitter; status must be `correction`.
- Verify no non-archived note has `decision='pending'`.
- Set status `completed`.
- Invoke `generate-review-report` to build PDF, store path in `report_pdf_path`.
- Send `review-finalized` email to submitter only (with PDF link from storage).
- Audit log: `finalized_by_submitter`.

### Extend `generate-review-report`
- Include all rounds (group notes by `round_number`), each note shows author, position, content, decision badge, rejection comment, decided_at.
- Top summary: total/accepted/rejected/round count, finalized_at.

Both new functions: `verify_jwt = false` in `supabase/config.toml`, validate JWT via `anonClient.auth.getClaims()` (project convention).

## 3. Frontend

### Status tokens
- Add `--status-correction` (amber/orange HSL) to `src/index.css`.
- Extend `STATUS_STYLES` and `STATUS_LABELS` maps in `Dashboard.tsx` and `RequestDetail.tsx` with `correction`.

### Dashboard
- Replace Active/Completed toggle with three tabs: **Active** (pending+in_review), **Correction** (correction), **Completed** (completed).
- Update `view` state type, filter logic, `statusFilter` dropdown.

### RequestDetail
- **Banner** when status='correction': "This review is in Correction. The submitter is reviewing comments." (or for submitter: action prompt).
- **Hide** "Add note" textarea and reviewer mark-complete controls when status='correction'.
- **Per note (current round only)**: decision icon (CheckCircle2 green / XCircle red / neutral dot), comment body read-only.
  - Submitter: Accept and Reject buttons. Reject opens AlertDialog with required `rejection_comment` textarea (max 1000). Accept clears any prior rejection comment. Decisions can be changed until finalize.
  - Non-submitter: read-only with decision icon, "Awaiting submitter review" hint.
  - Each decision update writes audit log `correction_decision_made`.
- **Action buttons** (submitter only, status='correction'):
  - **Re-Submit for Review** — disabled until ≥1 rejected; confirm dialog; calls `resubmit-for-review`.
  - **Complete** — disabled while any pending decision; confirm dialog; calls `finalize-review-request`.
  - Inline progress: "X of Y comments reviewed (A accepted, B rejected)".
- **Previous rounds** collapsible (visible when `current_round > 1`): groups archived notes by `round_number`, each round collapsed by default, read-only with final decision + rejection comment.
- Keep existing Download PDF on completed status.

### Types
- After migration approval, the platform regenerates `src/integrations/supabase/types.ts` automatically (no manual `supabase gen types` needed in Lovable).

## 4. Email templates (in `supabase/functions/_shared/transactional-email-templates/`)
- **`review-resubmitted.tsx`** — to each reviewer. Subject: `{title} — round {round} review requested`. Body: previous round reviewed, new round open, link to request.
- **`review-finalized.tsx`** — to submitter. Subject: `{title} — review finalized`. Body: totals summary + Download Report button (signed URL to `report_pdf_path`).
- Register both in `registry.ts`.

Note: Lovable email infra does NOT support binary attachments — `review-finalized` will include a download link (signed URL) to the stored PDF instead of an attached file. The plan calls for an attachment but this isn't supported; link is the standard workaround.

## 5. Audit log actions
- `correction_decision_made` — `{ note_id, decision, has_rejection_comment }`
- `resubmitted_for_review` — `{ from_round, to_round, rejected_count }`
- `finalized_by_submitter` — `{ round_count, accepted_count, rejected_count }`

## 6. Tests
- Vitest: trigger lands on `correction` not `completed`; reviewer cannot insert/update notes during `correction`; submitter can update decision fields during `correction`.
- E2E (Playwright): full happy path — create → reviewers complete → Correction tab → accept/reject/comment → Re-Submit → archived round 1 + back to In Review → reviewers complete again → accept all → Complete → status completed + PDF path + submitter email queued.

## 7. Implementation order
1. Migration A (enum value, standalone).
2. Migration B (columns, indexes, RLS, trigger replacement).
3. Frontend: CSS token, status maps, Dashboard 3-tab refactor.
4. Frontend: RequestDetail correction-mode UI, accept/reject, action buttons, round history.
5. Edge function: `resubmit-for-review`.
6. Extend `generate-review-report` with rounds + decisions.
7. Edge function: `finalize-review-request`.
8. Email templates + registry update.
9. Tests.

## Out of scope
- Reviewers adding/editing notes during Correction.
- Notifying anyone other than submitter at finalization.
- Submitter editing reviewer comment text.
- Per-reviewer "your comment was rejected" emails.

## Note on attachments
Lovable's email system does not support binary attachments. `review-finalized` will deliver the PDF via a signed Supabase Storage download link in the email body rather than as an attached file. Confirm this substitution is acceptable.
