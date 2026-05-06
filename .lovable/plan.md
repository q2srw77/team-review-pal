## Problem

In full-screen mode the close (X) and full-screen toggle buttons are absolutely positioned inside `SheetContent`, which is itself the scroll container. As the user scrolls the long review content, those controls scroll out of view, and the title header also disappears.

## Fix

Restructure `SheetContent` in `src/components/RequestDetail.tsx` into a non-scrolling shell with a sticky/fixed header strip and a separately scrollable body.

**`SheetContent`**
- Remove `overflow-y-auto` from `SheetContent`. Add `flex flex-col` and remove default `p-6` (use `!p-0`) so we control padding per section.
- Full-screen sizing: keep `w-screen max-w-none sm:max-w-none` plus `h-screen` and `inset-0` so it truly fills the viewport.
- Default (side panel) sizing unchanged: `sm:max-w-lg`, full-height already provided by sheet variant.

**Header strip (always visible)**
- A new top bar wrapper with `shrink-0 border-b bg-background px-6 pt-6 pb-4` containing the existing `SheetHeader` content (title, Edit/Save/Cancel).
- Keep the full-screen toggle button absolutely positioned at `right-12 top-4` and rely on the built-in close at `right-4 top-4`. Both now sit over the non-scrolling header so they remain visible at all times.
- Remove the `pr-8` hack and instead use `pr-20` on the title row so the title never slides under the two corner buttons.

**Scrollable body**
- Wrap the existing content (everything currently after `</SheetHeader>`, starting at the `<div className="mt-6 space-y-5">`) in a new `<div className="flex-1 overflow-y-auto px-6 py-6">`.
- Remove `mt-6` from the inner container since padding now lives on the scroll wrapper.

## Result

- Title, Edit/Save controls, X-close, and Full Screen toggle stay pinned at the top in both windowed and full-screen modes.
- Long content scrolls inside the body region without ever hiding the controls.
- No business-logic or data changes — purely layout.

## Out of scope

- No changes to the shadcn `Sheet` primitive.
- No persistence of the full-screen preference.
