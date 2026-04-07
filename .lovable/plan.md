

## Make PDF Download Icon a Proper Button

### Change in `src/pages/Dashboard.tsx` (around line 188)

Replace the inline `<button>` wrapping the Download icon with a proper `<Button>` component using `size="icon"` and `variant="outline"`:

```tsx
<Button
  variant="outline"
  size="icon"
  className="h-8 w-8"
  onClick={async (e) => {
    e.stopPropagation();
    const { data } = await supabase.storage
      .from("review-reports")
      .createSignedUrl(r.report_pdf_path!, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }}
  title="Download Report"
>
  <Download className="w-4 h-4" />
</Button>
```

Single file, single change.

