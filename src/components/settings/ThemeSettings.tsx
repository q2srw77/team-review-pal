import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

export default function ThemeSettings() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [defaultTheme, setDefaultTheme] = useState<Theme>("light");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "default_theme")
      .maybeSingle()
      .then(({ data }) => {
        const val = (data as { value?: unknown } | null)?.value;
        if (val === "dark" || val === "light") setDefaultTheme(val);
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "default_theme", value: defaultTheme as unknown as never }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Default theme updated" });
    }
  };

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this section.</p>;
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Default Theme</CardTitle>
        <CardDescription>
          Sets the default theme for the Review Hub app and Login screen. Users can override this with their own
          preference, which is remembered across sessions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup
          value={defaultTheme}
          onValueChange={(v) => setDefaultTheme(v as Theme)}
          disabled={loading}
          className="grid gap-3"
        >
          <Label
            htmlFor="theme-light"
            className="flex items-center gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-accent/40"
          >
            <RadioGroupItem id="theme-light" value="light" />
            <Sun className="h-4 w-4" />
            <span>Light</span>
          </Label>
          <Label
            htmlFor="theme-dark"
            className="flex items-center gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-accent/40"
          >
            <RadioGroupItem id="theme-dark" value="dark" />
            <Moon className="h-4 w-4" />
            <span>Dark</span>
          </Label>
        </RadioGroup>
        <Button onClick={save} disabled={saving || loading}>
          {saving ? "Saving..." : "Save default theme"}
        </Button>
      </CardContent>
    </Card>
  );
}
