import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function RequestForm({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("");
  const [urlLocation, setUrlLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from("platforms").select("id, name").order("name").then(({ data }) => {
      if (data) setPlatforms(data);
    });
  }, [open]);

  const reset = () => { setTitle(""); setPlatform(""); setUrlLocation(""); setNotes(""); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !platform) return;
    setSubmitting(true);
    const { error } = await supabase.from("review_requests").insert({
      title: title.trim(),
      platform: platform,
      url_location: urlLocation.trim(),
      notes: notes.trim(),
      submitted_by: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Request submitted" });
      reset();
      setOpen(false);
      onCreated();
    }
  };

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
            <Label htmlFor="title">Title</Label>
            <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" maxLength={255} />
          </div>
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
              <SelectContent>
                {platforms.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">URL Location</Label>
            <Input id="url" required value={urlLocation} onChange={(e) => setUrlLocation(e.target.value)} placeholder="https://..." maxLength={500} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional context…" rows={3} maxLength={2000} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting || !platform}>{submitting ? "Submitting…" : "Submit"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
