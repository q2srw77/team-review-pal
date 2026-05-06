## Goal

Make the **Details** column in Settings → Audit Logs readable instead of raw JSON, and let users open a full-screen view with all details for any log entry.

## Changes (single file: `src/components/settings/AuditLogs.tsx`)

### 1. Human-readable summary in the Details column
Replace the truncated `JSON.stringify(...)` with a friendly one-line summary built from the known fields:
- `title` → shown first (e.g. "ZTNA Readable Demo")
- `platform` → "on Storylane"
- `new_status` → "→ completed" (formatted, with underscores replaced)
- `reason` → "(deadline reached)"
- `completed / total` → "2 of 3 completed" for `auto_closed`
- Unknown keys → fall back to `key: value` pairs

Still truncate to a single line; show a subtle "View details" link/button at the end (or make the cell clickable) when there's more to show.

### 2. Full-screen details dialog
Add a `Dialog` (using existing `@/components/ui/dialog`) opened per row. Content:
- Header: action badge + entity type + timestamp + user
- **Summary** section: the same readable key/value pairs rendered as a definition list (label → value), with status/reason values formatted nicely
- **Raw JSON** section (collapsible via `Collapsible`): pretty-printed `JSON.stringify(details, null, 2)` in a `<pre>` with monospace font and scroll
- Use `max-w-3xl` (or `max-w-4xl`) and `max-h-[85vh]` with internal scroll so it feels full-screen on desktop and fills the viewport on mobile

### 3. Row interaction
- Make the Details cell render the summary plus a small "View" button (ghost, `size="sm"`, `Eye` icon from lucide) that opens the dialog
- Disable the button when `details` is null

## Out of scope
No DB changes, no other settings sections, no changes to how logs are written.
