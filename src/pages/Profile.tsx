import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, KeyRound, UserCircle } from "lucide-react";
import { toast } from "sonner";

interface TeamRow {
  team_id: string;
  teams: { name: string; description: string } | null;
}

export default function Profile({ onBack }: { onBack: () => void }) {
  const { user, roles, profileName } = useAuth();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("team_members")
      .select("team_id, teams(name, description)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setTeams((data as TeamRow[]) ?? []);
        setLoadingTeams(false);
      });
  }, [user]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur border-b border-border shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-bold tracking-tight text-foreground">My Profile</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCircle className="w-5 h-5" /> Account Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-muted-foreground text-xs">Name</Label>
              <p className="text-foreground font-medium">{profileName}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Email</Label>
              <p className="text-foreground font-medium">{user?.email}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Roles</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {roles.length === 0 ? (
                  <span className="text-sm text-muted-foreground">No roles assigned</span>
                ) : (
                  roles.map((r) => (
                    <Badge key={r} variant="outline" className="capitalize border-accent text-accent">
                      {r}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5" /> My Teams
            </CardTitle>
            <CardDescription>Teams you belong to. Contact an admin to make changes.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTeams ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : teams.length === 0 ? (
              <p className="text-sm text-muted-foreground">You are not a member of any teams.</p>
            ) : (
              <ul className="space-y-2">
                {teams.map((t) => (
                  <li key={t.team_id} className="rounded-md border border-border bg-secondary/30 px-3 py-2">
                    <p className="font-medium text-foreground">{t.teams?.name ?? "Unknown team"}</p>
                    {t.teams?.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{t.teams.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="w-5 h-5" /> Change Password
            </CardTitle>
            <CardDescription>Choose a strong password with at least 6 characters.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
