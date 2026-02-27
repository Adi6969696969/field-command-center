import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, Users, Target, TrendingUp, BarChart3 } from "lucide-react";

interface DistrictCost {
  district: string;
  workers: number;
  tasks: number;
  completed: number;
  costPerEngagement: number;
  efficiency: number;
  roi: number;
}

export default function ResourceOptimization() {
  const [districts, setDistricts] = useState<DistrictCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ workers: 0, tasks: 0, completed: 0, avgEfficiency: 0, avgROI: 0 });

  useEffect(() => {
    const load = async () => {
      const [wRes, tRes] = await Promise.all([
        supabase.from("workers").select("district, status, performance_score"),
        supabase.from("tasks").select("district, status"),
      ]);

      const workers = wRes.data || [];
      const tasks = tRes.data || [];
      const dMap = new Map<string, { workers: number; tasks: number; completed: number; totalScore: number }>();

      workers.forEach((w) => {
        const d = w.district || "Unassigned";
        if (!dMap.has(d)) dMap.set(d, { workers: 0, tasks: 0, completed: 0, totalScore: 0 });
        dMap.get(d)!.workers++;
        dMap.get(d)!.totalScore += Number(w.performance_score || 0);
      });

      tasks.forEach((t) => {
        const d = t.district || "Unassigned";
        if (!dMap.has(d)) dMap.set(d, { workers: 0, tasks: 0, completed: 0, totalScore: 0 });
        dMap.get(d)!.tasks++;
        if (t.status === "completed") dMap.get(d)!.completed++;
      });

      const results: DistrictCost[] = [];
      dMap.forEach((v, district) => {
        const baseCostPerWorker = 100;
        const totalCost = v.workers * baseCostPerWorker;
        const costPerEngagement = v.completed > 0 ? Math.round(totalCost / v.completed) : totalCost;
        const efficiency = v.tasks > 0 ? Math.round((v.completed / v.tasks) * 100) : 0;
        const avgScore = v.workers > 0 ? v.totalScore / v.workers : 0;
        const roi = Math.round(efficiency * 0.6 + Math.min(avgScore / 10, 1) * 40);

        results.push({ district, workers: v.workers, tasks: v.tasks, completed: v.completed, costPerEngagement, efficiency, roi });
      });

      results.sort((a, b) => b.roi - a.roi);
      setDistricts(results);

      const tw = results.reduce((s, d) => s + d.workers, 0);
      const tt = results.reduce((s, d) => s + d.tasks, 0);
      const tc = results.reduce((s, d) => s + d.completed, 0);
      setTotals({
        workers: tw,
        tasks: tt,
        completed: tc,
        avgEfficiency: results.length ? Math.round(results.reduce((s, d) => s + d.efficiency, 0) / results.length) : 0,
        avgROI: results.length ? Math.round(results.reduce((s, d) => s + d.roi, 0) / results.length) : 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  const chartData = districts.map((d) => ({
    name: d.district.slice(0, 10),
    efficiency: d.efficiency,
    roi: d.roi,
    cost: d.costPerEngagement,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
        <span className="ml-2 text-sm font-mono text-muted-foreground">Computing resource metrics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
          RESOURCE <span className="text-warning">OPTIMIZATION</span>
        </h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">Cost efficiency & ROI intelligence</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Users className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-xl font-bold font-mono text-foreground">{totals.workers}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Total Workers</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Target className="w-5 h-5 mx-auto text-accent mb-1" />
          <p className="text-xl font-bold font-mono text-foreground">{totals.completed}/{totals.tasks}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Tasks Done</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <BarChart3 className="w-5 h-5 mx-auto text-warning mb-1" />
          <p className="text-xl font-bold font-mono text-warning">{totals.avgEfficiency}%</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Avg Efficiency</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <TrendingUp className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-xl font-bold font-mono text-primary">{totals.avgROI}%</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Avg ROI</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <DollarSign className="w-5 h-5 mx-auto text-accent mb-1" />
          <p className="text-xl font-bold font-mono text-foreground">{districts.length}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Zones</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">Efficiency & ROI by District</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "hsl(220 10% 50%)" }} />
            <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "hsl(220 10% 50%)" }} />
            <Tooltip contentStyle={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 15% 18%)", borderRadius: "6px", fontFamily: "JetBrains Mono", fontSize: 11, color: "hsl(180 10% 88%)" }} />
            <Bar dataKey="efficiency" fill="hsl(160 100% 40%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="roi" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 gap-2 px-4 py-2 border-b border-border text-[10px] font-mono uppercase text-muted-foreground tracking-widest">
          <div className="col-span-2">District</div>
          <div className="text-center">Workers</div>
          <div className="text-center">Done/Total</div>
          <div className="text-center">Cost/Eng</div>
          <div className="text-center">Efficiency</div>
          <div className="text-center">ROI</div>
        </div>
        {districts.map((d) => (
          <div key={d.district} className="grid grid-cols-7 gap-2 px-4 py-3 items-center border-b border-border/50 text-sm font-mono hover:bg-muted/30 animate-fade-in">
            <div className="col-span-2 text-foreground truncate">{d.district}</div>
            <div className="text-center text-foreground">{d.workers}</div>
            <div className="text-center text-accent">{d.completed}/{d.tasks}</div>
            <div className="text-center text-warning">₹{d.costPerEngagement}</div>
            <div className="text-center">
              <span className={d.efficiency >= 70 ? "text-primary" : d.efficiency >= 40 ? "text-warning" : "text-destructive"}>{d.efficiency}%</span>
            </div>
            <div className="text-center">
              <span className={d.roi >= 70 ? "text-primary font-bold" : d.roi >= 40 ? "text-warning" : "text-destructive"}>{d.roi}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
