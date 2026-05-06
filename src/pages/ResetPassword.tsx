import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Action = "password" | "remove-passkeys";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = params.get("token") ?? "";

  const [action, setAction] = useState<Action>("password");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      toast({ title: "Invalid recovery link", description: "This link is missing a token.", variant: "destructive" });
    }
  }, [token, toast]);

  const validatePassword = (p: string): string | null => {
    if (p.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/[0-9]/.test(p))
      return "Password must include upper, lower, and a number";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    const pwErr = validatePassword(password);
    if (pwErr) {
      toast({ title: pwErr, variant: "destructive" });
      return;
    }
    if (code.length !== 6) {
      toast({ title: "Enter the 6-digit verification code", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const fnName = action === "password" ? "confirm-password-reset" : "account-recovery-passkeys";
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { token, code, newPassword: password },
      });

      let serverError: string | null = null;
      if (error) {
        try {
          const ctx = (error as any)?.context;
          if (ctx && typeof ctx.json === "function") {
            const parsed = await ctx.json();
            serverError = parsed?.error ?? null;
          }
        } catch {
          // ignore
        }
        if (!serverError) serverError = (error as any)?.message || "Recovery failed";
      } else if (data && (data as any).ok === false) {
        serverError = (data as any).error || "Recovery failed";
      }

      if (serverError) {
        toast({ title: serverError, variant: "destructive" });
        return;
      }

      if (action === "password") {
        toast({ title: "Password updated", description: "You can now sign in with your new password." });
      } else {
        toast({
          title: "Account recovered",
          description: "Your passkeys were removed and password sign-in is enabled. You can set up a new passkey from your profile.",
        });
      }
      navigate("/", { replace: true });
    } catch (err: any) {
      toast({ title: "Recovery failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg border-border/60">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-2">
            <ClipboardCheck className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Account Recovery</CardTitle>
          <CardDescription>
            Enter the verification code from your email and choose how to recover your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Recovery action</Label>
              <RadioGroup value={action} onValueChange={(v) => setAction(v as Action)} className="gap-2">
                <label
                  htmlFor="action-password"
                  className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/40"
                >
                  <RadioGroupItem id="action-password" value="password" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Reset my password</div>
                    <div className="text-xs text-muted-foreground">
                      Set a new password and keep your existing passkeys.
                    </div>
                  </div>
                </label>
                <label
                  htmlFor="action-passkeys"
                  className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/40"
                >
                  <RadioGroupItem id="action-passkeys" value="remove-passkeys" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Remove my passkeys & re-enable password</div>
                    <div className="text-xs text-muted-foreground">
                      Lost your passkey? This deletes all passkeys, sets a new password, and re-enables
                      password sign-in. You can enroll a new passkey afterwards.
                    </div>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Verification code</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Must include upper & lower case letters and a number.
            </p>
            <Button type="submit" className="w-full" disabled={submitting || !token}>
              {submitting
                ? "Working…"
                : action === "password"
                ? "Update password"
                : "Recover account"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => navigate("/")}>
              Back to sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
