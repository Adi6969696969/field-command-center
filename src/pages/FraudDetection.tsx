import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, Clock, Copy, Zap, Eye } from "lucide-react";

interface AnomalyAlert {
  id: string;
  type: "speed" | "duplicate" | "attendance" | "location";
  severity: "low" | "medium" | "high" | "critical";
  worker_name: string;
  worker_id: string;
  description: string;
  detected_at: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-warning/10 text-warning border-warning/30",
  high: "bg-destructive/10 text-destructive border-destructive/30",
  critical: "bg-destructive/20 text-destructive border-destructive/50 glow-destructive",
};

const TYPE_ICONS: Record<string, any> = {
  speed: Zap,
  duplicate: Copy,
  attendance: Clock,
  location: Eye,
};

export default function FraudDetection() {
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const detectAnomalies = async () => {
      // Fetch workers and tasks for anomaly analysis
      const [workersRes, tasksRes, feedbackRes] = await Promise.all([
        supabase.from("workers").select("id, full_name, tasks_completed, performance_score, status, created_at"),
        supabase.from("tasks").select("id, title, status, assigned_worker_id, created_at, completed_at"),
        supabase.from("feedback").select("id, content, submitted_by, created_at"),
      ]);

      const workers = workersRes.data || [];
      const tasks = tasksRes.data || [];
      const feedbacks = feedbackRes.data || [];
      const detected: AnomalyAlert[] = [];

      // 1. Abnormal task completion speed (completed < 5 min after creation)
      tasks.forEach((t) => {
        if (t.completed_at && t.created_at) {
          const diff = (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / 60000;
          if (diff < 5 && diff >= 0) {
            const worker = workers.find((w) => w.id === t.assigned_worker_id);
            detected.push({
              id: `speed-${t.id}`,
              type: "speed",
              severity: diff < 1 ? "critical" : "high",
              worker_name: worker?.full_name || "Unknown",
              worker_id: t.assigned_worker_id || "",
              description: `Task "${t.title}" completed in ${diff.toFixed(1)} min — abnormally fast.`,
              detected_at: t.completed_at,
            });
          }
        }
      });

      // 2. Duplicate feedback content detection
      const contentMap = new Map<string, { count: number; by: string; ids: string[] }>();
      feedbacks.forEach((f) => {
        const key = f.content.toLowerCase().trim().slice(0, 100);
        const existing = contentMap.get(key);
        if (existing) {
          existing.count++;
          existing.ids.push(f.id);
        } else {
          contentMap.set(key, { count: 1, by: f.submitted_by, ids: [f.id] });
        }
      });
      contentMap.forEach((val, key) => {
        if (val.count > 1) {
          detected.push({
            id: `dup-${val.ids[0]}`,
            type: "duplicate",
            severity: val.count > 3 ? "critical" : "medium",
            worker_name: "Multiple",
            worker_id: "",
            description: `${val.count} duplicate feedback entries detected: "${key.slice(0, 60)}..."`,
            detected_at: new Date().toISOString(),
          });
        }
      });

      // 3. Suspicious worker patterns (0 tasks completed but high score)
      workers.forEach((w) => {
        if ((w.tasks_completed || 0) === 0 && Number(w.performance_score) > 5) {
          detected.push({
            id: `perf-${w.id}`,
            type: "attendance",
            severity: "medium",
            worker_name: w.full_name,
            worker_id: w.id,
            description: `Performance score ${Number(w.performance_score).toFixed(1)} with 0 tasks completed — possible data manipulation.`,
            detected_at: w.created_at,
          });
        }
      });

      // 4. Inactive workers with recent tasks
      workers.forEach((w) => {
        if (w.status === "inactive" || w.status === "suspended") {
          const assignedTasks = tasks.filter((t) => t.assigned_worker_id === w.id && t.status !== "cancelled");
          if (assignedTasks.length > 0) {
            detected.push({
              id: `ghost-${w.id}`,
              type: "attendance",
              severity: "high",
              worker_name: w.full_name,
              worker_id: w.id,
              description: `${w.status} worker has ${assignedTasks.length} active task(s) — ghost assignment detected.`,
              detected_at: new Date().toISOString(),
            });
          }
        }
      });

      // Sort by severity
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      detected.sort((a, b) => order[a.severity] - order[b.severity]);
      setAlerts(detected);
      setLoading(false);
    };
    detectAnomalies();
  }, []);

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const highCount = alerts.filter((a) => a.severity === "high").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
          FRAUD <span className="text-destructive">DETECTION</span>
        </h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">
          Anomaly & integrity monitoring system
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Total Alerts</p>
          <p className="text-xl font-bold font-mono text-foreground">{alerts.length}</p>
        </div>
        <div className="bg-card border border-destructive/30 rounded-lg p-3">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Critical</p>
          <p className="text-xl font-bold font-mono text-destructive">{criticalCount}</p>
        </div>
        <div className="bg-card border border-warning/30 rounded-lg p-3">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">High</p>
          <p className="text-xl font-bold font-mono text-warning">{highCount}</p>
        </div>
        <div className="bg-card border border-primary/30 rounded-lg p-3">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">System</p>
          <p className="text-xl font-bold font-mono text-primary flex items-center gap-1">
            <Shield className="w-4 h-4" /> {alerts.length === 0 ? "CLEAR" : "ALERT"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-2 h-2 rounded-full bg-destructive animate-pulse-glow" />
          <span className="ml-2 text-sm font-mono text-muted-foreground">Scanning for anomalies...</span>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-16">
          <Shield className="w-12 h-12 mx-auto text-primary mb-3" />
          <p className="text-sm font-mono text-muted-foreground">No anomalies detected. System integrity verified.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {alerts.map((a) => {
            const Icon = TYPE_ICONS[a.type] || AlertTriangle;
            return (
              <div key={a.id} className={`bg-card border rounded-lg p-4 animate-fade-in ${SEVERITY_STYLES[a.severity]}`}>
                <div className="flex items-start gap-3">
                  <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono font-semibold text-sm text-foreground">{a.worker_name}</p>
                      <Badge variant="outline" className={`text-[10px] font-mono ${SEVERITY_STYLES[a.severity]}`}>
                        {a.severity}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {a.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-1">{a.description}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">
                      Detected: {new Date(a.detected_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
