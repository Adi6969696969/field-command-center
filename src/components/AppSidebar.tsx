import { Shield, LayoutDashboard, Users, ClipboardList, LogOut } from "lucide-react";
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

const navItems = [
  { title: "War Room", url: "/dashboard", icon: LayoutDashboard },
  { title: "Workers", url: "/workers", icon: Users },
  { title: "Tasks", url: "/tasks", icon: ClipboardList },
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
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Command
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
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
