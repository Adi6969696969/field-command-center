import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Brain, TrendingDown, Heart, Flame, UserCheck } from "lucide-react";

interface WorkerRisk {
  id: string;
  name: string;
  district: string | null;
  burnoutProbability: number;
  dropOffRisk: number;
  consistencyScore: number;
  workload: number;
  performanceTrend: "rising" | "stable" | "declining";
  recommendation: string;
}

export default function BurnoutDetection() {
  const [risks, setRisks] = useState<WorkerRisk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const analyze = async () => {
      const [workersRes, tasksRes] = await Promise.all([
        supabase.from("workers").select("*").eq("status", "active"),
        supabase.from("tasks").select("id, assigned_worker_id, status, priority, created_at"),
      ]);

      const workers = workersRes.data || [];
      const tasks = tasksRes.data || [];
      const results: WorkerRisk[] = [];

      workers.forEach((w) => {
        const workerTasks = tasks.filter((t) => t.assigned_worker_id === w.id);
        const activeTasks = workerTasks.filter((t) => t.status === "in_progress" || t.status === "assigned").length;
        const criticalTasks = workerTasks.filter((t) => t.priority === "critical" || t.priority === "high").length;
        const completedTasks = workerTasks.filter((t) => t.status === "completed").length;
        const totalTasks = workerTasks.length;

        // Burnout probability: high workload + high critical tasks + many tasks
        const workloadFactor = Math.min(activeTasks / 5, 1);
        const criticalFactor = Math.min(criticalTasks / 3, 1);
        const volumeFactor = Math.min(totalTasks / 20, 1);
        const burnoutProbability = Math.round((workloadFactor * 40 + criticalFactor * 35 + volumeFactor * 25));

        // Drop-off risk: low performance + low completion rate
        const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0.5;
        const performanceNorm = Math.min(Number(w.performance_score) / 10, 1);
        const dropOffRisk = Math.round((1 - completionRate) * 50 + (1 - performanceNorm) * 50);

        // Consistency score
        const consistencyScore = Math.round(completionRate * 60 + performanceNorm * 40);

        // Performance trend
        let performanceTrend: "rising" | "stable" | "declining" = "stable";
        if (Number(w.performance_score) > 7) performanceTrend = "rising";
        else if (Number(w.performance_score) < 3) performanceTrend = "declining";

        // Recommendation
        let recommendation = "Performing normally";
        if (burnoutProbability > 70) recommendation = "CRITICAL: Immediate workload reduction needed";
        else if (burnoutProbability > 50) recommendation = "Reduce task assignments, consider brief rotation";
        else if (dropOffRisk > 60) recommendation = "Engagement intervention recommended";
        else if (consistencyScore > 80) recommendation = "Promote: Eligible for leadership role";

        results.push({
          id: w.id,
          name: w.full_name,
          district: w.district,
          burnoutProbability,
          dropOffRisk,
          consistencyScore,
          workload: activeTasks,
          performanceTrend,
          recommendation,
        });
      });

      results.sort((a, b) => b.burnoutProbability - a.burnoutProbability);
      setRisks(results);
      setLoading(false);
    };
    analyze();
  }, []);

  const highRiskCount = risks.filter((r) => r.burnoutProbability > 60).length;
  const avgBurnout = risks.length ? Math.round(risks.reduce((s, r) => s + r.burnoutProbability, 0) / risks.length) : 0;
  const promotionEligible = risks.filter((r) => r.consistencyScore > 80 && r.burnoutProbability < 30).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-2 h-2 rounded-full bg-warning animate-pulse-glow" />
        <span className="ml-2 text-sm font-mono text-muted-foreground">Analyzing behavioral patterns...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
          BURNOUT <span className="text-warning">DETECTION</span>
        </h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">Behavioral risk & wellness monitoring</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Flame className="w-5 h-5 mx-auto text-destructive mb-1" />
          <p className="text-xl font-bold font-mono text-destructive">{highRiskCount}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">High Burnout Risk</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Heart className="w-5 h-5 mx-auto text-warning mb-1" />
          <p className="text-xl font-bold font-mono text-foreground">{avgBurnout}%</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Avg Burnout Index</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <UserCheck className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-xl font-bold font-mono text-primary">{promotionEligible}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Promotion Ready</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Brain className="w-5 h-5 mx-auto text-accent mb-1" />
          <p className="text-xl font-bold font-mono text-foreground">{risks.length}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Workers Analyzed</p>
        </div>
      </div>

      <div className="grid gap-3">
        {risks.map((r) => (
          <div key={r.id} className={`bg-card border rounded-lg p-4 animate-fade-in ${r.burnoutProbability > 60 ? "border-destructive/30" : r.burnoutProbability > 40 ? "border-warning/30" : "border-border"}`}>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-mono font-semibold text-sm text-foreground">{r.name}</p>
                  <Badge variant="outline" className={`text-[10px] font-mono ${r.performanceTrend === "rising" ? "text-primary border-primary/30" : r.performanceTrend === "declining" ? "text-destructive border-destructive/30" : "text-muted-foreground"}`}>
                    {r.performanceTrend}
                  </Badge>
                  {r.district && <span className="text-[10px] font-mono text-muted-foreground">{r.district}</span>}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <div>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Burnout Risk</p>
                    <Progress value={r.burnoutProbability} className="mt-1 h-1.5" />
                    <p className={`text-xs font-mono font-bold mt-0.5 ${r.burnoutProbability > 60 ? "text-destructive" : r.burnoutProbability > 40 ? "text-warning" : "text-primary"}`}>{r.burnoutProbability}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Drop-off Risk</p>
                    <Progress value={r.dropOffRisk} className="mt-1 h-1.5" />
                    <p className="text-xs font-mono font-bold mt-0.5 text-foreground">{r.dropOffRisk}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Consistency</p>
                    <Progress value={r.consistencyScore} className="mt-1 h-1.5" />
                    <p className="text-xs font-mono font-bold mt-0.5 text-accent">{r.consistencyScore}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Active Tasks</p>
                    <p className="text-lg font-mono font-bold text-foreground">{r.workload}</p>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1.5">
                  {r.burnoutProbability > 60 ? <AlertTriangle className="w-3 h-3 text-destructive" /> : <Brain className="w-3 h-3 text-accent" />}
                  <p className="text-[10px] font-mono text-muted-foreground">{r.recommendation}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
        {risks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground font-mono text-sm">No active workers to analyze.</div>
        )}
      </div>
    </div>
  );
}
