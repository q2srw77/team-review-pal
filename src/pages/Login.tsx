import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardCheck, Fingerprint, ArrowLeft, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AccountRecoveryForm from "@/components/AccountRecoveryForm";
import { passkeysSupported, signInWithPasskey } from "@/lib/passkeys";

type Step = "email" | "method" | "password";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [passkeyOnly, setPasskeyOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [mode, setMode] = useState<"signin" | "recovery">("signin");
  const { signIn } = useAuth();
  const { toast } = useToast();

  const supportsPasskey = passkeysSupported();

  const resetToEmail = () => {
    setStep("email");
    setPassword("");
    setPasskeyOnly(false);
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setContinuing(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("password_disabled")
        .eq("email", trimmed)
        .maybeSingle();
      const isPasskeyOnly = !!profile?.password_disabled;
      setPasskeyOnly(isPasskeyOnly);
      // If account is passkey-only, or browser supports passkey, show method picker.
      // If browser does NOT support passkey and password is allowed, go straight to password.
      if (isPasskeyOnly || supportsPasskey) {
        setStep("method");
      } else {
        setStep("password");
      }
    } catch {
      // On lookup failure, fall back to method step
      setStep(supportsPasskey ? "method" : "password");
    } finally {
      setContinuing(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passkeyOnly) {
      toast({
        title: "This account uses a passkey",
        description: "Please sign in with your passkey instead.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasskey = async () => {
    if (!email.trim()) {
      toast({ title: "Enter your email first", variant: "destructive" });
      return;
    }
    setPasskeyLoading(true);
    try {
      await signInWithPasskey(email.trim().toLowerCase());
    } catch (err: any) {
      toast({ title: "Passkey sign-in failed", description: err?.message ?? "", variant: "destructive" });
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg border-border/60">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-2">
            <ClipboardCheck className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Review Hub</CardTitle>
          <CardDescription className="text-muted-foreground">
            {mode === "signin" ? "Sign in to your team account" : "Account recovery"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "recovery" ? (
            <AccountRecoveryForm initialEmail={email.trim()} onBack={() => setMode("signin")} />
          ) : step === "email" ? (
            <form onSubmit={handleContinue} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@team.com"
                />
              </div>
              <Button type="submit" className="w-full" disabled={continuing}>
                {continuing ? "Checking…" : "Continue"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode("recovery")}
              >
                Account Recovery
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <span className="truncate text-foreground">{email}</span>
                <button
                  type="button"
                  onClick={resetToEmail}
                  className="text-xs text-primary hover:underline shrink-0 ml-2"
                >
                  Use different email
                </button>
              </div>

              {step === "method" && (
                <>
                  {supportsPasskey && (
                    <Button
                      type="button"
                      className="w-full"
                      onClick={handlePasskey}
                      disabled={passkeyLoading}
                    >
                      <Fingerprint className="w-4 h-4 mr-2" />
                      {passkeyLoading ? "Waiting for passkey…" : "Sign in with Passkey"}
                    </Button>
                  )}
                  {!passkeyOnly && (
                    <Button
                      type="button"
                      variant={supportsPasskey ? "outline" : "default"}
                      className="w-full"
                      onClick={() => setStep("password")}
                    >
                      <KeyRound className="w-4 h-4 mr-2" />
                      Sign in with Password
                    </Button>
                  )}
                  {passkeyOnly && (
                    <p className="text-xs text-center text-muted-foreground">
                      This account is protected by a passkey. Password sign-in is disabled.
                    </p>
                  )}
                </>
              )}

              {step === "password" && (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Signing in…" : "Sign in"}
                  </Button>
                  {supportsPasskey && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setStep("method")}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Other sign-in options
                    </Button>
                  )}
                </form>
              )}

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode("recovery")}
              >
                Account Recovery
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
