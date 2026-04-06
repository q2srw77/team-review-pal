import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardCheck, Users, Layers, UsersRound } from "lucide-react";
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

type Section = "users" | "platforms" | "teams";

const NAV_ITEMS: { title: string; section: Section; icon: React.ElementType }[] = [
  { title: "Users", section: "users", icon: Users },
  { title: "Teams", section: "teams", icon: UsersRound },
  { title: "Platforms", section: "platforms", icon: Layers },
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
          <header className="sticky top-0 z-30 bg-card border-b border-border">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
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

          <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full">
            {active === "users" && <UserManagement />}
            {active === "teams" && <TeamManagement />}
            {active === "platforms" && <PlatformManagement />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
