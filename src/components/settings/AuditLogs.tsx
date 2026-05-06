import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Eye, ChevronDown, Search, X } from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  created_at: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
}

const ACTION_STYLES: Record<string, string> = {
  created: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  updated: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  deleted: "bg-destructive/15 text-destructive border-destructive/30",
  review_status_changed: "bg-violet-500/15 text-violet-600 border-violet-500/30",
};

const PAGE_SIZE = 50;

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  platform: "Platform",
  new_status: "New status",
  old_status: "Previous status",
  reason: "Reason",
  team_id: "Team",
  total: "Total",
  completed: "Completed",
  complete_by: "Complete by",
};

const humanize = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.replace(/_/g, " ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const labelFor = (key: string) =>
  FIELD_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const summarizeDetails = (details: Record<string, unknown> | null): string => {
  if (!details) return "—";
  const parts: string[] = [];
  if (details.title) parts.push(String(details.title));
  if (details.platform) parts.push(`on ${details.platform}`);
  if (details.new_status) parts.push(`→ ${humanize(details.new_status)}`);
  if (details.reason) parts.push(`(${humanize(details.reason)})`);
  if (typeof details.completed === "number" && typeof details.total === "number") {
    parts.push(`${details.completed} of ${details.total} completed`);
  }
  if (parts.length === 0) {
    return Object.entries(details)
      .map(([k, v]) => `${labelFor(k)}: ${humanize(v)}`)
      .join(", ");
  }
  return parts.join(" ");
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, search]);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (actionFilter !== "all") {
      query = query.eq("action", actionFilter);
    }

    if (search) {
      const escaped = search.replace(/[%,()]/g, " ");
      query = query.or(
        `action.ilike.%${escaped}%,entity_type.ilike.%${escaped}%,user_name.ilike.%${escaped}%`
      );
    }

    const { data, count } = await query;
    setLogs((data as AuditLog[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">Audit Logs</h2>
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="created">Created</SelectItem>
            <SelectItem value="updated">Updated</SelectItem>
            <SelectItem value="deleted">Deleted</SelectItem>
            <SelectItem value="review_status_changed">Status Changed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity Type</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No audit logs found.</TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(log.created_at), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{log.user_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ACTION_STYLES[log.action] ?? ""}>
                      {log.action.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm capitalize">{log.entity_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[360px] truncate">
                    {summarizeDetails(log.details)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!log.details}
                      onClick={() => { setSelected(log); setShowRaw(false); }}
                      aria-label="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages} ({total} entries)
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={ACTION_STYLES[selected.action] ?? ""}>
                    {selected.action.replace(/_/g, " ")}
                  </Badge>
                  <span className="capitalize text-base font-medium">
                    {selected.entity_type.replace(/_/g, " ")}
                  </span>
                </DialogTitle>
                <DialogDescription>
                  {format(new Date(selected.created_at), "MMM d, yyyy h:mm a")} · {selected.user_name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Summary</h3>
                  {selected.details && Object.keys(selected.details).length > 0 ? (
                    <dl className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-2 text-sm border rounded-md p-4 bg-muted/30">
                      {Object.entries(selected.details).map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt className="text-muted-foreground font-medium">{labelFor(k)}</dt>
                          <dd className="break-words">{humanize(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">No additional details.</p>
                  )}
                </div>

                {selected.entity_id && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Entity ID:</span> <code>{selected.entity_id}</code>
                  </div>
                )}

                {selected.details && (
                  <Collapsible open={showRaw} onOpenChange={setShowRaw}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-between">
                        <span>Advanced (raw JSON)</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showRaw ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <pre className="text-xs bg-muted rounded-md p-4 overflow-auto max-h-[40vh] font-mono">
                        {JSON.stringify(selected.details, null, 2)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
