import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { FlaskConical, Play, RotateCcw, TrendingUp, Users, Target } from "lucide-react";

interface SimulationResult {
  label: string;
  manpower: number;
  readiness: number;
  engagement: number;
  risk: number;
  efficiency: number;
}

export default function DigitalTwin() {
  const [baseData, setBaseData] = useState({ workers: 0, tasks: 0, avgScore: 0 });
  const [manpowerChange, setManpowerChange] = useState([0]);
  const [budgetChange, setBudgetChange] = useState([0]);
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [planA, setPlanA] = useState<SimulationResult | null>(null);
  const [planB, setPlanB] = useState<SimulationResult | null>(null);

  useEffect(() => {
    const load = async () => {
      const [wRes, tRes] = await Promise.all([
        supabase.from("workers").select("performance_score, status"),
        supabase.from("tasks").select("status"),
      ]);
      const workers = wRes.data || [];
      const tasks = tRes.data || [];
      const activeWorkers = workers.filter((w) => w.status === "active").length;
      const avgScore = workers.length
        ? workers.reduce((s, w) => s + Number(w.performance_score || 0), 0) / workers.length
        : 0;
      setBaseData({ workers: activeWorkers, tasks: tasks.length, avgScore: Math.round(avgScore * 10) / 10 });
    };
    load();
  }, []);

  const simulate = (mpChange: number, bgChange: number): SimulationResult => {
    const newManpower = Math.max(0, baseData.workers + mpChange);
    const workerRatio = baseData.workers > 0 ? newManpower / baseData.workers : 1;
    const budgetFactor = 1 + bgChange / 100;

    const readiness = Math.round(Math.min(100, (workerRatio * 40 + budgetFactor * 30 + (baseData.avgScore / 10) * 30)));
    const engagement = Math.round(Math.min(100, readiness * 0.8 + Math.random() * 20));
    const risk = Math.round(Math.max(0, 100 - readiness * 0.9));
    const efficiency = Math.round(Math.min(100, (readiness + engagement) / 2 * budgetFactor));

    return {
      label: `MP${mpChange >= 0 ? "+" : ""}${mpChange} / BG${bgChange >= 0 ? "+" : ""}${bgChange}%`,
      manpower: newManpower,
      readiness,
      engagement,
      risk,
      efficiency,
    };
  };

  const runSimulation = () => {
    const scenarios: SimulationResult[] = [];
    for (let mp = -10; mp <= 20; mp += 5) {
      scenarios.push(simulate(mp, budgetChange[0]));
    }
    setResults(scenarios);

    setPlanA(simulate(manpowerChange[0], budgetChange[0]));
    setPlanB(simulate(Math.round(manpowerChange[0] * 1.5), Math.round(budgetChange[0] * 0.7)));
  };

  const radarData = planA && planB ? [
    { metric: "Readiness", A: planA.readiness, B: planB.readiness },
    { metric: "Engagement", A: planA.engagement, B: planB.engagement },
    { metric: "Efficiency", A: planA.efficiency, B: planB.efficiency },
    { metric: "Risk (inv)", A: 100 - planA.risk, B: 100 - planB.risk },
    { metric: "Manpower", A: Math.min(100, (planA.manpower / (baseData.workers || 1)) * 50), B: Math.min(100, (planB.manpower / (baseData.workers || 1)) * 50) },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
          DIGITAL <span className="text-accent">TWIN</span>
        </h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">Campaign scenario simulation engine</p>
      </div>

      {/* Base stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Users className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-xl font-bold font-mono text-foreground">{baseData.workers}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Current Workers</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Target className="w-5 h-5 mx-auto text-accent mb-1" />
          <p className="text-xl font-bold font-mono text-foreground">{baseData.tasks}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Total Tasks</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <TrendingUp className="w-5 h-5 mx-auto text-warning mb-1" />
          <p className="text-xl font-bold font-mono text-foreground">{baseData.avgScore}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Avg Performance</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-accent" /> Simulation Parameters
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <Label className="text-[10px] font-mono uppercase text-muted-foreground">
              Manpower Change: <span className="text-foreground">{manpowerChange[0] >= 0 ? "+" : ""}{manpowerChange[0]} workers</span>
            </Label>
            <Slider value={manpowerChange} onValueChange={setManpowerChange} min={-20} max={50} step={1} className="mt-2" />
          </div>
          <div>
            <Label className="text-[10px] font-mono uppercase text-muted-foreground">
              Budget Change: <span className="text-foreground">{budgetChange[0] >= 0 ? "+" : ""}{budgetChange[0]}%</span>
            </Label>
            <Slider value={budgetChange} onValueChange={setBudgetChange} min={-50} max={100} step={5} className="mt-2" />
          </div>
        </div>
        <Button onClick={runSimulation} className="mt-4 font-mono text-xs uppercase tracking-wider">
          <Play className="w-4 h-4 mr-1" /> Run Simulation
        </Button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">Readiness Forecast</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={results}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fontFamily: "JetBrains Mono", fill: "hsl(220 10% 50%)" }} />
                <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "hsl(220 10% 50%)" }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 15% 18%)", borderRadius: "6px", fontFamily: "JetBrains Mono", fontSize: 11, color: "hsl(180 10% 88%)" }} />
                <Bar dataKey="readiness" fill="hsl(160 100% 40%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="risk" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {planA && planB && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">Plan A vs Plan B</h3>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(220 15% 18%)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "hsl(220 10% 50%)" }} />
                  <PolarRadiusAxis tick={{ fontSize: 9, fill: "hsl(220 10% 50%)" }} />
                  <Radar name="Plan A" dataKey="A" stroke="hsl(160 100% 40%)" fill="hsl(160 100% 40%)" fillOpacity={0.2} />
                  <Radar name="Plan B" dataKey="B" stroke="hsl(185 80% 45%)" fill="hsl(185 80% 45%)" fillOpacity={0.2} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 15% 18%)", borderRadius: "6px", fontFamily: "JetBrains Mono", fontSize: 11, color: "hsl(180 10% 88%)" }} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 justify-center mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-[10px] font-mono text-muted-foreground">Plan A (Your Config)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span className="text-[10px] font-mono text-muted-foreground">Plan B (Alt Scenario)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Plan comparison cards */}
      {planA && planB && (
        <div className="grid grid-cols-2 gap-4">
          {[{ plan: planA, label: "Plan A", color: "primary" }, { plan: planB, label: "Plan B", color: "accent" }].map(({ plan, label, color }) => (
            <div key={label} className={`bg-card border border-${color}/30 rounded-lg p-4`}>
              <h4 className={`text-xs font-mono uppercase tracking-widest text-${color} mb-3`}>{label}</h4>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div><span className="text-muted-foreground">Manpower:</span> <span className="text-foreground font-bold">{plan.manpower}</span></div>
                <div><span className="text-muted-foreground">Readiness:</span> <span className="text-foreground font-bold">{plan.readiness}%</span></div>
                <div><span className="text-muted-foreground">Engagement:</span> <span className="text-foreground font-bold">{plan.engagement}%</span></div>
                <div><span className="text-muted-foreground">Risk:</span> <span className="text-foreground font-bold">{plan.risk}%</span></div>
                <div><span className="text-muted-foreground">Efficiency:</span> <span className="text-foreground font-bold">{plan.efficiency}%</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && (
        <div className="text-center py-12 text-muted-foreground font-mono text-sm">
          <FlaskConical className="w-12 h-12 mx-auto mb-3 text-accent" />
          Adjust parameters and run simulation to forecast outcomes.
        </div>
      )}
    </div>
  );
}
