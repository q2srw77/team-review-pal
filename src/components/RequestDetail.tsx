import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Send, Clock, User, Users, Calendar, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type ReviewRequest = Database["public"]["Tables"]["review_requests"]["Row"];
type RequestStatus = Database["public"]["Enums"]["request_status"];

interface Note {
  id: string;
  content: string;
  created_at: string;
  author_name: string;
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
  const { isReviewer, user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitterName, setSubmitterName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [reviewerStatuses, setReviewerStatuses] = useState<ReviewerStatus[]>([]);

  useEffect(() => {
    if (!request || !open) return;
    fetchNotes();
    fetchSubmitter();
    fetchTeam();
    fetchReviewerStatuses();
  }, [request, open]);

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
      .select("id, content, created_at, author_id")
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
      data.map((n) => ({
        id: n.id,
        content: n.content,
        created_at: n.created_at,
        author_name: nameMap.get(n.author_id) ?? "Unknown",
      }))
    );
  };

  const addNote = async () => {
    if (!request || !user || !newNote.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("request_notes").insert({
      request_id: request.id,
      author_id: user.id,
      content: newNote.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNewNote("");
      fetchNotes();
    }
  };

  const updateMyReviewStatus = async (newStatus: string) => {
    if (!request || !user) return;
    const { error } = await supabase
      .from("review_statuses")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("request_id", request.id)
      .eq("reviewer_id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      fetchReviewerStatuses();
      onUpdated();
    }
  };

  if (!request) return null;

  const myReviewStatus = reviewerStatuses.find((r) => r.reviewer_id === user?.id);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">{request.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block mb-1">Platform</span>
              <Badge variant="secondary">{request.platform}</Badge>
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
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {request.complete_by ? format(new Date(request.complete_by), "MMM d, yyyy") : "Not set"}
              </span>
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
          {request.url_location && (
            <div>
              <span className="text-muted-foreground text-sm block mb-1">URL</span>
              <a href={request.url_location} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-sm break-all">
                {request.url_location} <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>
          )}

          {/* Notes from submitter */}
          {request.notes && (
            <div>
              <span className="text-muted-foreground text-sm block mb-1">Notes</span>
              <p className="text-sm bg-secondary/50 rounded-lg p-3">{request.notes}</p>
            </div>
          )}

          <Separator />

          {/* Reviewer Progress */}
          {reviewerStatuses.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3">Reviewer Progress</h3>
              <div className="space-y-2">
                {reviewerStatuses.map((rs) => {
                  const Icon = REVIEWER_STATUS_ICON[rs.status] ?? Circle;
                  const isMe = rs.reviewer_id === user?.id;
                  return (
                    <div key={rs.id} className="flex items-center justify-between bg-secondary/40 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${
                          rs.status === "completed" ? "text-[hsl(var(--status-completed))]" :
                          rs.status === "in_review" ? "text-[hsl(var(--status-in-review))]" :
                          "text-muted-foreground"
                        }`} />
                        <span className="text-sm font-medium">{rs.reviewer_name}{isMe ? " (You)" : ""}</span>
                      </div>
                      {isMe && isReviewer ? (
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
          )}

          <Separator />

          {/* Reviewer notes */}
          <div>
            <h3 className="font-semibold text-sm mb-3">Reviewer Notes</h3>
            {notes.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No reviewer notes yet.</p>
            )}
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="bg-secondary/40 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-foreground">{note.author_name}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(note.created_at), "MMM d, h:mm a")}</span>
                  </div>
                  <p className="text-sm">{note.content}</p>
                </div>
              ))}
            </div>

            {isReviewer && (
              <div className="mt-4 space-y-2">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note…"
                  rows={2}
                  maxLength={2000}
                />
                <Button size="sm" onClick={addNote} disabled={submitting || !newNote.trim()}>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {submitting ? "Sending…" : "Add Note"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
