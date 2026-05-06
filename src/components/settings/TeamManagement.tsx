import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { MoreHorizontal, Plus, Trash2, Search, ArrowRight, X, UserPlus, UserMinus } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Team {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

export default function TeamManagement() {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Add/Edit state
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Team | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);

  // Manage members state
  const [membersTarget, setMembersTarget] = useState<Team | null>(null);
  const [members, setMembers] = useState<(TeamMember & { profile?: Profile })[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [membersLoading, setMembersLoading] = useState(false);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    const [{ data: teamsData }, { data: membersData }] = await Promise.all([
      supabase.from("teams").select("*").order("name"),
      supabase.from("team_members").select("team_id"),
    ]);
    setTeams(teamsData ?? []);
    const counts: Record<string, number> = {};
    (membersData ?? []).forEach((m) => {
      counts[m.team_id] = (counts[m.team_id] || 0) + 1;
    });
    setMemberCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("teams").insert({ name: name.trim(), description: description.trim() });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Team created" });
    setAddOpen(false);
    setName("");
    setDescription("");
    fetchTeams();
  };

  const handleEdit = async () => {
    if (!editTarget || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("teams").update({ name: name.trim(), description: description.trim() }).eq("id", editTarget.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Team updated" });
    setEditTarget(null);
    setName("");
    setDescription("");
    fetchTeams();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("teams").delete().eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Team deleted" });
    }
    setDeleteTarget(null);
    fetchTeams();
  };

  // Members management
  const openMembers = async (team: Team) => {
    setMembersTarget(team);
    setMembersLoading(true);
    const [{ data: teamMembers }, { data: profiles }] = await Promise.all([
      supabase.from("team_members").select("*").eq("team_id", team.id),
      supabase.from("profiles").select("user_id, full_name, email"),
    ]);
    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    setMembers(
      (teamMembers ?? []).map((m) => ({ ...m, profile: profileMap.get(m.user_id) }))
    );
    setAllProfiles(profiles ?? []);
    setSelectedUserIds([]);
    setMemberSearch("");
    setMembersLoading(false);
  };

  const addMember = async () => {
    if (!membersTarget || selectedUserIds.length === 0) return;
    const rows = selectedUserIds.map(uid => ({ team_id: membersTarget.id, user_id: uid }));
    const { error } = await supabase.from("team_members").insert(rows);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${selectedUserIds.length} member(s) added` });
    openMembers(membersTarget);
    fetchTeams();
  };

  const removeMember = async (memberId: string) => {
    if (!membersTarget) return;
    const { error } = await supabase.from("team_members").delete().eq("id", memberId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Member removed" });
    openMembers(membersTarget);
    fetchTeams();
  };

  const existingUserIds = new Set(members.map((m) => m.user_id));
  const availableProfiles = allProfiles.filter((p) => !existingUserIds.has(p.user_id));
  const filteredProfiles = availableProfiles.filter((p) => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    return p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Teams</h2>
          <p className="text-sm text-muted-foreground">Create and manage teams</p>
        </div>
        <Button onClick={() => { setName(""); setDescription(""); setAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Team
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : teams.length === 0 ? (
        <p className="text-muted-foreground text-sm">No teams yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team) => (
              <TableRow key={team.id}>
                <TableCell className="font-medium">{team.name}</TableCell>
                <TableCell className="text-muted-foreground max-w-xs truncate">{team.description || "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{memberCounts[team.id] ?? 0}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(team.created_at), "MMM d, yyyy")}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setName(team.name); setDescription(team.description); setEditTarget(team); }}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openMembers(team)}>
                        Manage Members
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(team)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Team</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !name.trim()}>
              {saving ? "Saving…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Team</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving || !name.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete team "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will also remove all members from this team. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Members Dialog */}
      <Dialog open={!!membersTarget} onOpenChange={(o) => { if (!o) setMembersTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Members — {membersTarget?.name}</DialogTitle></DialogHeader>

          {membersLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              {/* Add member */}
              {availableProfiles.length > 0 ? (
                <>
                  <Input
                    placeholder="Search users..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="mb-2"
                  />
                  <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
                    {filteredProfiles.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-1.5">No matching users.</p>
                    ) : (
                      filteredProfiles.map((p) => (
                        <label key={p.user_id} className="flex items-center gap-2 p-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                          <Checkbox
                            checked={selectedUserIds.includes(p.user_id)}
                            onCheckedChange={(checked) => {
                              setSelectedUserIds(prev =>
                                checked ? [...prev, p.user_id] : prev.filter(id => id !== p.user_id)
                              );
                            }}
                          />
                          <span>{p.full_name || p.email}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <Button onClick={addMember} disabled={selectedUserIds.length === 0} size="sm">
                    Add ({selectedUserIds.length})
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">All users are already members.</p>
              )}

              {/* Current members */}
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-2 rounded-md border">
                      <div className="text-sm">
                        <p className="font-medium">{m.profile?.full_name || "Unknown"}</p>
                        <p className="text-muted-foreground text-xs">{m.profile?.email}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeMember(m.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
