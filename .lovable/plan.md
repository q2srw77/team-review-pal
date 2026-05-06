# Review Hub Favicon

## Goal
Add a custom favicon depicting a clipboard with a checkmark, matching the Review Hub brand.

## Steps

1. **Generate the favicon image**
   - Use AI image generation to create a clean, flat clipboard-with-checkmark icon on a solid brand-colored background (rounded square, centered, high contrast, no text).
   - Save as `public/favicon.png` at 512×512 (browsers downscale cleanly).

2. **Remove the default favicon**
   - Delete `public/favicon.ico` so browsers don't fall back to the old one.

3. **Wire it up in `index.html`**
   - Replace any existing favicon `<link>` with:
     ```html
     <link rel="icon" href="/favicon.png" type="image/png">
     <link rel="apple-touch-icon" href="/favicon.png">
     ```

4. **Verify**
   - Reload preview, confirm new favicon appears in the browser tab.

## Notes
- Single-color flat design ensures legibility at 16×16.
- No code/business-logic changes — purely a static asset + `index.html` link update.
