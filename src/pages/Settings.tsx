import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardCheck, Users, Layers, UsersRound, FileText, Mail, Palette } from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import UserManagement from "@/components/settings/UserManagement";
import PlatformManagement from "@/components/settings/PlatformManagement";
import TeamManagement from "@/components/settings/TeamManagement";
import AuditLogs from "@/components/settings/AuditLogs";
import EmailLogs from "@/components/settings/EmailLogs";
import ThemeSettings from "@/components/settings/ThemeSettings";

type Section = "users" | "platforms" | "teams" | "theme" | "audit-logs" | "email-logs";

const NAV_ITEMS: { title: string; section: Section; icon: React.ElementType }[] = [
  { title: "Users", section: "users", icon: Users },
  { title: "Teams", section: "teams", icon: UsersRound },
  { title: "Platforms", section: "platforms", icon: Layers },
  { title: "Theme", section: "theme", icon: Palette },
  { title: "Audit Logs", section: "audit-logs", icon: FileText },
  { title: "Email Logs", section: "email-logs", icon: Mail },
];

export default function Settings({ onBack }: { onBack: () => void }) {
  const [active, setActive] = useState<Section>("users");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Settings</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.section}>
                      <SidebarMenuButton
                        isActive={active === item.section}
                        onClick={() => setActive(item.section)}
                        tooltip={item.title}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 bg-card/80 backdrop-blur border-b border-border shadow-sm">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 h-14 sm:h-16 flex items-center gap-3">
              <SidebarTrigger className="-ml-1" />
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">Settings</h1>
            </div>
          </header>

          <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6 lg:py-8 w-full">
            {active === "users" && <UserManagement />}
            {active === "teams" && <TeamManagement />}
            {active === "platforms" && <PlatformManagement />}
            {active === "theme" && <ThemeSettings />}
            {active === "audit-logs" && <AuditLogs />}
            {active === "email-logs" && <EmailLogs />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
