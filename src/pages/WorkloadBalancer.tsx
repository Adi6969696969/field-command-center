import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Scale, RefreshCw, AlertTriangle, CheckCircle, ArrowUpDown } from "lucide-react";

interface WorkerLoad {
  id: string;
  name: string;
  district: string | null;
  activeTasks: number;
  totalTasks: number;
  maxCapacity: number;
  loadPercent: number;
  status: "underloaded" | "optimal" | "overloaded" | "critical";
  recommendation: string;
}

export default function WorkloadBalancer() {
  const [workerLoads, setWorkerLoads] = useState<WorkerLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebalancing, setRebalancing] = useState(false);

  useEffect(() => { analyze(); }, []);

  const analyze = async () => {
    setLoading(true);
    const [wRes, tRes] = await Promise.all([
      supabase.from("workers").select("id, full_name, district, experience_level, status").eq("status", "active"),
      supabase.from("tasks").select("id, assigned_worker_id, status, priority"),
    ]);

    const workers = wRes.data || [];
    const tasks = tRes.data || [];
    const results: WorkerLoad[] = [];

    workers.forEach((w) => {
      const workerTasks = tasks.filter((t) => t.assigned_worker_id === w.id);
      const activeTasks = workerTasks.filter((t) => t.status === "assigned" || t.status === "in_progress").length;
      const maxCapacity = Math.max(3, (w.experience_level || 1) + 2);
      const loadPercent = Math.round((activeTasks / maxCapacity) * 100);

      let status: WorkerLoad["status"] = "optimal";
      let recommendation = "Load balanced";
      if (loadPercent > 100) { status = "critical"; recommendation = "REDISTRIBUTE: Exceeds capacity"; }
      else if (loadPercent > 75) { status = "overloaded"; recommendation = "Reduce assignments, approaching burnout"; }
      else if (loadPercent < 25 && activeTasks === 0) { status = "underloaded"; recommendation = "Available for new assignments"; }

      results.push({
        id: w.id,
        name: w.full_name,
        district: w.district,
        activeTasks,
        totalTasks: workerTasks.length,
        maxCapacity,
        loadPercent: Math.min(loadPercent, 150),
        status,
        recommendation,
      });
    });

    results.sort((a, b) => b.loadPercent - a.loadPercent);
    setWorkerLoads(results);
    setLoading(false);
  };

  const autoRebalance = async () => {
    setRebalancing(true);
    const overloaded = workerLoads.filter((w) => w.status === "critical" || w.status === "overloaded");
    const underloaded = workerLoads.filter((w) => w.status === "underloaded");

    if (overloaded.length === 0) {
      toast.info("No overloaded workers to rebalance");
      setRebalancing(false);
      return;
    }
    if (underloaded.length === 0) {
      toast.error("No available workers for redistribution");
      setRebalancing(false);
      return;
    }

    let redistributed = 0;
    for (const worker of overloaded) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id")
        .eq("assigned_worker_id", worker.id)
        .in("status", ["assigned", "pending"])
        .limit(worker.activeTasks - worker.maxCapacity + 1);

      for (const task of (tasks || [])) {
        const target = underloaded.find((u) => u.activeTasks < u.maxCapacity);
        if (target) {
          await supabase.from("tasks").update({ assigned_worker_id: target.id }).eq("id", task.id);
          target.activeTasks++;
          redistributed++;
        }
      }
    }

    toast.success(`Redistributed ${redistributed} task(s)`);
    await analyze();
    setRebalancing(false);
  };

  const overloadedCount = workerLoads.filter((w) => w.status === "overloaded" || w.status === "critical").length;
  const avgLoad = workerLoads.length ? Math.round(workerLoads.reduce((s, w) => s + w.loadPercent, 0) / workerLoads.length) : 0;

  const statusStyles: Record<string, string> = {
    underloaded: "text-accent border-accent/30",
    optimal: "text-primary border-primary/30",
    overloaded: "text-warning border-warning/30",
    critical: "text-destructive border-destructive/30",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
        <span className="ml-2 text-sm font-mono text-muted-foreground">Analyzing workloads...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
            WORKLOAD <span className="text-primary">BALANCER</span>
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">Task distribution & capacity management</p>
        </div>
        <Button onClick={autoRebalance} disabled={rebalancing} className="font-mono text-xs uppercase tracking-wider">
          {rebalancing ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Scale className="w-4 h-4 mr-1" />}
          Auto-Rebalance
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-xl font-bold font-mono text-foreground">{workerLoads.length}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Workers</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-xl font-bold font-mono text-foreground">{avgLoad}%</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Avg Load</p>
        </div>
        <div className="bg-card border border-destructive/30 rounded-lg p-3 text-center">
          <p className="text-xl font-bold font-mono text-destructive">{overloadedCount}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Overloaded</p>
        </div>
        <div className="bg-card border border-primary/30 rounded-lg p-3 text-center">
          <p className="text-xl font-bold font-mono text-primary">{workerLoads.filter((w) => w.status === "optimal").length}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Balanced</p>
        </div>
      </div>

      <div className="grid gap-3">
        {workerLoads.map((w) => (
          <div key={w.id} className={`bg-card border rounded-lg p-4 animate-fade-in ${w.status === "critical" ? "border-destructive/30" : w.status === "overloaded" ? "border-warning/30" : "border-border"}`}>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-mono font-semibold text-sm text-foreground">{w.name}</p>
                  <Badge variant="outline" className={`text-[10px] font-mono ${statusStyles[w.status]}`}>{w.status}</Badge>
                  {w.district && <span className="text-[10px] font-mono text-muted-foreground">{w.district}</span>}
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1">
                    <span>{w.activeTasks}/{w.maxCapacity} active tasks</span>
                    <span className={w.loadPercent > 100 ? "text-destructive" : w.loadPercent > 75 ? "text-warning" : "text-primary"}>{w.loadPercent}%</span>
                  </div>
                  <Progress value={Math.min(w.loadPercent, 100)} className="h-2" />
                </div>
                <p className="text-[10px] font-mono text-muted-foreground mt-1 flex items-center gap-1">
                  {w.status === "critical" ? <AlertTriangle className="w-3 h-3 text-destructive" /> : <CheckCircle className="w-3 h-3 text-primary" />}
                  {w.recommendation}
                </p>
              </div>
            </div>
          </div>
        ))}
        {workerLoads.length === 0 && (
          <div className="text-center py-8 text-muted-foreground font-mono text-sm">No active workers to analyze.</div>
        )}
      </div>
    </div>
  );
}
