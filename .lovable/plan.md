

## Fix URL Field Error When Left Empty

### Problem
The `url_location` column in `review_requests` is defined as `TEXT NOT NULL DEFAULT ''`. When the URL field is left empty, the form explicitly sends `null` (line 53: `urlLocation.trim() || null`), which violates the NOT NULL constraint and causes a database error.

### Fix
**`src/components/RequestForm.tsx` line 53** — Change `urlLocation.trim() || null` to `urlLocation.trim()` so it sends an empty string instead of null, which the database accepts via its DEFAULT.

### Single line change, single file
| File | Change |
|------|--------|
| `src/components/RequestForm.tsx` | `url_location: urlLocation.trim()` instead of `urlLocation.trim() \|\| null` |

