import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import SetupForm from "@/components/SetupForm";

export default function Index() {
  const { user, loading } = useAuth();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

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

  if (user) return <Dashboard />;
  if (needsSetup) return <SetupForm onComplete={() => setNeedsSetup(false)} />;
  return <Login />;
}
