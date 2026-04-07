

## Make `review-reports` Storage Bucket Private

### Problem
The `review-reports` bucket is marked as public, meaning anyone with the URL pattern can access reports without authentication. The code already correctly uses signed URLs everywhere, so the only change needed is flipping the bucket to private.

### Fix
One database migration:

```sql
UPDATE storage.buckets SET public = false WHERE id = 'review-reports';
```

### Scope
- **1 migration file** — no application code changes needed (all access already uses `createSignedUrl()`).

