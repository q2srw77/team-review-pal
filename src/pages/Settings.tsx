import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, ClipboardCheck, MoreHorizontal, Pencil, Plus, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ALL_ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "reviewer", label: "Reviewer" },
  { value: "submitter", label: "Submitter" },
];

interface UserWithRoles {
  user_id: string;
  full_name: string;
  email: string;
  roles: AppRole[];
  created_at: string;
}

const ROLE_STYLES: Record<AppRole, string> = {
  admin: "bg-primary/15 text-primary border-primary/30",
  reviewer: "bg-accent/15 text-accent border-accent/30",
  submitter: "bg-muted text-muted-foreground border-border",
};

export default function Settings({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserWithRoles | null>(null);
  const [roleChangeTarget, setRoleChangeTarget] = useState<UserWithRoles | null>(null);
  const [newRoles, setNewRoles] = useState<AppRole[]>([]);
  const [editTarget, setEditTarget] = useState<UserWithRoles | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);

  const [inviteForm, setInviteForm] = useState({
    full_name: "",
    email: "",
    password: "",
    roles: [] as AppRole[],
  });

  const fetchUsers = useCallback(async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email, created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    if (!profiles) {
      setLoading(false);
      return;
    }

    const userList: UserWithRoles[] = profiles.map((p) => {
      const userRoles = roles?.filter((r) => r.user_id === p.user_id).map((r) => r.role as AppRole) ?? [];
      return {
        user_id: p.user_id,
        full_name: p.full_name,
        email: (p as any).email ?? "",
        roles: userRoles.length > 0 ? userRoles : ["submitter" as AppRole],
        created_at: p.created_at,
      };
    });

    setUsers(userList);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleRole = (current: AppRole[], role: AppRole): AppRole[] => {
    return current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
  };

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.password || !inviteForm.full_name) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    if (inviteForm.roles.length === 0) {
      toast({ title: "Select at least one role", variant: "destructive" });
      return;
    }
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: inviteForm,
    });
    setInviting(false);

    if (error || data?.error) {
      toast({ title: data?.error || error?.message || "Failed to invite user", variant: "destructive" });
      return;
    }

    toast({ title: "User invited successfully" });
    setInviteOpen(false);
    setInviteForm({ full_name: "", email: "", password: "", roles: [] });
    fetchUsers();
  };

  const handleRoleChange = async () => {
    if (!roleChangeTarget || newRoles.length === 0) {
      toast({ title: "Select at least one role", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.functions.invoke("manage-user", {
      body: { action: "update_roles", user_id: roleChangeTarget.user_id, roles: newRoles },
    });

    if (error || data?.error) {
      toast({ title: data?.error || error?.message || "Failed to update roles", variant: "destructive" });
    } else {
      toast({ title: "Roles updated" });
      fetchUsers();
    }
    setRoleChangeTarget(null);
  };

  const handleEditUser = async () => {
    if (!editTarget) return;
    if (!editForm.full_name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!editForm.email.trim()) {
      toast({ title: "Email is required", variant: "destructive" });
      return;
    }
    if (editForm.password && editForm.password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setSaving(true);
    const body: Record<string, string> = {
      action: "update_user",
      user_id: editTarget.user_id,
      full_name: editForm.full_name.trim(),
      email: editForm.email.trim(),
    };
    if (editForm.password) body.password = editForm.password;
    const { data, error } = await supabase.functions.invoke("manage-user", { body });
    setSaving(false);

    if (error || data?.error) {
      toast({ title: data?.error || error?.message || "Failed to update user", variant: "destructive" });
    } else {
      toast({ title: "User updated" });
      setEditTarget(null);
      fetchUsers();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { data, error } = await supabase.functions.invoke("manage-user", {
      body: { action: "delete_user", user_id: deleteTarget.user_id },
    });

    if (error || data?.error) {
      toast({ title: data?.error || error?.message || "Failed to remove user", variant: "destructive" });
    } else {
      toast({ title: "User removed" });
      fetchUsers();
    }
    setDeleteTarget(null);
  };

  const RoleCheckboxGroup = ({
    selected,
    onChange,
  }: {
    selected: AppRole[];
    onChange: (roles: AppRole[]) => void;
  }) => (
    <div className="space-y-3">
      {ALL_ROLES.map((r) => (
        <label key={r.value} className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={selected.includes(r.value)}
            onCheckedChange={() => onChange(toggleRole(selected, r.value))}
          />
          <span className="text-sm font-medium">{r.label}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">Settings</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Users</h2>
            <p className="text-sm text-muted-foreground mt-1">{users.length} team members</p>
          </div>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite User
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        ) : users.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-20 text-center">
            <Plus className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-medium">No users yet</p>
          </Card>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Roles</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Joined</th>
                    <th className="py-3 px-4 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id} className="border-b border-border/60 last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground">{u.full_name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((role) => (
                            <Badge key={role} variant="outline" className={ROLE_STYLES[role]}>
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">
                        {format(new Date(u.created_at), "MMM d, yyyy")}
                      </td>
                      <td className="py-3 px-4">
                        {u.user_id !== user?.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditTarget(u); setEditForm({ full_name: u.full_name, email: u.email, password: "" }); }}>
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setRoleChangeTarget(u); setNewRoles(u.roles); }}>
                                Change Roles
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(u)}>
                                Remove User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>Create an account for a new team member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={inviteForm.full_name}
                onChange={(e) => setInviteForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="jane@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={inviteForm.password}
                onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min 6 characters"
              />
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <RoleCheckboxGroup
                selected={inviteForm.roles}
                onChange={(roles) => setInviteForm((f) => ({ ...f, roles }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? "Inviting..." : "Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={!!roleChangeTarget} onOpenChange={(o) => !o && setRoleChangeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Roles</DialogTitle>
            <DialogDescription>Update roles for {roleChangeTarget?.full_name}.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <RoleCheckboxGroup selected={newRoles} onChange={setNewRoles} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleChangeTarget(null)}>Cancel</Button>
            <Button onClick={handleRoleChange}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update details for {editTarget?.full_name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>New Password (leave blank to keep current)</Label>
              <Input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min 6 characters"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleEditUser} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deleteTarget?.full_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
