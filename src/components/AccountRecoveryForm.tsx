import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";

interface Props {
  onBack: () => void;
  initialEmail?: string;
}

export default function AccountRecoveryForm({ onBack, initialEmail = "" }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await supabase.functions.invoke("request-password-reset", {
        body: { email: email.trim(), appOrigin: window.location.origin },
      });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          If an account exists for <strong className="text-foreground">{email}</strong>, we've sent a recovery link
          and a 6-digit verification code. Both expire in 2 hours. From the recovery page you can reset your
          password or remove your passkeys to re-enable password sign-in.
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" /> Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter your account email. We'll send a secure recovery link plus a verification code. You'll then be
        able to reset your password or remove a lost passkey.
      </p>
      <div className="space-y-2">
        <Label htmlFor="recovery-email">Email</Label>
        <Input
          id="recovery-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@team.com"
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Sending…" : "Send recovery email"}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" /> Back to sign in
      </Button>
    </form>
  );
}
