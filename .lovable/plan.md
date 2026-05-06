# Replace Favicon with Header Logo

## Goal
Replace the current favicon with one that matches the Review Hub header logo: a primary-colored rounded square containing a white clipboard-check (ClipboardCheck) icon.

## Approach
Recreate the header logo as a static PNG so it renders identically in browser tabs.

## Steps

1. **Generate the favicon**
   - Create a 512×512 PNG that mirrors the in-app logo:
     - Background: rounded square in the app's primary color (deep blue, matching `bg-primary`)
     - Foreground: white Lucide-style `ClipboardCheck` icon, centered, ~55% of canvas
     - Flat, crisp edges, no gradients or extra decoration
   - Save as `public/favicon.png` (overwrite current).

2. **Keep `index.html` link tags as-is**
   - Already points to `/favicon.png` and `/favicon.png` for apple-touch-icon — no edits needed.

3. **Verify**
   - Hard refresh preview, confirm the tab icon now matches the in-app top-left logo.

## Notes
- No component or business logic changes.
- If the rendered PNG still looks off at favicon size, fall back to hand-crafted SVG using the exact Lucide ClipboardCheck path on a rounded-rect.
