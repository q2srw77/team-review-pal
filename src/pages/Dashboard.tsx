import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import RequestForm from "@/components/RequestForm";
import RequestDetail from "@/components/RequestDetail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClipboardCheck, LogOut, Settings, Calendar, Download } from "lucide-react";
import { format } from "date-fns";
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
  const { user, signOut, isAdmin, roles, profileName } = useAuth();
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [selected, setSelected] = useState<ReviewRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [teamMap, setTeamMap] = useState<Map<string, string>>(new Map());
  const [userTeamIds, setUserTeamIds] = useState<string[]>([]);

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

    setRequests(data ?? []);
    if (selected) {
      const updated = data?.find((r) => r.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [user, isAdmin, userTeamIds, selected]);

  useEffect(() => {
    if (user) fetchRequests();
  }, [user, userTeamIds]);

  const openDetail = (r: ReviewRequest) => {
    setSelected(r);
    setDetailOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">Project Reviews</h1>
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
            <p className="text-sm text-muted-foreground mt-1">{requests.length} total requests</p>
          </div>
          <RequestForm onCreated={fetchRequests} />
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
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Submitted</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Complete By</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-10"></th>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => openDetail(r)}
                      className="border-b border-border/60 last:border-0 hover:bg-secondary/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-foreground">{r.title}</td>
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
                          <a
                            href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/review-reports/${r.report_pdf_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Download Report"
                          >
                            <Download className="w-4 h-4 text-primary hover:text-primary/80" />
                          </a>
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
