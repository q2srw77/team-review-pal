import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

interface Props {
  onBack: () => void;
}

export default function ForgotPasswordForm({ onBack }: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await supabase.functions.invoke("request-password-reset", {
        body: { email: email.trim(), appOrigin: window.location.origin },
      });
      setSent(true);
    } catch (err) {
      // Always show generic success to prevent enumeration
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          If an account exists for <strong className="text-foreground">{email}</strong>, we've sent a password reset link
          and a 6-digit verification code. Both expire in 2 hours.
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
        Enter your account email. We'll send a secure reset link plus a verification code.
      </p>
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@team.com"
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Sending…" : "Send reset link"}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" /> Back to sign in
      </Button>
    </form>
  );
}
