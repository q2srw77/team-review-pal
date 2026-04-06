

## Filter Reviewer Progress by Role

### Overview
Regular reviewers should only see their own status in the Reviewer Progress section. The submitter and admins should see all reviewers' statuses.

### Changes to `src/components/RequestDetail.tsx`

In the Reviewer Progress section (lines 455-496), filter the `reviewerStatuses` list before rendering:

- If the current user is the **submitter** (`request.submitted_by === user.id`) or an **admin** (`isAdmin`): show all reviewer statuses (current behavior)
- Otherwise: filter to only show the row where `reviewer_id === user.id`

This is a small change — add a `visibleStatuses` variable derived from `reviewerStatuses` and use it in the `.map()` call.

### Single file change: `src/components/RequestDetail.tsx`

