

The user wants auto-closed requests to behave like fully-completed ones for editing/locking, but with one key difference: pending/in_review reviewer rows must be preserved as-is (not flipped to completed) so the submitter can see who never finished.

Looking at the current state:
- `auto-close-overdue-requests/index.ts` already sets `status='completed'` + `closed_reason='deadline_reached'` and leaves `review_statuses` rows untouched (good — the "who didn't finish" data is already preserved).
- Lock logic lives in `RequestDetail.tsx`. Per memory `mem://features/request-management`, editing is locked once status is `completed`. Need to check that holds, plus that reviewers can no longer change their own status after auto-close.
- The trigger `auto_update_request_status` could re-flip an auto-closed request back to `in_review` if a reviewer somehow updates their row after auto-close. Need to prevent that.

Plan: lock reviewer status updates when request is `completed` (covers both natural and auto-close), and update the trigger to not overwrite a `completed` status. Also surface the "frozen" reviewer states clearly in the detail drawer.

No clarifying questions needed — scope is clear.

