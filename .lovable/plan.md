

## Lock Completed Review Requests

### Problem
Once all reviewers mark a request as completed, reviewers can still change their status and add notes. Late changes go unseen by the submitter.

### Approach
UI-only lock — when `request.status === "completed"`, disable the reviewer status dropdown and the add-note form. No database changes needed since the existing RLS doesn't need tightening for this.

### Changes to `src/components/RequestDetail.tsx`

1. **Reviewer status dropdown (line ~572)**: Add a condition so the status `<Select>` only renders when the request is not completed/archived. When locked, show a read-only badge instead (same as non-self reviewers already see).

   Change: `{isMe && isReviewer ? (` → `{isMe && isReviewer && request.status !== "completed" && request.status !== "archived" ? (`

2. **Add Note form (line ~620)**: Only show the note textarea and button when the request is not completed/archived.

   Change: `{isReviewer && (` → `{isReviewer && request.status !== "completed" && request.status !== "archived" && (`

3. **Add a visual indicator**: Show a small info message when the request is completed, e.g. `"This review is complete and locked for further changes."` above the reviewer progress section.

### Single file change: `src/components/RequestDetail.tsx`

