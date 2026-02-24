import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { Users, ClipboardList, CheckCircle, AlertTriangle, Activity, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface Stats {
  totalWorkers: number;
  activeWorkers: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  avgPerformance: number;
}

const PIE_COLORS = [
  "hsl(160 100% 40%)",
  "hsl(185 80% 45%)",
  "hsl(38 92% 50%)",
  "hsl(0 72% 51%)",
  "hsl(220 15% 30%)",
];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalWorkers: 0, activeWorkers: 0, totalTasks: 0,
    completedTasks: 0, pendingTasks: 0, avgPerformance: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [workersRes, tasksRes] = await Promise.all([
        supabase.from("workers").select("status, performance_score"),
        supabase.from("tasks").select("status"),
      ]);

      const workers = workersRes.data || [];
      const tasks = tasksRes.data || [];
      const active = workers.filter((w) => w.status === "active").length;
      const scores = workers.map((w) => Number(w.performance_score) || 0);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      setStats({
        totalWorkers: workers.length,
        activeWorkers: active,
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t) => t.status === "completed").length,
        pendingTasks: tasks.filter((t) => t.status === "pending").length,
        avgPerformance: Math.round(avg * 10) / 10,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  const taskDistribution = [
    { name: "Pending", value: stats.pendingTasks },
    { name: "Completed", value: stats.completedTasks },
    { name: "In Progress", value: stats.totalTasks - stats.completedTasks - stats.pendingTasks },
  ].filter((d) => d.value > 0);

  const readinessData = [
    { zone: "Zone A", score: 85 },
    { zone: "Zone B", score: 72 },
    { zone: "Zone C", score: 91 },
    { zone: "Zone D", score: 63 },
    { zone: "Zone E", score: 78 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
        <span className="ml-2 text-sm font-mono text-muted-foreground">Loading intelligence...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
          WAR <span className="text-primary">ROOM</span>
        </h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">
          Real-time field intelligence overview
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total Workers" value={stats.totalWorkers} icon={Users} variant="primary" />
        <StatCard label="Active Workers" value={stats.activeWorkers} icon={Activity} variant="accent" />
        <StatCard label="Total Tasks" value={stats.totalTasks} icon={ClipboardList} variant="default" />
        <StatCard label="Completed" value={stats.completedTasks} icon={CheckCircle} variant="primary" />
        <StatCard label="Pending" value={stats.pendingTasks} icon={AlertTriangle} variant="warning" />
        <StatCard label="Avg Performance" value={stats.avgPerformance} icon={Target} variant="accent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
            Readiness Index by Zone
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={readinessData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
              <XAxis dataKey="zone" tick={{ fontSize: 11, fontFamily: "JetBrains Mono", fill: "hsl(220 10% 50%)" }} />
              <YAxis tick={{ fontSize: 11, fontFamily: "JetBrains Mono", fill: "hsl(220 10% 50%)" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220 18% 10%)",
                  border: "1px solid hsl(220 15% 18%)",
                  borderRadius: "6px",
                  fontFamily: "JetBrains Mono",
                  fontSize: 11,
                  color: "hsl(180 10% 88%)",
                }}
              />
              <Bar dataKey="score" fill="hsl(160 100% 40%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
            Task Distribution
          </h3>
          {taskDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={taskDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {taskDistribution.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(220 18% 10%)",
                    border: "1px solid hsl(220 15% 18%)",
                    borderRadius: "6px",
                    fontFamily: "JetBrains Mono",
                    fontSize: 11,
                    color: "hsl(180 10% 88%)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground font-mono text-sm">
              No tasks yet. Create tasks to see distribution.
            </div>
          )}
          <div className="flex gap-4 justify-center mt-2">
            {taskDistribution.map((d, idx) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                <span className="text-[10px] font-mono text-muted-foreground">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
