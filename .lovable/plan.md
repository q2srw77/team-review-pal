The error is from the frontend using the old SimpleWebAuthn call signature. Version 11 expects `startRegistration({ optionsJSON })` and `startAuthentication({ optionsJSON })`, but the app is passing the options object directly, so `optionsJSON` is undefined and the library crashes while reading `challenge` before the browser passkey prompt appears.

Plan:
1. Update `src/lib/passkeys.ts` so registration calls `startRegistration({ optionsJSON: optsData.options })`.
2. Update the passkey sign-in path in the same file to call `startAuthentication({ optionsJSON: optsData.options })`, preventing the same failure during login.
3. Add a small shape check before both browser calls so malformed backend responses produce a clear app error instead of a raw `challenge` TypeError.
4. Verify the installed library API and run a focused code check/search to confirm no old SimpleWebAuthn v11 call signatures remain.