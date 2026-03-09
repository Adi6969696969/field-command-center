import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Radio, AlertTriangle, Shield, Siren, Send, Volume2, ShieldOff } from "lucide-react";

interface Broadcast {
  id: string;
  title: string;
  message: string;
  severity: string;
  is_active: boolean;
  created_at: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  info: "border-accent/30 bg-accent/5",
  warning: "border-warning/30 bg-warning/5",
  critical: "border-destructive/30 bg-destructive/5 glow-destructive",
  emergency: "border-destructive/50 bg-destructive/10 glow-destructive animate-pulse",
};

export default function WarMode() {
  const { user } = useAuth();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [crisisMode, setCrisisMode] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("info");
  const [stats, setStats] = useState({ activeWorkers: 0, pendingTasks: 0, criticalAlerts: 0 });

  const fetchBroadcasts = async () => {
    const { data } = await supabase.from("broadcasts").select("*").order("created_at", { ascending: false }).limit(50);
    setBroadcasts(data || []);
    setCrisisMode(data?.some((b) => b.severity === "emergency" && b.is_active) || false);
  };

  const fetchStats = async () => {
    const [wRes, tRes] = await Promise.all([
      supabase.from("workers").select("status").eq("status", "active"),
      supabase.from("tasks").select("status, priority"),
    ]);
    setStats({
      activeWorkers: wRes.data?.length || 0,
      pendingTasks: tRes.data?.filter((t) => t.status === "pending" || t.status === "assigned").length || 0,
      criticalAlerts: tRes.data?.filter((t) => t.priority === "critical" && t.status !== "completed").length || 0,
    });
  };

  useEffect(() => {
    fetchBroadcasts();
    fetchStats();

    const channel = supabase
      .channel("war-broadcasts")
      .on("postgres_changes", { event: "*", schema: "public", table: "broadcasts" }, () => fetchBroadcasts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const sendBroadcast = async () => {
    if (!user || !title.trim() || !message.trim()) return;
    const { error } = await supabase.from("broadcasts").insert({
      title: title.trim(),
      message: message.trim(),
      severity,
      created_by: user.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Broadcast sent!");
      setTitle("");
      setMessage("");
      fetchBroadcasts();
    }
  };

  const activateCrisis = async () => {
    if (!user) return;
    const { error } = await supabase.from("broadcasts").insert({
      title: "🚨 CRISIS MODE ACTIVATED",
      message: "Emergency mobilization initiated. All operatives report to command center immediately.",
      severity: "emergency",
      created_by: user.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("CRISIS MODE ACTIVATED");
      fetchBroadcasts();
    }
  };

  const deactivateCrisis = async () => {
    if (!user) return;
    // Deactivate all active emergency broadcasts
    const emergencyBroadcasts = broadcasts.filter((b) => b.severity === "emergency" && b.is_active);
    const updates = emergencyBroadcasts.map((b) =>
      supabase.from("broadcasts").update({ is_active: false }).eq("id", b.id)
    );
    await Promise.all(updates);

    // Send a stand-down broadcast
    await supabase.from("broadcasts").insert({
      title: "✅ CRISIS MODE DEACTIVATED",
      message: "Emergency stand-down. Crisis mode has been cleared. Resume normal operations.",
      severity: "info",
      created_by: user.id,
    });

    toast.success("Crisis mode deactivated. All clear.");
    fetchBroadcasts();
  };

  const deactivateBroadcast = async (id: string) => {
    await supabase.from("broadcasts").update({ is_active: false }).eq("id", id);
    fetchBroadcasts();
  };

  return (
    <div className={`space-y-6 ${crisisMode ? "animate-pulse-slow" : ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
            WAR <span className={crisisMode ? "text-destructive" : "text-primary"}>MODE</span>
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">Real-time command & broadcast center</p>
        </div>
        <div className="flex gap-2">
          {crisisMode ? (
            <Button onClick={deactivateCrisis} variant="outline" className="font-mono text-xs uppercase tracking-wider border-primary text-primary hover:bg-primary/10">
              <ShieldOff className="w-4 h-4 mr-1" /> Stop Crisis
            </Button>
          ) : (
            <Button onClick={activateCrisis} variant="destructive" className="font-mono text-xs uppercase tracking-wider">
              <Siren className="w-4 h-4 mr-1" /> Crisis Mode
            </Button>
          )}
        </div>
      </div>

      {/* Crisis active banner */}
      {crisisMode && (
        <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Siren className="w-5 h-5 text-destructive animate-pulse" />
            <p className="font-mono text-sm font-bold text-destructive">CRISIS MODE ACTIVE — Emergency protocols engaged</p>
          </div>
          <Button onClick={deactivateCrisis} size="sm" variant="outline" className="font-mono text-[10px] border-destructive/30 text-destructive hover:bg-destructive/10">
            Stand Down
          </Button>
        </div>
      )}

      {/* Live stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-primary/30 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold font-mono text-primary">{stats.activeWorkers}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Operatives Online</p>
        </div>
        <div className="bg-card border border-warning/30 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold font-mono text-warning">{stats.pendingTasks}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Pending Ops</p>
        </div>
        <div className="bg-card border border-destructive/30 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold font-mono text-destructive">{stats.criticalAlerts}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Critical Alerts</p>
        </div>
      </div>

      {/* Broadcast form */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Radio className="w-4 h-4 text-accent" /> Send Broadcast
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Broadcast title" className="bg-muted border-border font-mono text-sm" />
          <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message content" className="bg-muted border-border font-mono text-sm sm:col-span-2" />
          <div className="flex gap-2">
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="bg-muted border-border font-mono text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={sendBroadcast} disabled={!title.trim() || !message.trim()} size="icon"><Send className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      {/* Broadcast feed */}
      <div className="grid gap-3">
        {broadcasts.map((b) => (
          <div key={b.id} className={`border rounded-lg p-4 animate-fade-in ${SEVERITY_STYLES[b.severity] || "border-border"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {b.severity === "emergency" ? <Siren className="w-5 h-5 text-destructive mt-0.5" /> :
                 b.severity === "critical" ? <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" /> :
                 b.severity === "warning" ? <AlertTriangle className="w-5 h-5 text-warning mt-0.5" /> :
                 <Volume2 className="w-5 h-5 text-accent mt-0.5" />}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-bold text-sm text-foreground">{b.title}</p>
                    <Badge variant="outline" className="text-[10px] font-mono">{b.severity}</Badge>
                    {b.is_active && <Badge className="text-[10px] font-mono bg-primary/20 text-primary">LIVE</Badge>}
                  </div>
                  <p className="text-xs font-mono text-muted-foreground mt-1">{b.message}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">{new Date(b.created_at).toLocaleString()}</p>
                </div>
              </div>
              {b.is_active && (
                <Button variant="ghost" size="sm" onClick={() => deactivateBroadcast(b.id)} className="font-mono text-[10px]">
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        ))}
        {broadcasts.length === 0 && (
          <div className="text-center py-8 text-muted-foreground font-mono text-sm">
            <Shield className="w-8 h-8 mx-auto mb-2 text-primary" />
            No broadcasts. System nominal.
          </div>
        )}
      </div>
    </div>
  );
}
