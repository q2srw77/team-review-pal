# Fix: Submitter has no actions when reviewer completes with no notes

## Root cause

In `src/components/RequestDetail.tsx`, the Correction action bar (Re-Submit / Complete) is rendered with this guard:

```tsx
{inCorrection && isSubmitter && currentNotes.length > 0 && (
  // ...Re-Submit + Complete buttons
)}
```

When all reviewers complete without leaving any notes, the request transitions to `correction` but `currentNotes.length === 0`, so the entire action bar is hidden. The submitter is stuck — they can see the "Correction" status banner but have no way to finalize the request.

## Fix

Show the action bar whenever the request is in `correction` and the user is the submitter, regardless of note count. When there are no notes:

- **Complete** is enabled (no pending decisions blocks it; `pendingTotal === 0`).
- **Re-Submit for Review** stays disabled (already gated by `rejectedTotal === 0`).
- The summary line ("X of Y comments reviewed…") is replaced with a friendly empty-state message: "No reviewer comments were left. You can complete the review."

Single edit in `src/components/RequestDetail.tsx` around lines 951–977:

```tsx
{inCorrection && isSubmitter && (
  <div className="mt-4 rounded-lg border bg-card p-3 space-y-3">
    {currentNotes.length > 0 ? (
      <div className="text-xs text-muted-foreground">
        {reviewedTotal} of {decisionsTotal} comments reviewed ({acceptedTotal} accepted, {rejectedTotal} rejected)
        {pendingTotal > 0 && <span className="ml-1">· {pendingTotal} pending</span>}
      </div>
    ) : (
      <div className="text-xs text-muted-foreground">
        No reviewer comments were left. You can complete the review.
      </div>
    )}
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={resubmitting || rejectedTotal === 0}
        onClick={() => setShowResubmitConfirm(true)}
      >
        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
        {resubmitting ? "Re-submitting…" : "Re-Submit for Review"}
      </Button>
      <Button
        size="sm"
        disabled={finalizing || pendingTotal > 0}
        onClick={() => setShowFinalizeConfirm(true)}
      >
        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
        {finalizing ? "Finalizing…" : "Complete"}
      </Button>
    </div>
  </div>
)}
```

## Out of scope

- No backend / edge function changes. `finalize-review-request` already handles the no-notes path correctly (`pendingNotes` array is empty, `pending.length === 0`, finalization proceeds and the PDF/email use `acceptedCount = rejectedCount = 0`).
- No changes to the report template or email content.

## Verification

1. As a reviewer on a request with no notes, mark Completed → request moves to `correction`.
2. As the submitter, open the request → the action bar shows with **Re-Submit** disabled and **Complete** enabled, plus the empty-state message.
3. Click **Complete** → request finalizes, PDF generates, finalized email is sent.
