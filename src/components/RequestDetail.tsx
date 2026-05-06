import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ExternalLink, Send, Clock, User, Users, Calendar as CalendarIcon, CheckCircle2, Circle, Loader2, Download, Pencil, X, Save, Trash2, Lock, Maximize2, Minimize2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type ReviewRequest = Database["public"]["Tables"]["review_requests"]["Row"];
type RequestStatus = Database["public"]["Enums"]["request_status"];

type PositionLabel = "None" | "Slide" | "Step" | "Page";

interface Note {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author_name: string;
  position_number: number | null;
}

interface ReviewerStatus {
  id: string;
  reviewer_id: string;
  reviewer_name: string;
  status: string;
}

const STATUS_STYLES: Record<RequestStatus, string> = {
  pending: "bg-[hsl(var(--status-pending)/0.15)] text-[hsl(var(--status-pending))] border-[hsl(var(--status-pending)/0.3)]",
  in_review: "bg-[hsl(var(--status-in-review)/0.15)] text-[hsl(var(--status-in-review))] border-[hsl(var(--status-in-review)/0.3)]",
  completed: "bg-[hsl(var(--status-completed)/0.15)] text-[hsl(var(--status-completed))] border-[hsl(var(--status-completed)/0.3)]",
};

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "Pending",
  in_review: "In Review",
  completed: "Completed",
};

const REVIEWER_STATUS_ICON: Record<string, typeof Circle> = {
  pending: Circle,
  in_review: Loader2,
  completed: CheckCircle2,
};

export default function RequestDetail({
  request,
  open,
  onClose,
  onUpdated,
}: {
  request: ReviewRequest | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { isReviewer, isAdmin, user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newNotePosition, setNewNotePosition] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [editNotePosition, setEditNotePosition] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [submitterName, setSubmitterName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [positionLabel, setPositionLabel] = useState<PositionLabel>("None");
  const [reviewerStatuses, setReviewerStatuses] = useState<ReviewerStatus[]>([]);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editPlatform, setEditPlatform] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editCompleteBy, setEditCompleteBy] = useState<Date | undefined>();
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!request || !open) return;
    fetchNotes();
    fetchSubmitter();
    fetchTeam();
    fetchReviewerStatuses();
    fetchPlatformLabel();
    setEditing(false);
    setNewNote("");
    setNewNotePosition("");
  }, [request, open]);

  const fetchPlatformLabel = async () => {
    if (!request?.platform) { setPositionLabel("None"); return; }
    const { data } = await supabase
      .from("platforms")
      .select("position_label")
      .eq("name", request.platform)
      .maybeSingle();
    setPositionLabel(((data as { position_label?: PositionLabel } | null)?.position_label ?? "None") as PositionLabel);
  };

  const canEdit = user?.id === request?.submitted_by && request?.status !== "completed";
  const canArchiveDelete = user?.id === request?.submitted_by || isAdmin;

  const enterEditMode = async () => {
    if (!request) return;
    setEditTitle(request.title);
    setEditPlatform(request.platform);
    setEditUrl(request.url_location || "");
    setEditNotes(request.notes || "");
    setEditCompleteBy(request.complete_by ? new Date(request.complete_by + "T00:00:00") : undefined);

    // Fetch platforms for dropdown
    const { data } = await supabase.from("platforms").select("id, name").order("name");
    setPlatforms(data ?? []);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveEdit = async () => {
    if (!request || !editTitle.trim() || !editPlatform || !editCompleteBy) {
      toast({ title: "Missing fields", description: "Title, platform, and complete by date are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("review_requests")
      .update({
        title: editTitle.trim(),
        platform: editPlatform,
        url_location: editUrl.trim() || "",
        notes: editNotes.trim(),
        complete_by: format(editCompleteBy, "yyyy-MM-dd"),
      })
      .eq("id", request.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Audit log via edge function
      if (user) {
        supabase.functions.invoke("write-audit-log", {
          body: {
            action: "updated", entity_type: "review_request", entity_id: request.id,
            details: { title: editTitle.trim(), platform: editPlatform },
          },
        }).catch(() => {});
      }
      toast({ title: "Updated", description: "Review request updated successfully." });
      setEditing(false);
      onUpdated();
    }
  };

  const deleteRequest = async () => {
    if (!request) return;
    setDeleting(true);
    // Delete related data first
    await supabase.from("review_statuses").delete().eq("request_id", request.id);
    await supabase.from("request_notes").delete().eq("request_id", request.id);
    const { error } = await supabase.from("review_requests").delete().eq("id", request.id);
    setDeleting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      if (user) {
        supabase.functions.invoke("write-audit-log", {
          body: {
            action: "deleted", entity_type: "review_request", entity_id: request.id,
            details: { title: request.title },
          },
        }).catch(() => {});
      }
      toast({ title: "Deleted", description: "Request has been permanently deleted." });
      onUpdated();
      onClose();
    }
  };

  const fetchSubmitter = async () => {
    if (!request) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", request.submitted_by)
      .single();
    setSubmitterName(data?.full_name ?? "Unknown");
  };

  const fetchTeam = async () => {
    if (!request?.team_id) {
      setTeamName("");
      return;
    }
    const { data } = await supabase
      .from("teams")
      .select("name")
      .eq("id", request.team_id)
      .single();
    setTeamName(data?.name ?? "Unknown");
  };

  const fetchReviewerStatuses = async () => {
    if (!request) return;
    const { data } = await supabase
      .from("review_statuses")
      .select("id, reviewer_id, status")
      .eq("request_id", request.id);

    if (!data || data.length === 0) {
      setReviewerStatuses([]);
      return;
    }

    const reviewerIds = data.map((r) => r.reviewer_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", reviewerIds);

    const nameMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) ?? []);

    setReviewerStatuses(
      data.map((r) => ({
        id: r.id,
        reviewer_id: r.reviewer_id,
        reviewer_name: nameMap.get(r.reviewer_id) ?? "Unknown",
        status: r.status,
      }))
    );
  };

  const fetchNotes = async () => {
    if (!request) return;
    const { data } = await supabase
      .from("request_notes")
      .select("id, content, created_at, author_id, position_number")
      .eq("request_id", request.id)
      .order("created_at", { ascending: true });

    if (!data) return;

    const authorIds = [...new Set(data.map((n) => n.author_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", authorIds);

    const nameMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) ?? []);

    setNotes(
      data.map((n: { id: string; content: string; created_at: string; author_id: string; position_number: number | null }) => ({
        id: n.id,
        content: n.content,
        created_at: n.created_at,
        author_id: n.author_id,
        author_name: nameMap.get(n.author_id) ?? "Unknown",
        position_number: n.position_number,
      }))
    );
  };

  const addNote = async () => {
    if (!request || !user || !newNote.trim()) return;
    let positionNumber: number | null = null;
    if (positionLabel !== "None") {
      const n = parseInt(newNotePosition, 10);
      if (!Number.isFinite(n) || n < 1 || n > 999) {
        toast({ title: "Number required", description: `Enter a ${positionLabel.toLowerCase()} number (1–999).`, variant: "destructive" });
        return;
      }
      positionNumber = n;
    }
    setSubmitting(true);
    const { error } = await supabase.from("request_notes").insert({
      request_id: request.id,
      author_id: user.id,
      content: newNote.trim(),
      position_number: positionNumber,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNewNote("");
      setNewNotePosition("");
      fetchNotes();
    }
  };

  const startEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditNoteContent(note.content);
    setEditNotePosition(note.position_number != null ? String(note.position_number) : "");
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditNoteContent("");
    setEditNotePosition("");
  };

  const saveEditNote = async (noteId: string) => {
    if (!editNoteContent.trim()) return;
    let positionNumber: number | null = null;
    if (positionLabel !== "None") {
      const n = parseInt(editNotePosition, 10);
      if (!Number.isFinite(n) || n < 1 || n > 999) {
        toast({ title: "Number required", description: `Enter a ${positionLabel.toLowerCase()} number (1–999).`, variant: "destructive" });
        return;
      }
      positionNumber = n;
    }
    setSavingNote(true);
    const { error } = await supabase
      .from("request_notes")
      .update({ content: editNoteContent.trim(), position_number: positionNumber })
      .eq("id", noteId);
    setSavingNote(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      cancelEditNote();
      fetchNotes();
    }
  };

  const updateMyReviewStatus = async (newStatus: string) => {
    if (!request || !user) return;
    if (request.status === "completed") {
      toast({
        title: "Review locked",
        description: "This review is closed and can no longer be updated.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase
      .from("review_statuses")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("request_id", request.id)
      .eq("reviewer_id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Audit log for status change via edge function
      if (user) {
        supabase.functions.invoke("write-audit-log", {
          body: {
            action: "review_status_changed", entity_type: "review_request", entity_id: request.id,
            details: { new_status: newStatus, title: request.title },
          },
        }).catch(() => {});
      }
      fetchReviewerStatuses();
      onUpdated();

      // Check if all reviewers are now completed and send instant notification
      if (newStatus === "completed") {
        const { data: allStatuses } = await supabase
          .from("review_statuses")
          .select("status")
          .eq("request_id", request.id);

        const allComplete = allStatuses && allStatuses.length > 0 && allStatuses.every((s) => s.status === "completed");

        if (allComplete) {
          // Fetch submitter email and team name for the notification
          const [{ data: submitterProfile }, { data: team }] = await Promise.all([
            supabase.from("profiles").select("email").eq("user_id", request.submitted_by).single(),
            request.team_id
              ? supabase.from("teams").select("name").eq("id", request.team_id).single()
              : Promise.resolve({ data: null }),
          ]);

          if (submitterProfile?.email) {
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "review-all-complete",
                recipientEmail: submitterProfile.email,
                idempotencyKey: `review-all-complete-${request.id}`,
                templateData: {
                  title: request.title,
                  platform: request.platform,
                  teamName: team?.name,
                },
              },
            });
          }

          // Trigger PDF report generation
          await supabase.functions.invoke("generate-review-report", {
            body: { request_id: request.id },
          });
        }
      }
    }
  };

  if (!request) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between gap-2 pr-8">
            <SheetTitle className="text-xl flex-1">
              {editing ? (
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-xl font-semibold"
                />
              ) : (
                request.title
              )}
            </SheetTitle>
            {canEdit && !editing && (
              <Button variant="ghost" size="sm" onClick={enterEditMode}>
                <Pencil className="w-4 h-4 mr-1" /> Edit
              </Button>
            )}
            {editing && (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={cancelEdit}>
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={saving}>
                  <Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block mb-1">Platform</span>
              {editing ? (
                <Select value={editPlatform} onValueChange={setEditPlatform}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map((p) => (
                      <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="secondary">{request.platform}</Badge>
              )}
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Overall Status</span>
              <Badge className={STATUS_STYLES[request.status]} variant="outline">
                {STATUS_LABELS[request.status]}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Team</span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {teamName || "None"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Complete By</span>
              {editing ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-full justify-start text-left font-normal h-8",
                        !editCompleteBy && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                      {editCompleteBy ? format(editCompleteBy, "MMM d, yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editCompleteBy}
                      onSelect={setEditCompleteBy}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {request.complete_by ? format(new Date(request.complete_by), "MMM d, yyyy") : "Not set"}
                </span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Submitted by</span>
              <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{submitterName}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Submitted</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{format(new Date(request.created_at), "MMM d, yyyy")}</span>
            </div>
          </div>

          {/* URL */}
          <div>
            <span className="text-muted-foreground text-sm block mb-1">URL</span>
            {editing ? (
              <Input
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://..."
                className="h-8"
              />
            ) : request.url_location ? (
              <a href={request.url_location} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-sm break-all">
                {request.url_location} <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            ) : (
              <span className="text-sm text-muted-foreground">Not provided</span>
            )}
          </div>

          {/* Notes from submitter */}
          <div>
            <span className="text-muted-foreground text-sm block mb-1">Notes</span>
            {editing ? (
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            ) : request.notes ? (
              <p className="text-sm bg-secondary/50 rounded-lg p-3">{request.notes}</p>
            ) : (
              <span className="text-sm text-muted-foreground">No notes</span>
            )}
          </div>

          {/* Download Report */}
          {request.report_pdf_path && (
            <div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={async () => {
                  const { data } = await supabase.storage
                    .from("review-reports")
                    .createSignedUrl(request.report_pdf_path!, 3600);
                  if (data?.signedUrl) {
                    window.open(data.signedUrl, "_blank");
                  }
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Review Report (PDF)
              </Button>
            </div>
          )}

          <Separator />

          {/* Reviewer Progress */}
      {reviewerStatuses.length > 0 && (() => {
            const isSubmitter = user?.id === request.submitted_by;
            const visibleStatuses = (isSubmitter || isAdmin)
              ? reviewerStatuses
              : reviewerStatuses.filter((rs) => rs.reviewer_id === user?.id);
            return visibleStatuses.length > 0 ? (
            <div>
              <h3 className="font-semibold text-sm mb-3">Reviewer Progress</h3>
              {request.status === "completed" && (
                <div className={cn(
                  "mb-3 rounded-md px-3 py-2 text-xs flex items-start gap-1.5",
                  request.closed_reason === "deadline_reached"
                    ? "bg-[hsl(var(--status-pending)/0.1)] text-[hsl(var(--status-pending))] border border-[hsl(var(--status-pending)/0.3)]"
                    : "bg-muted text-muted-foreground"
                )}>
                  <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    {request.closed_reason === "deadline_reached" ? (
                      <>
                        Auto-closed on {request.complete_by ? format(new Date(request.complete_by), "MMM d, yyyy") : "deadline"}.
                        Remaining reviewer statuses are frozen as-is.
                      </>
                    ) : (
                      "This review is complete and locked for further changes."
                    )}
                  </span>
                </div>
              )}
              <div className="space-y-2">
                {visibleStatuses.map((rs) => {
                  const Icon = REVIEWER_STATUS_ICON[rs.status] ?? Circle;
                  const isMe = rs.reviewer_id === user?.id;
                  const isAutoClosedIncomplete =
                    request.status === "completed" &&
                    request.closed_reason === "deadline_reached" &&
                    rs.status !== "completed";
                  return (
                    <div key={rs.id} className="flex items-center justify-between bg-secondary/40 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${
                          rs.status === "completed" ? "text-[hsl(var(--status-completed))]" :
                          rs.status === "in_review" ? "text-[hsl(var(--status-in-review))]" :
                          "text-muted-foreground"
                        }`} />
                        <span className="text-sm font-medium">{rs.reviewer_name}{isMe ? " (You)" : ""}</span>
                        {isAutoClosedIncomplete && (
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">
                            Did not complete
                          </span>
                        )}
                      </div>
                      {isMe && isReviewer && request.status !== "completed" ? (
                        <Select value={rs.status} onValueChange={updateMyReviewStatus}>
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_review">In Review</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={`text-xs ${
                          rs.status === "completed" ? STATUS_STYLES.completed :
                          rs.status === "in_review" ? STATUS_STYLES.in_review :
                          STATUS_STYLES.pending
                        }`}>
                          {STATUS_LABELS[rs.status as RequestStatus] ?? rs.status}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null;
          })()}

          <Separator />

          {/* Reviewer notes */}
          <div>
            <h3 className="font-semibold text-sm mb-3">Reviewer Notes</h3>
            {notes.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No reviewer notes yet.</p>
            )}
            <div className="space-y-3">
              {[...notes]
                .sort((a, b) => {
                  if (positionLabel === "None") return a.created_at.localeCompare(b.created_at);
                  const ax = a.position_number ?? Number.MAX_SAFE_INTEGER;
                  const bx = b.position_number ?? Number.MAX_SAFE_INTEGER;
                  if (ax !== bx) return ax - bx;
                  return a.created_at.localeCompare(b.created_at);
                })
                .map((note) => (
                <div key={note.id} className="bg-secondary/40 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {positionLabel !== "None" && note.position_number != null && editingNoteId !== note.id && (
                        <Badge className="text-[10px] uppercase tracking-wide shrink-0 font-bold text-white border-transparent hover:opacity-90" style={{ backgroundColor: "#2006F7" }}>
                          {positionLabel} {note.position_number}
                        </Badge>
                      )}
                      <span className="font-medium text-sm text-foreground truncate">{note.author_name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{format(new Date(note.created_at), "MMM d, h:mm a")}</span>
                      {user?.id === note.author_id && request.status !== "completed" && editingNoteId !== note.id && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => startEditNote(note)}
                          aria-label="Edit note"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {editingNoteId === note.id ? (
                    <div className="space-y-2">
                      {positionLabel !== "None" && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{positionLabel} #</span>
                          <Input
                            value={editNotePosition}
                            onChange={(e) => setEditNotePosition(e.target.value.replace(/\D/g, "").slice(0, 3))}
                            inputMode="numeric"
                            maxLength={3}
                            placeholder="1-999"
                            className="h-8 w-24"
                          />
                        </div>
                      )}
                      <Textarea
                        value={editNoteContent}
                        onChange={(e) => setEditNoteContent(e.target.value)}
                        rows={2}
                        maxLength={2000}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => saveEditNote(note.id)}
                          disabled={savingNote || !editNoteContent.trim() || (positionLabel !== "None" && !editNotePosition)}
                        >
                          <Save className="w-3.5 h-3.5 mr-1.5" />
                          {savingNote ? "Saving…" : "Save"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEditNote} disabled={savingNote}>
                          <X className="w-3.5 h-3.5 mr-1.5" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  )}
                </div>
              ))}
            </div>

            {isReviewer && request.status !== "completed" && (
              <div className="mt-4 space-y-2">
                {positionLabel !== "None" && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{positionLabel} #</span>
                    <Input
                      value={newNotePosition}
                      onChange={(e) => setNewNotePosition(e.target.value.replace(/\D/g, "").slice(0, 3))}
                      inputMode="numeric"
                      maxLength={3}
                      placeholder="1-999"
                      className="h-8 w-24"
                    />
                  </div>
                )}
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note…"
                  rows={2}
                  maxLength={2000}
                />
                <Button
                  size="sm"
                  onClick={addNote}
                  disabled={submitting || !newNote.trim() || (positionLabel !== "None" && !newNotePosition)}
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {submitting ? "Sending…" : "Add Note"}
                </Button>
              </div>
            )}
          </div>

          {/* Delete action */}
          {canArchiveDelete && (
            <>
              <Separator />
              <div className="flex items-center gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={deleting}>
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      {deleting ? "Deleting…" : "Delete"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this request permanently?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. The request, all reviewer statuses, and all notes will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={deleteRequest} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
