import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, TrendingUp, AlertTriangle, Shield, Target, Users, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

interface BoothReadiness {
  booth: string;
  district: string;
  workerCount: number;
  requiredWorkers: number;
  sufficiencyRatio: number;
  engagementScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  readinessScore: number;
  taskCompletionRate: number;
}

export default function ReadinessIndex() {
  const [boothData, setBoothData] = useState<BoothReadiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [overallScore, setOverallScore] = useState(0);

  useEffect(() => {
    const analyze = async () => {
      const [workersRes, tasksRes, feedbackRes] = await Promise.all([
        supabase.from("workers").select("id, full_name, district, booth_assignment, status, performance_score, tasks_completed, experience_level"),
        supabase.from("tasks").select("id, status, district, booth, assigned_worker_id, priority"),
        supabase.from("feedback").select("sentiment_score, district, booth"),
      ]);

      const workers = workersRes.data || [];
      const tasks = tasksRes.data || [];
      const feedback = feedbackRes.data || [];

      // Group by booth/district
      const boothMap = new Map<string, { district: string; workers: any[]; tasks: any[]; feedback: any[] }>();

      workers.forEach((w) => {
        const key = w.booth_assignment || w.district || "Unassigned";
        if (!boothMap.has(key)) boothMap.set(key, { district: w.district || "Unknown", workers: [], tasks: [], feedback: [] });
        boothMap.get(key)!.workers.push(w);
      });

      tasks.forEach((t) => {
        const key = t.booth || t.district || "Unassigned";
        if (!boothMap.has(key)) boothMap.set(key, { district: t.district || "Unknown", workers: [], tasks: [], feedback: [] });
        boothMap.get(key)!.tasks.push(t);
      });

      feedback.forEach((f) => {
        const key = f.booth || f.district || "Unassigned";
        if (boothMap.has(key)) boothMap.get(key)!.feedback.push(f);
      });

      const results: BoothReadiness[] = [];

      boothMap.forEach((data, booth) => {
        const activeWorkers = data.workers.filter((w) => w.status === "active").length;
        const requiredWorkers = Math.max(3, Math.ceil(data.tasks.length / 2));
        const sufficiencyRatio = requiredWorkers > 0 ? Math.min(activeWorkers / requiredWorkers, 1) : 1;

        const completedTasks = data.tasks.filter((t) => t.status === "completed").length;
        const taskCompletionRate = data.tasks.length > 0 ? completedTasks / data.tasks.length : 0;

        const avgSentiment = data.feedback.length > 0
          ? data.feedback.reduce((s, f) => s + Number(f.sentiment_score || 0), 0) / data.feedback.length
          : 0;
        const engagementScore = Math.max(0, Math.min(100, 50 + avgSentiment * 50 + taskCompletionRate * 30 + sufficiencyRatio * 20));

        const avgPerformance = data.workers.length > 0
          ? data.workers.reduce((s, w) => s + Number(w.performance_score || 0), 0) / data.workers.length
          : 0;

        const readinessScore = Math.round(
          sufficiencyRatio * 25 + taskCompletionRate * 25 + (engagementScore / 100) * 25 + Math.min(avgPerformance / 10, 1) * 25
        );

        let riskLevel: "low" | "medium" | "high" | "critical" = "low";
        if (readinessScore < 25) riskLevel = "critical";
        else if (readinessScore < 50) riskLevel = "high";
        else if (readinessScore < 75) riskLevel = "medium";

        results.push({
          booth,
          district: data.district,
          workerCount: activeWorkers,
          requiredWorkers,
          sufficiencyRatio: Math.round(sufficiencyRatio * 100),
          engagementScore: Math.round(engagementScore),
          riskLevel,
          readinessScore,
          taskCompletionRate: Math.round(taskCompletionRate * 100),
        });
      });

      results.sort((a, b) => a.readinessScore - b.readinessScore);
      setBoothData(results);
      setOverallScore(results.length ? Math.round(results.reduce((s, b) => s + b.readinessScore, 0) / results.length) : 0);
      setLoading(false);
    };
    analyze();
  }, []);

  const aiAnalyze = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-readiness", {
        body: { booths: boothData },
      });
      if (error) throw error;
      toast.success("AI Analysis Complete");
      if (data?.insights) toast.info(data.insights.slice(0, 200));
    } catch {
      toast.error("AI analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const riskColors: Record<string, string> = {
    low: "text-primary border-primary/30",
    medium: "text-warning border-warning/30",
    high: "text-destructive border-destructive/30",
    critical: "text-destructive border-destructive/50 glow-destructive",
  };

  const chartData = boothData.slice(0, 10).map((b) => ({
    name: b.booth.slice(0, 12),
    readiness: b.readinessScore,
    sufficiency: b.sufficiencyRatio,
    engagement: b.engagementScore,
  }));

  const criticalCount = boothData.filter((b) => b.riskLevel === "critical").length;
  const highCount = boothData.filter((b) => b.riskLevel === "high").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
        <span className="ml-2 text-sm font-mono text-muted-foreground">Computing readiness index...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
            READINESS <span className="text-primary">INDEX</span>
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">Predictive election readiness intelligence</p>
        </div>
        <Button onClick={aiAnalyze} disabled={analyzing} className="font-mono text-xs uppercase tracking-wider">
          {analyzing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-1" />}
          AI Analysis
        </Button>
      </div>

      {/* Overall Score */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-card border border-primary/30 rounded-lg p-4 text-center col-span-1">
          <Target className="w-6 h-6 mx-auto text-primary mb-1" />
          <p className="text-3xl font-bold font-mono text-primary">{overallScore}%</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Overall Readiness</p>
          <Progress value={overallScore} className="mt-2 h-1.5" />
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-xl font-bold font-mono text-foreground">{boothData.length}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Zones Analyzed</p>
        </div>
        <div className="bg-card border border-destructive/30 rounded-lg p-4 text-center">
          <p className="text-xl font-bold font-mono text-destructive">{criticalCount}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Critical Risk</p>
        </div>
        <div className="bg-card border border-warning/30 rounded-lg p-4 text-center">
          <p className="text-xl font-bold font-mono text-warning">{highCount}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">High Risk</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-xl font-bold font-mono text-primary">{boothData.filter((b) => b.riskLevel === "low").length}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Ready</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">Readiness by Zone</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "hsl(220 10% 50%)" }} />
              <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "hsl(220 10% 50%)" }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 15% 18%)", borderRadius: "6px", fontFamily: "JetBrains Mono", fontSize: 11, color: "hsl(180 10% 88%)" }} />
              <Bar dataKey="readiness" fill="hsl(160 100% 40%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sufficiency" fill="hsl(185 80% 45%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">Engagement Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "hsl(220 10% 50%)" }} />
              <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "hsl(220 10% 50%)" }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 15% 18%)", borderRadius: "6px", fontFamily: "JetBrains Mono", fontSize: 11, color: "hsl(180 10% 88%)" }} />
              <Line type="monotone" dataKey="engagement" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={{ fill: "hsl(38 92% 50%)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Booth list */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-border text-[10px] font-mono uppercase text-muted-foreground tracking-widest">
          <div className="col-span-2">Zone</div>
          <div className="col-span-2">District</div>
          <div className="col-span-1 text-center">Workers</div>
          <div className="col-span-2 text-center">Sufficiency</div>
          <div className="col-span-2 text-center">Engagement</div>
          <div className="col-span-1 text-center">Risk</div>
          <div className="col-span-2 text-center">Readiness</div>
        </div>
        {boothData.map((b) => (
          <div key={b.booth} className="grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-border/50 text-sm font-mono hover:bg-muted/30 animate-fade-in">
            <div className="col-span-2 text-foreground truncate">{b.booth}</div>
            <div className="col-span-2 text-muted-foreground text-xs truncate">{b.district}</div>
            <div className="col-span-1 text-center text-foreground">{b.workerCount}/{b.requiredWorkers}</div>
            <div className="col-span-2 text-center">
              <Progress value={b.sufficiencyRatio} className="h-1.5" />
              <span className="text-[10px] text-muted-foreground">{b.sufficiencyRatio}%</span>
            </div>
            <div className="col-span-2 text-center">
              <Progress value={b.engagementScore} className="h-1.5" />
              <span className="text-[10px] text-muted-foreground">{b.engagementScore}%</span>
            </div>
            <div className="col-span-1 text-center">
              <Badge variant="outline" className={`text-[10px] font-mono ${riskColors[b.riskLevel]}`}>{b.riskLevel}</Badge>
            </div>
            <div className="col-span-2 text-center">
              <span className={`font-bold ${b.readinessScore >= 75 ? "text-primary" : b.readinessScore >= 50 ? "text-warning" : "text-destructive"}`}>
                {b.readinessScore}%
              </span>
            </div>
          </div>
        ))}
        {boothData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground font-mono text-sm">No data available. Add workers and tasks first.</div>
        )}
      </div>
    </div>
  );
}
