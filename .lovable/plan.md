Update `src/components/profile/PasskeySettings.tsx`:

1. Remove the always-visible "Device name" Label + Input from the card body. Keep only the "Set up Passkey" / "Add another passkey" button.
2. Move the device name field into the existing `showSetupConfirm` AlertDialog so it's the first thing the user sees after clicking the button.
3. The dialog Continue action stays disabled until the name is non-empty (trimmed). On Continue, pass the entered name to `registerPasskey(...)` as today.
4. Reset the name back to "This device" each time the dialog opens so it doesn't carry stale values across sessions.

No backend changes.