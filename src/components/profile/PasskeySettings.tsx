import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Fingerprint, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { passkeysSupported, registerPasskey } from "@/lib/passkeys";

interface PasskeyRow {
  id: string;
  device_label: string;
  created_at: string;
  last_used_at: string | null;
}

export default function PasskeySettings({ onChange }: { onChange?: (hasPasskeys: boolean) => void }) {
  const { user } = useAuth();
  const [keys, setKeys] = useState<PasskeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("This device");
  const [submitting, setSubmitting] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showSetupConfirm, setShowSetupConfirm] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_passkeys")
      .select("id, device_label, created_at, last_used_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const rows = (data as PasskeyRow[]) ?? [];
    setKeys(rows);
    onChange?.(rows.length > 0);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleRegister = async () => {
    setSubmitting(true);
    try {
      await registerPasskey(label.trim() || "This device");
      toast.success("Passkey added. Password sign-in is now disabled.");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not add passkey");
    } finally {
      setSubmitting(false);
      setShowSetupConfirm(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("user_passkeys").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const remaining = keys.filter((k) => k.id !== id);
    if (remaining.length === 0 && user) {
      await supabase.from("profiles").update({ password_disabled: false }).eq("user_id", user.id);
      toast.success("Passkey removed. Password sign-in re-enabled.");
    } else {
      toast.success("Passkey removed.");
    }
    await load();
    setConfirmId(null);
  };

  if (!passkeysSupported()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Fingerprint className="w-5 h-5" /> Passkey
          </CardTitle>
          <CardDescription>This browser does not support passkeys.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Fingerprint className="w-5 h-5" /> Passkey
        </CardTitle>
        <CardDescription>
          Sign in with Touch ID, Face ID, Windows Hello, or a security key. Once a passkey is set up, it replaces your password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : keys.length === 0 ? null : (
          <ul className="space-y-2">
            {keys.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-foreground">{k.device_label}</p>
                  <p className="text-xs text-muted-foreground">
                    Added {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at ? ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setConfirmId(k.id)} aria-label="Remove passkey">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <Label htmlFor="passkey-label">Device name</Label>
          <Input
            id="passkey-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="My MacBook"
            maxLength={80}
          />
        </div>
        <Button onClick={() => setShowSetupConfirm(true)} disabled={submitting}>
          {submitting ? "Setting up…" : keys.length === 0 ? "Set up Passkey" : "Add another passkey"}
        </Button>
      </CardContent>

      <AlertDialog open={showSetupConfirm} onOpenChange={setShowSetupConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set up a passkey?</AlertDialogTitle>
            <AlertDialogDescription>
              {keys.length === 0
                ? "After setup, you'll sign in with your passkey instead of a password. You can remove it anytime to re-enable password sign-in."
                : "You'll be prompted by your device to register a new passkey."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegister}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this passkey?</AlertDialogTitle>
            <AlertDialogDescription>
              {keys.length === 1
                ? "This is your only passkey. Removing it will re-enable password sign-in for your account."
                : "You can still sign in with your other passkeys."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmId && handleDelete(confirmId)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
