import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, TrendingUp, BarChart3 } from "lucide-react";

interface DistrictMetrics {
  district: string;
  workers: number;
  activeWorkers: number;
  tasks: number;
  completedTasks: number;
  avgPerformance: number;
  feedbackCount: number;
  avgSentiment: number;
}

const PIE_COLORS = ["hsl(160 100% 40%)", "hsl(185 80% 45%)", "hsl(38 92% 50%)", "hsl(0 72% 51%)", "hsl(280 60% 50%)", "hsl(220 60% 50%)"];

export default function HierarchyAnalytics() {
  const [districts, setDistricts] = useState<DistrictMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");

  useEffect(() => {
    const load = async () => {
      const [wRes, tRes, fRes] = await Promise.all([
        supabase.from("workers").select("district, status, performance_score, tasks_completed"),
        supabase.from("tasks").select("district, status"),
        supabase.from("feedback").select("district, sentiment_score"),
      ]);

      const workers = wRes.data || [];
      const tasks = tRes.data || [];
      const feedbacks = fRes.data || [];

      const districtMap = new Map<string, DistrictMetrics>();

      workers.forEach((w) => {
        const d = w.district || "Unassigned";
        if (!districtMap.has(d)) districtMap.set(d, { district: d, workers: 0, activeWorkers: 0, tasks: 0, completedTasks: 0, avgPerformance: 0, feedbackCount: 0, avgSentiment: 0 });
        const m = districtMap.get(d)!;
        m.workers++;
        if (w.status === "active") m.activeWorkers++;
        m.avgPerformance += Number(w.performance_score || 0);
      });

      tasks.forEach((t) => {
        const d = t.district || "Unassigned";
        if (!districtMap.has(d)) districtMap.set(d, { district: d, workers: 0, activeWorkers: 0, tasks: 0, completedTasks: 0, avgPerformance: 0, feedbackCount: 0, avgSentiment: 0 });
        districtMap.get(d)!.tasks++;
        if (t.status === "completed") districtMap.get(d)!.completedTasks++;
      });

      feedbacks.forEach((f) => {
        const d = f.district || "Unassigned";
        if (districtMap.has(d)) {
          districtMap.get(d)!.feedbackCount++;
          districtMap.get(d)!.avgSentiment += Number(f.sentiment_score || 0);
        }
      });

      districtMap.forEach((m) => {
        if (m.workers > 0) m.avgPerformance = Math.round((m.avgPerformance / m.workers) * 10) / 10;
        if (m.feedbackCount > 0) m.avgSentiment = Math.round((m.avgSentiment / m.feedbackCount) * 100) / 100;
      });

      setDistricts(Array.from(districtMap.values()).sort((a, b) => b.workers - a.workers));
      setLoading(false);
    };
    load();
  }, []);

  const filtered = selectedDistrict === "all" ? districts : districts.filter((d) => d.district === selectedDistrict);

  const comparisonData = filtered.map((d) => ({
    name: d.district.slice(0, 10),
    workers: d.workers,
    tasks: d.tasks,
    completed: d.completedTasks,
    performance: d.avgPerformance,
  }));

  const workerDistribution = filtered.map((d) => ({
    name: d.district,
    value: d.workers,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
        <span className="ml-2 text-sm font-mono text-muted-foreground">Aggregating hierarchy data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
            HIERARCHY <span className="text-accent">ANALYTICS</span>
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">Multi-level performance intelligence</p>
        </div>
        <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
          <SelectTrigger className="w-40 bg-muted border-border font-mono text-xs">
            <SelectValue placeholder="All Districts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Districts</SelectItem>
            {districts.map((d) => <SelectItem key={d.district} value={d.district}>{d.district}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">District Comparison</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "hsl(220 10% 50%)" }} />
              <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "hsl(220 10% 50%)" }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 15% 18%)", borderRadius: "6px", fontFamily: "JetBrains Mono", fontSize: 11, color: "hsl(180 10% 88%)" }} />
              <Bar dataKey="workers" fill="hsl(160 100% 40%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" fill="hsl(185 80% 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="tasks" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">Worker Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={workerDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                {workerDistribution.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 15% 18%)", borderRadius: "6px", fontFamily: "JetBrains Mono", fontSize: 11, color: "hsl(180 10% 88%)" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detail table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-8 gap-2 px-4 py-2 border-b border-border text-[10px] font-mono uppercase text-muted-foreground tracking-widest">
          <div className="col-span-2">District</div>
          <div className="text-center">Workers</div>
          <div className="text-center">Active</div>
          <div className="text-center">Tasks</div>
          <div className="text-center">Done</div>
          <div className="text-center">Perf</div>
          <div className="text-center">Sentiment</div>
        </div>
        {filtered.map((d) => (
          <div key={d.district} className="grid grid-cols-8 gap-2 px-4 py-3 items-center border-b border-border/50 text-sm font-mono hover:bg-muted/30 animate-fade-in">
            <div className="col-span-2 text-foreground truncate">{d.district}</div>
            <div className="text-center text-foreground">{d.workers}</div>
            <div className="text-center text-primary">{d.activeWorkers}</div>
            <div className="text-center text-foreground">{d.tasks}</div>
            <div className="text-center text-accent">{d.completedTasks}</div>
            <div className="text-center text-warning">{d.avgPerformance}</div>
            <div className="text-center">
              <span className={d.avgSentiment > 0 ? "text-primary" : d.avgSentiment < 0 ? "text-destructive" : "text-muted-foreground"}>
                {d.avgSentiment.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
