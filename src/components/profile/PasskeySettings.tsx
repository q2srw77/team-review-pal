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
import { Fingerprint, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const openRename = (k: PasskeyRow) => {
    setRenameId(k.id);
    setRenameValue(k.device_label);
  };

  const handleRename = async () => {
    if (!renameId) return;
    const newLabel = renameValue.trim().slice(0, 80);
    if (!newLabel) {
      toast.error("Name cannot be empty");
      return;
    }
    setRenaming(true);
    const { error } = await supabase
      .from("user_passkeys")
      .update({ device_label: newLabel })
      .eq("id", renameId);
    setRenaming(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Passkey renamed");
    setRenameId(null);
    await load();
  };

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
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) {
        toast.error("Your session expired. Please sign in again.");
        return;
      }
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
      toast.success("Passkey removed.", {
        description: "Use Forgot Password on the sign-in screen to set a new password before signing in again.",
      });
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
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openRename(k)} aria-label="Rename passkey">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setConfirmId(k.id)} aria-label="Remove passkey">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {keys.length >= 3 ? (
          <p className="text-sm text-muted-foreground">
            You've reached the maximum of 3 passkeys. Remove one to add another.
          </p>
        ) : (
          <Button
            onClick={() => {
              setLabel("This device");
              setShowSetupConfirm(true);
            }}
            disabled={submitting}
          >
            {submitting ? "Setting up…" : keys.length === 0 ? "Set up Passkey" : "Add another passkey"}
          </Button>
        )}
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
                ? "This is your only passkey. Your password was rotated when you set it up, so you'll need to use Forgot Password on the sign-in screen to set a new password before you can sign in again."
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

      <Dialog open={!!renameId} onOpenChange={(o) => !o && setRenameId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename passkey</DialogTitle>
            <DialogDescription>Give this passkey a name you'll recognize.</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={80}
            placeholder="My MacBook"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)} disabled={renaming}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={renaming || !renameValue.trim()}>
              {renaming ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
