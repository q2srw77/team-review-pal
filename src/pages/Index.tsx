import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import SetupForm from "@/components/SetupForm";

export default function Index() {
  const { user, loading, isAdmin } = useAuth();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [page, setPage] = useState<"dashboard" | "settings">("dashboard");

  useEffect(() => {
    if (!loading && !user) {
      supabase.functions.invoke("check-setup-status").then(({ data, error }) => {
        if (error || !data) {
          setNeedsSetup(false);
        } else {
          setNeedsSetup(data.needsSetup === true);
        }
      });
    } else if (!loading && user) {
      setNeedsSetup(false);
    }
  }, [loading, user]);

  if (loading || (!user && needsSetup === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    if (needsSetup) return <SetupForm onComplete={() => setNeedsSetup(false)} />;
    return <Login />;
  }

  if (page === "settings" && isAdmin) {
    return <Settings onBack={() => setPage("dashboard")} />;
  }

  return <Dashboard onNavigateSettings={() => setPage("settings")} />;
}
