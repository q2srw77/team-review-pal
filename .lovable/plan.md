

## Settings Sidebar + Platform Management

### Overview
Add a sidebar navigation to the Settings page and a new "Platforms" section where admins can add, edit, and delete platforms that appear in the New Request dropdown.

### Database Changes

**New table: `platforms`**
- `id` (uuid, PK, default gen_random_uuid())
- `name` (text, unique, not null)
- `created_at` (timestamptz, default now())
- RLS: SELECT for authenticated, ALL for admins

**Migration: change `review_requests.platform` from enum to text**
- `ALTER TABLE review_requests ALTER COLUMN platform TYPE text;`
- Seed `platforms` table with existing enum values: Storylane, Document, AI Project, MSP Project

### UI Changes

**`src/pages/Settings.tsx`** — Add sidebar layout
- Use the existing Sidebar component with two nav items: "Users" and "Platforms"
- Wrap content in SidebarProvider with a collapsible sidebar on the left
- Each nav item switches the active section in the main content area (local state, not routing)

**New section: Platform Management** (inside Settings)
- Table listing all platforms with name and created date
- "Add Platform" button opens a dialog with a name input
- Each row has edit and delete actions via dropdown menu
- Delete shows confirmation dialog; prevents deletion if platform is in use (check `review_requests` table)

**`src/components/RequestForm.tsx`**
- Fetch platforms from the `platforms` table instead of using the hardcoded enum array
- Render dynamically in the Select dropdown

### Files to modify/create

| File | Change |
|------|--------|
| New migration | Create `platforms` table, alter `review_requests.platform` to text, seed data |
| `src/pages/Settings.tsx` | Add sidebar layout with Users/Platforms sections; add platform CRUD UI |
| `src/components/RequestForm.tsx` | Fetch platforms from DB instead of hardcoded array |

