import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Platform {
  id: string;
  name: string;
  created_at: string;
}

export default function PlatformManagement() {
  const { toast } = useToast();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Platform | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Platform | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchPlatforms = useCallback(async () => {
    const { data } = await supabase.from("platforms").select("*").order("name");
    if (data) setPlatforms(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPlatforms(); }, [fetchPlatforms]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("platforms").insert({ name: name.trim() });
    setSaving(false);
    if (error) {
      toast({ title: error.message.includes("duplicate") ? "Platform already exists" : error.message, variant: "destructive" });
    } else {
      toast({ title: "Platform added" });
      setName("");
      setAddOpen(false);
      fetchPlatforms();
    }
  };

  const handleEdit = async () => {
    if (!editTarget || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("platforms").update({ name: name.trim() }).eq("id", editTarget.id);
    setSaving(false);
    if (error) {
      toast({ title: error.message.includes("duplicate") ? "Platform already exists" : error.message, variant: "destructive" });
    } else {
      toast({ title: "Platform updated" });
      setEditTarget(null);
      setName("");
      fetchPlatforms();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    // Check if platform is in use
    const { count } = await supabase
      .from("review_requests")
      .select("id", { count: "exact", head: true })
      .eq("platform", deleteTarget.name);
    if (count && count > 0) {
      toast({ title: "Cannot delete", description: `Platform is used by ${count} request(s)`, variant: "destructive" });
      setDeleteTarget(null);
      return;
    }
    const { error } = await supabase.from("platforms").delete().eq("id", deleteTarget.id);
    if (error) {
      toast({ title: error.message, variant: "destructive" });
    } else {
      toast({ title: "Platform deleted" });
      fetchPlatforms();
    }
    setDeleteTarget(null);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Platforms</h2>
          <p className="text-sm text-muted-foreground mt-1">{platforms.length} platforms</p>
        </div>
        <Button onClick={() => { setName(""); setAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Platform
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : platforms.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center">
          <Plus className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground font-medium">No platforms yet</p>
        </Card>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Created</th>
                  <th className="py-3 px-4 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {platforms.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground">{p.name}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">
                      {format(new Date(p.created_at), "MMM d, yyyy")}
                    </td>
                    <td className="py-3 px-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditTarget(p); setName(p.name); }}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(p)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Platform</DialogTitle>
            <DialogDescription>Add a new platform option for review requests.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Platform name" maxLength={100} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !name.trim()}>
              {saving ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Platform</DialogTitle>
            <DialogDescription>Rename this platform.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Platform name" maxLength={100} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving || !name.trim()}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Platform</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
