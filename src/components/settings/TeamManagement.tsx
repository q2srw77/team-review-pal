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
  const [selectedAvailable, setSelectedAvailable] = useState<string[]>([]);
  const [selectedAssigned, setSelectedAssigned] = useState<string[]>([]);
  const [availableSearch, setAvailableSearch] = useState("");
  const [assignedSearch, setAssignedSearch] = useState("");
  const [membersLoading, setMembersLoading] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<{ userIds: string[]; label: string } | null>(null);

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
    setSelectedAvailable([]);
    setSelectedAssigned([]);
    setAvailableSearch("");
    setAssignedSearch("");
    setMembersLoading(false);
  };

  const refreshMembers = async (teamId: string) => {
    const { data: teamMembers } = await supabase.from("team_members").select("*").eq("team_id", teamId);
    const profileMap = new Map(allProfiles.map((p) => [p.user_id, p]));
    setMembers((teamMembers ?? []).map((m) => ({ ...m, profile: profileMap.get(m.user_id) })));
    setSelectedAvailable([]);
    setSelectedAssigned([]);
  };

  const addMembers = async (userIds: string[]) => {
    if (!membersTarget || userIds.length === 0) return;
    const rows = userIds.map(uid => ({ team_id: membersTarget.id, user_id: uid }));
    const { error } = await supabase.from("team_members").insert(rows);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${userIds.length} member(s) added` });
    await refreshMembers(membersTarget.id);
    fetchTeams();
  };

  const removeMembersByUserIds = async (userIds: string[]) => {
    if (!membersTarget || userIds.length === 0) return;
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", membersTarget.id)
      .in("user_id", userIds);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${userIds.length} member(s) removed` });
    await refreshMembers(membersTarget.id);
    fetchTeams();
  };

  const existingUserIds = new Set(members.map((m) => m.user_id));
  const availableProfiles = allProfiles.filter((p) => !existingUserIds.has(p.user_id));
  const filteredAvailable = availableProfiles.filter((p) => {
    if (!availableSearch.trim()) return true;
    const q = availableSearch.toLowerCase();
    return p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q);
  });
  const filteredAssigned = members.filter((m) => {
    if (!assignedSearch.trim()) return true;
    const q = assignedSearch.toLowerCase();
    return m.profile?.full_name?.toLowerCase().includes(q) || m.profile?.email?.toLowerCase().includes(q);
  });

  const initials = (name?: string, email?: string) => {
    const src = (name || email || "?").trim();
    const parts = src.split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || src[0]?.toUpperCase() || "?";
  };

  const allFilteredAvailableSelected =
    filteredAvailable.length > 0 && filteredAvailable.every(p => selectedAvailable.includes(p.user_id));
  const allFilteredAssignedSelected =
    filteredAssigned.length > 0 && filteredAssigned.every(m => selectedAssigned.includes(m.user_id));


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
        <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-lg">Members — {membersTarget?.name}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {members.length} assigned · {availableProfiles.length} available
            </p>
          </DialogHeader>

          {membersLoading ? (
            <p className="text-sm text-muted-foreground p-6">Loading…</p>
          ) : (
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
              {/* Available pane */}
              <div className="flex flex-col h-[60vh]">
                <div className="px-5 py-3 border-b bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-muted-foreground" />
                      Available
                      <Badge variant="secondary" className="ml-1">{availableProfiles.length}</Badge>
                    </h3>
                    {filteredAvailable.length > 0 && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <Checkbox
                          checked={allFilteredAvailableSelected}
                          onCheckedChange={(checked) => {
                            setSelectedAvailable(checked ? filteredAvailable.map(p => p.user_id) : []);
                          }}
                        />
                        Select all
                      </label>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users…"
                      value={availableSearch}
                      onChange={(e) => setAvailableSearch(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {filteredAvailable.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-4 text-center">
                        {availableProfiles.length === 0 ? "All users are already members." : "No matching users."}
                      </p>
                    ) : (
                      filteredAvailable.map((p) => {
                        const checked = selectedAvailable.includes(p.user_id);
                        return (
                          <div
                            key={p.user_id}
                            className={`group flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer transition-colors ${checked ? "bg-accent" : "hover:bg-accent/50"}`}
                            onClick={() => setSelectedAvailable(prev =>
                              prev.includes(p.user_id) ? prev.filter(id => id !== p.user_id) : [...prev, p.user_id]
                            )}
                          >
                            <Checkbox checked={checked} className="pointer-events-none" />
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-xs">{initials(p.full_name, p.email)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{p.full_name || p.email}</p>
                              {p.full_name && <p className="text-xs text-muted-foreground truncate">{p.email}</p>}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); addMembers([p.user_id]); }}
                              title="Add to team"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
                <div className="border-t p-3 bg-muted/20">
                  <Button
                    onClick={() => addMembers(selectedAvailable)}
                    disabled={selectedAvailable.length === 0}
                    size="sm"
                    className="w-full"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Add selected ({selectedAvailable.length})
                  </Button>
                </div>
              </div>

              {/* Assigned pane */}
              <div className="flex flex-col h-[60vh]">
                <div className="px-5 py-3 border-b bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <UserMinus className="w-4 h-4 text-muted-foreground" />
                      Assigned
                      <Badge variant="secondary" className="ml-1">{members.length}</Badge>
                    </h3>
                    {filteredAssigned.length > 0 && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <Checkbox
                          checked={allFilteredAssignedSelected}
                          onCheckedChange={(checked) => {
                            setSelectedAssigned(checked ? filteredAssigned.map(m => m.user_id) : []);
                          }}
                        />
                        Select all
                      </label>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search members…"
                      value={assignedSearch}
                      onChange={(e) => setAssignedSearch(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {filteredAssigned.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-4 text-center">
                        {members.length === 0 ? "No members yet — add some from the left." : "No matching members."}
                      </p>
                    ) : (
                      filteredAssigned.map((m) => {
                        const checked = selectedAssigned.includes(m.user_id);
                        return (
                          <div
                            key={m.id}
                            className={`group flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer transition-colors ${checked ? "bg-accent" : "hover:bg-accent/50"}`}
                            onClick={() => setSelectedAssigned(prev =>
                              prev.includes(m.user_id) ? prev.filter(id => id !== m.user_id) : [...prev, m.user_id]
                            )}
                          >
                            <Checkbox checked={checked} className="pointer-events-none" />
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-xs">
                                {initials(m.profile?.full_name, m.profile?.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{m.profile?.full_name || m.profile?.email || "Unknown"}</p>
                              {m.profile?.full_name && (
                                <p className="text-xs text-muted-foreground truncate">{m.profile?.email}</p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRemoveConfirm({
                                  userIds: [m.user_id],
                                  label: m.profile?.full_name || m.profile?.email || "this member",
                                });
                              }}
                              title="Remove from team"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
                <div className="border-t p-3 bg-muted/20">
                  <Button
                    onClick={() => setRemoveConfirm({
                      userIds: selectedAssigned,
                      label: `${selectedAssigned.length} member${selectedAssigned.length === 1 ? "" : "s"}`,
                    })}
                    disabled={selectedAssigned.length === 0}
                    variant="destructive"
                    size="sm"
                    className="w-full"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove selected ({selectedAssigned.length})
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="px-6 py-4 border-t bg-muted/10">
            <Button variant="outline" onClick={() => setMembersTarget(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!removeConfirm} onOpenChange={(o) => { if (!o) setRemoveConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {removeConfirm?.label}{membersTarget ? ` from ${membersTarget.name}` : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to this team's review requests. This can be undone by re-adding them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (removeConfirm) {
                  await removeMembersByUserIds(removeConfirm.userIds);
                }
                setRemoveConfirm(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </div>
  );
}
