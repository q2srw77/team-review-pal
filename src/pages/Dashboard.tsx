import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import RequestForm from "@/components/RequestForm";
import RequestDetail from "@/components/RequestDetail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ClipboardCheck, LogOut, Settings, Calendar, Download, AlertTriangle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type ReviewRequest = Database["public"]["Tables"]["review_requests"]["Row"];
type RequestStatus = Database["public"]["Enums"]["request_status"];

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

export default function Dashboard({ onNavigateSettings }: { onNavigateSettings?: () => void }) {
  const { user, signOut, isAdmin, roles, profileName, loading } = useAuth();
  const [allRequests, setAllRequests] = useState<ReviewRequest[]>([]);
  const [selected, setSelected] = useState<ReviewRequest | null>(null);
  const [view, setView] = useState<"active" | "completed">("active");
  const [detailOpen, setDetailOpen] = useState(false);
  const [teamMap, setTeamMap] = useState<Map<string, string>>(new Map());
  const [userTeamIds, setUserTeamIds] = useState<string[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, { completed: number; total: number }>>(new Map());

  // Fetch teams lookup and user's team memberships
  useEffect(() => {
    const fetchTeams = async () => {
      const { data } = await supabase.from("teams").select("id, name");
      setTeamMap(new Map(data?.map((t) => [t.id, t.name]) ?? []));
    };
    const fetchUserTeams = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id);
      setUserTeamIds(data?.map((m) => m.team_id) ?? []);
    };
    fetchTeams();
    fetchUserTeams();
  }, [user]);

  const fetchRequests = useCallback(async () => {
    if (!user) return;

    let data: ReviewRequest[] | null = null;

    if (isAdmin) {
      const res = await supabase
        .from("review_requests")
        .select("*")
        .order("created_at", { ascending: false });
      data = res.data;
    } else {
      // Non-admins: requests in their teams, submitted by them, or unassigned
      const res = await supabase
        .from("review_requests")
        .select("*")
        .order("created_at", { ascending: false });
      
      // Client-side filter since OR with in/is.null is complex
      data = (res.data ?? []).filter((r) =>
        r.submitted_by === user.id ||
        r.team_id === null ||
        userTeamIds.includes(r.team_id ?? "")
      );
    }

    const all = data ?? [];
    all.sort((a, b) => {
      const aCompleted = a.status === "completed" ? 1 : 0;
      const bCompleted = b.status === "completed" ? 1 : 0;
      if (aCompleted !== bCompleted) return aCompleted - bCompleted;
      if (!a.complete_by && !b.complete_by) return 0;
      if (!a.complete_by) return 1;
      if (!b.complete_by) return -1;
      return new Date(a.complete_by).getTime() - new Date(b.complete_by).getTime();
    });
    setAllRequests(all);
    if (selected) {
      const updated = data?.find((r) => r.id === selected.id);
      if (updated) setSelected(updated);
    }

    // Fetch reviewer progress for all requests
    const ids = (data ?? []).map((r) => r.id);
    if (ids.length > 0) {
      const { data: statuses } = await supabase
        .from("review_statuses")
        .select("request_id, status")
        .in("request_id", ids);
      const map = new Map<string, { completed: number; total: number }>();
      for (const s of statuses ?? []) {
        const entry = map.get(s.request_id) ?? { completed: 0, total: 0 };
        entry.total++;
        if (s.status === "completed") entry.completed++;
        map.set(s.request_id, entry);
      }
      setProgressMap(map);
    } else {
      setProgressMap(new Map());
    }
  }, [user, isAdmin, userTeamIds, selected]);

  useEffect(() => {
    if (user && !loading) fetchRequests();
  }, [user, userTeamIds, isAdmin, loading]);

  const openDetail = (r: ReviewRequest) => {
    setSelected(r);
    setDetailOpen(true);
  };

  const activeRequests = allRequests.filter((r) => r.status === "pending" || r.status === "in_review");
  const completedRequests = allRequests.filter((r) => r.status === "completed");
  const requests = view === "active" ? activeRequests : completedRequests;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-foreground"><h1 className="text-lg font-bold tracking-tight text-foreground">Review Hub</h1></h1>
            {(roles.includes("admin") ? ["admin"] : roles).map(role => (
              <Badge key={role} variant="outline" className="text-xs border-accent text-accent capitalize">{role}</Badge>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">{profileName}</span>
            {isAdmin && onNavigateSettings && (
              <Button variant="ghost" size="icon" onClick={onNavigateSettings}>
                <Settings className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Review Requests</h2>
            <p className="text-sm text-muted-foreground mt-1">{requests.length} {view} requests</p>
          </div>
          <RequestForm onCreated={fetchRequests} />
        </div>

        <div className="flex gap-2 mb-4">
          <Button
            variant={view === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("active")}
          >
            Active ({activeRequests.length})
          </Button>
          <Button
            variant={view === "completed" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("completed")}
          >
            Completed ({completedRequests.length})
          </Button>
        </div>

        {requests.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-20 text-center">
            <ClipboardCheck className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-medium">No review requests yet</p>
            <p className="text-sm text-muted-foreground mt-1">Submit the first one to get started.</p>
          </Card>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Title</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Platform</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell">Team</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden sm:table-cell">Progress</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Submitted</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Complete By</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => openDetail(r)}
                      className="border-b border-border/60 last:border-0 hover:bg-secondary/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-foreground">
                        <span className="flex items-center gap-1.5">
                          {r.title}
                          {r.complete_by && differenceInDays(new Date(r.complete_by), new Date()) <= 3 && r.status !== "completed" && (
                            <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary">{r.platform}</Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">
                        {r.team_id ? teamMap.get(r.team_id) ?? "—" : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={STATUS_STYLES[r.status]}>
                          {STATUS_LABELS[r.status]}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        {(() => {
                          const p = progressMap.get(r.id);
                          if (!p || p.total === 0) return <span className="text-muted-foreground text-xs">—</span>;
                          const pct = Math.round((p.completed / p.total) * 100);
                          return (
                            <div className="flex items-center gap-2 min-w-[80px]">
                              <span className="text-xs font-medium text-foreground whitespace-nowrap">{p.completed}/{p.total}</span>
                              <Progress value={pct} className="h-2 flex-1" />
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">
                        {format(new Date(r.created_at), "MMM d, yyyy")}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">
                        {r.complete_by ? (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(r.complete_by), "MMM d, yyyy")}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-3 px-4">
                        {r.report_pdf_path && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const { data } = await supabase.storage
                                .from("review-reports")
                                .createSignedUrl(r.report_pdf_path!, 3600);
                              if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                            }}
                            title="Download Report"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
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

      <RequestDetail
        request={selected}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdated={fetchRequests}
      />
    </div>
  );
}
