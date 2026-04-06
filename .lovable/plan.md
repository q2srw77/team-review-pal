

## Email Notification for New Review Requests

### Overview
When a user submits a new review request, email all members of the selected team to notify them.

### Prerequisites — Email Domain Setup
This project has no email domain configured yet. Before we can send any emails, we need to set up email sending infrastructure. This involves:

1. **Configure an email domain** — you'll need a domain you own (e.g., `yourdomain.com`) so emails come from your brand instead of a generic address
2. **Set up email infrastructure** — database tables for queuing, logging, and retry handling
3. **Scaffold transactional email templates** — the Edge Function and template for sending app emails

### Implementation Steps

**Step 1: Email domain setup**
You'll be prompted to configure a sender domain through a setup dialog.

**Step 2: Email infrastructure + transactional scaffold**
Automatically creates the sending pipeline (queue, retry, suppression list, unsubscribe handling).

**Step 3: Create notification template**
A React Email template (`new-review-request.tsx`) showing:
- The review request title
- Platform and team name
- Submitter name
- Complete-by date
- Link to view the request in the app

**Step 4: Wire up the trigger in RequestForm**
After a successful insert in `handleSubmit`:
- Fetch team members from `team_members` joined with `profiles` to get emails
- For each team member (excluding the submitter), call `send-transactional-email` with the template data
- Each call gets a unique idempotency key (`review-notify-{requestId}-{userId}`)

**Step 5: Create unsubscribe page**
A branded page at `/unsubscribe` (or similar) for recipients to opt out.

### Files to create/modify

| File | Change |
|------|--------|
| `supabase/functions/_shared/transactional-email-templates/new-review-request.tsx` | New notification template |
| `supabase/functions/_shared/transactional-email-templates/registry.ts` | Register the template |
| `src/components/RequestForm.tsx` | Add email sending after successful insert |
| New unsubscribe page + route | Branded unsubscribe UI |

### Important Note
Setting up the email domain is the first step. Once you approve this plan, I'll guide you through the domain setup dialog before proceeding with the rest.

