# Fix Favicon Corner Transparency

## Problem
Current `public/favicon.png` renders the rounded blue square on a white background, so the corners appear white instead of transparent.

## Fix
Re-render the favicon SVG with a transparent canvas so only the rounded square shows.

## Steps

1. Re-run ImageMagick conversion of the existing favicon SVG with `-background none` applied at the input stage (`-background none favicon.svg`) so the area outside the rounded rect stays transparent in the PNG.
2. Overwrite `public/favicon.png` with the transparent version.
3. Verify by inspecting the PNG — corners should be checkered/transparent, only the blue rounded square + white clipboard visible.

No HTML or component changes needed.
