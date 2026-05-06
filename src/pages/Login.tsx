import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardCheck, Fingerprint } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";
import { passkeysSupported, signInWithPasskey } from "@/lib/passkeys";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const { signIn } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Check if account is passkey-only
      const trimmed = email.trim().toLowerCase();
      if (trimmed) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("password_disabled")
          .eq("email", trimmed)
          .maybeSingle();
        if (profile?.password_disabled) {
          toast({
            title: "This account uses a passkey",
            description: "Please sign in with your passkey instead.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
      }
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
            {mode === "signin" ? "Sign in to your team account" : "Reset your password"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "signin" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@team.com" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
              {passkeysSupported() && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handlePasskey}
                  disabled={passkeyLoading}
                >
                  <Fingerprint className="w-4 h-4 mr-2" />
                  {passkeyLoading ? "Waiting for passkey…" : "Sign in with Passkey"}
                </Button>
              )}
            </form>
          ) : (
            <ForgotPasswordForm onBack={() => setMode("signin")} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
