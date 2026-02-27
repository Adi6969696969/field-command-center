import { Shield, LayoutDashboard, Users, ClipboardList, LogOut, Map, Brain, Trophy, MessageSquare, ShieldAlert, Bot, Target, Heart, Radio, FlaskConical, Lock, Layers, FileText, DollarSign, Scale } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

const commandItems = [
  { title: "War Room", url: "/dashboard", icon: LayoutDashboard },
  { title: "War Mode", url: "/war-mode", icon: Radio },
  { title: "AI Co-Pilot", url: "/ai-copilot", icon: Bot },
];

const operationsItems = [
  { title: "Workers", url: "/workers", icon: Users },
  { title: "Tasks", url: "/tasks", icon: ClipboardList },
  { title: "Smart Assign", url: "/smart-assign", icon: Brain },
  { title: "Workload", url: "/workload", icon: Scale },
];

const intelligenceItems = [
  { title: "Readiness", url: "/readiness", icon: Target },
  { title: "Geo Intel", url: "/geo-intel", icon: Map },
  { title: "Hierarchy", url: "/hierarchy", icon: Layers },
  { title: "Intel Brief", url: "/intel-brief", icon: FileText },
  { title: "Digital Twin", url: "/digital-twin", icon: FlaskConical },
];

const monitoringItems = [
  { title: "Leaderboard", url: "/leaderboard", icon: Trophy },
  { title: "Feedback", url: "/feedback", icon: MessageSquare },
  { title: "Burnout", url: "/burnout", icon: Heart },
  { title: "Fraud", url: "/fraud-detection", icon: ShieldAlert },
  { title: "Resources", url: "/resources", icon: DollarSign },
  { title: "Blockchain", url: "/blockchain", icon: Lock },
];

const navGroups = [
  { label: "Command", items: commandItems },
  { label: "Operations", items: operationsItems },
  { label: "Intelligence", items: intelligenceItems },
  { label: "Monitoring", items: monitoringItems },
];

export function AppSidebar() {
  const { signOut, user, role } = useAuth();

  return (
    <Sidebar className="border-r border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-mono font-bold text-sm tracking-wider text-foreground">
              FIELD<span className="text-primary">OPS</span>
            </h2>
            <p className="text-[10px] font-mono text-muted-foreground uppercase">
              {role?.replace("_", " ") || "operative"}
            </p>
          </div>
        </div>
      </div>
      <SidebarContent>
        <ScrollArea className="flex-1">
          {navGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end
                          className="font-mono text-xs tracking-wide hover:bg-muted/50"
                          activeClassName="bg-primary/10 text-primary border-l-2 border-primary"
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className="border-t border-border p-3">
        <div className="text-[10px] font-mono text-muted-foreground truncate mb-2">
          {user?.email}
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-destructive transition-colors w-full"
        >
          <LogOut className="w-3 h-3" />
          SIGN OUT
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
