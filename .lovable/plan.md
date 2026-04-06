

## Make Team Required, URL Optional

### Changes to `src/components/RequestForm.tsx`

1. **Validation guard** (line 44): Add `teamId` to the required check: `if (!user || !platform || !teamId) return;`
2. **URL field** (around line 93): Remove `required` from the URL Input
3. **Insert payload** (line 49): Change to `url_location: urlLocation.trim() || null`
4. **Submit button** (around line 120): Add `!teamId` to disabled condition
5. **Team Select**: No UI change needed — it's already rendered; just enforcing it as required

Single file change, no database migration needed.

