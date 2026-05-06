## Style Position Label Badge

Change the `Slide` / `Step` / `Page` badge in the reviewer notes list (`src/components/RequestDetail.tsx`, around line 703) from the default outline style to a solid `#2006F7` background with bold white text.

```tsx
<Badge
  className="text-[10px] uppercase tracking-wide shrink-0 font-bold text-white border-transparent hover:opacity-90"
  style={{ backgroundColor: "#2006F7" }}
>
  {positionLabel} {note.position_number}
</Badge>
```

Inline `style` is used because `#2006F7` is a one-off brand color not in the design tokens; everything else stays themed.

### Files Modified
- `src/components/RequestDetail.tsx`

Tip: simple color/text tweaks on static elements like this can be done instantly (and free) via Lovable's Visual Edits — click the Edit button in the chat box, select the badge, and adjust.
