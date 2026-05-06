# Responsive UI Refresh

Goal: Make the app feel more modern and use available screen real estate better — especially on large displays — while staying readable on small screens. Trim the wasted gutter space without making content edge-to-edge on huge monitors.

## What changes

### 1. Global container strategy
Replace the rigid `max-w-6xl mx-auto` wrappers with a fluid container that scales with the viewport:

- Dashboard + Settings: switch from `max-w-6xl` to `max-w-[1600px]` with responsive horizontal padding (`px-4 sm:px-6 lg:px-8 xl:px-12`).
- Profile: bump from `max-w-3xl` to `max-w-4xl` for a less cramped feel on desktop.
- Header rows use the same container so the logo/actions align with the page content.

This removes the large empty bands on 1440px+ monitors while still capping line length on ultrawide displays.

### 2. Header polish (Dashboard / Settings / Profile)
- Reduce header height from `h-16` to `h-14` on mobile, `sm:h-16` on desktop — lighter top bar.
- Fix the duplicated `<h1>` tag currently rendered in `Dashboard.tsx` (line 140 has nested `<h1>`).
- Add a subtle backdrop blur (`bg-card/80 backdrop-blur`) for a modern sticky-header feel.
- Keep role badges visible on `sm+`, hide on very small screens to avoid wrapping.

### 3. Dashboard main area
- Reduce vertical padding from `py-8` to `py-6 lg:py-8`.
- Title row becomes responsive: stacks on mobile (`flex-col sm:flex-row`), so the "New Request" button doesn't crowd the heading.
- Tab buttons (Active/Completed) get a segmented look using a single bordered group instead of two separate outlined buttons.
- Table card: keep the rounded border, but allow the table to use full width of the wider container. On `xl+`, show the previously hidden "Submitted" column earlier so big screens are not under-utilized.

### 4. Table responsiveness
- On screens below `sm`, swap the table for a stacked card list (title, platform, status, progress, due date) so mobile users don't have to horizontally scroll.
- On `sm`–`md`, keep the compact table with current hidden columns.
- On `lg+`, show all columns including team and dates.

### 5. RequestDetail sheet
Already refactored for full-screen + scroll. Two small additions:
- Default (non-fullscreen) width grows on large screens: `sm:max-w-lg lg:max-w-xl xl:max-w-2xl` so the panel uses more room when there is room.
- Tighten internal padding from `px-6` to `px-5 sm:px-6` for mobile.

### 6. Settings + Profile pages
- Apply the same container + header treatment for visual consistency.
- Settings tab content gets the wider container so tables (users, audit logs, email logs) stop wrapping unnecessarily on 1080p+.
- Profile cards: switch from a single column to a 2-column grid on `md+` for the account/notification sections.

### 7. Small modernization touches
- Increase default border radius use on the main table card (`rounded-2xl`) to match buttons/inputs.
- Use `divide-y divide-border/60` for table rows (cleaner than per-row borders).
- Slight shadow (`shadow-sm`) on the sticky header and main table card for depth.

## Files to modify

- `src/pages/Dashboard.tsx` — container, header, title row, tabs, table responsiveness, fix nested `<h1>`.
- `src/pages/Settings.tsx` — container + header.
- `src/pages/Profile.tsx` — container, header, 2-col layout.
- `src/components/RequestDetail.tsx` — wider sheet on large screens, padding tweak.
- `src/index.css` — (optional) add a `.app-container` utility if reuse becomes noisy; otherwise inline Tailwind.

## Out of scope

- No business logic, data, or auth changes.
- No theme/color changes — only spacing, sizing, and layout.
- No new dependencies.

## Verification

- Resize the preview between 360px, 768px, 1024px, 1440px, and 1920px and confirm: no horizontal scroll on mobile, content fills more of the page on desktop, header stays readable, sheet panel scales.
