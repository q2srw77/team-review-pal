import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function RequestForm({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("");
  const [urlLocation, setUrlLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [teamId, setTeamId] = useState("");
  const [completeBy, setCompleteBy] = useState<Date | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from("platforms").select("id, name").order("name").then(({ data }) => {
      if (data) setPlatforms(data);
    });
    supabase.from("teams").select("id, name").order("name").then(({ data }) => {
      if (data) setTeams(data);
    });
  }, [open]);

  const reset = () => { setTitle(""); setPlatform(""); setUrlLocation(""); setNotes(""); setTeamId(""); setCompleteBy(undefined); setAttempted(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!user || !title.trim() || !platform || !teamId || !completeBy || !notes.trim()) return;
    setSubmitting(true);
    const requestId = crypto.randomUUID();
    const { error } = await supabase.from("review_requests").insert({
      id: requestId,
      title: title.trim(),
      platform: platform,
      url_location: urlLocation.trim(),
      notes: notes.trim(),
      submitted_by: user.id,
      team_id: teamId || null,
      complete_by: completeBy ? format(completeBy, "yyyy-MM-dd") : null,
    });
    if (error) {
      setSubmitting(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    // Send email notifications to team members via server-side wrapper
    // (authorization is enforced inside notify-request-event).
    try {
      await supabase.functions.invoke("notify-request-event", {
        body: {
          event: "request_created",
          request_id: requestId,
        },
      });
    } catch (emailErr) {
      console.error("Failed to send notifications:", emailErr);
    }
    // Log audit entry via edge function
    try {
      await supabase.functions.invoke("write-audit-log", {
        body: {
          action: "created",
          entity_type: "review_request",
          entity_id: requestId,
          details: { title: title.trim(), platform, team_id: teamId },
        },
      });
    } catch (e) {
      console.error("Failed to write audit log:", e);
    }
    setSubmitting(false);
    toast({ title: "Request submitted" });
    reset();
    setOpen(false);
    onCreated();
  };

  const RequiredStar = () => <span className="text-destructive ml-0.5">*</span>;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" />New Request</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Review Request</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title<RequiredStar /></Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" maxLength={255} className={cn(attempted && !title.trim() && "border-destructive")} />
            {attempted && !title.trim() && <p className="text-sm text-destructive">Title is required</p>}
          </div>
          <div className="space-y-2">
            <Label>Platform<RequiredStar /></Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className={cn(attempted && !platform && "border-destructive")}><SelectValue placeholder="Select platform" /></SelectTrigger>
              <SelectContent>
                {platforms.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {attempted && !platform && <p className="text-sm text-destructive">Platform is required</p>}
          </div>
          <div className="space-y-2">
            <Label>Team<RequiredStar /></Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className={cn(attempted && !teamId && "border-destructive")}><SelectValue placeholder="Select team" /></SelectTrigger>
              <SelectContent>
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {attempted && !teamId && <p className="text-sm text-destructive">Team is required</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">URL <span className="text-muted-foreground text-xs font-normal">(Optional)</span></Label>
            <Input id="url" value={urlLocation} onChange={(e) => setUrlLocation(e.target.value)} placeholder="https://..." maxLength={500} />
          </div>
          <div className="space-y-2">
            <Label>Complete By<RequiredStar /></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !completeBy && "text-muted-foreground", attempted && !completeBy && "border-destructive")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {completeBy ? format(completeBy, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={completeBy} onSelect={setCompleteBy} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            {attempted && !completeBy && <p className="text-sm text-destructive">Complete By date is required</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes<RequiredStar /></Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional context…" rows={3} maxLength={2000} className={cn(attempted && !notes.trim() && "border-destructive")} />
            {attempted && !notes.trim() && <p className="text-sm text-destructive">Notes are required</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}