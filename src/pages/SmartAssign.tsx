import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Brain, Zap, UserCheck, Loader2, CheckCircle } from "lucide-react";

interface Worker {
  id: string;
  full_name: string;
  district: string | null;
  booth_assignment: string | null;
  skills: string[];
  experience_level: number;
  performance_score: number;
  tasks_completed: number;
  status: string;
}

interface Recommendation {
  worker_id: string;
  worker_name: string;
  score: number;
  reasoning: string;
}

export default function SmartAssign() {
  const { user } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", priority: "medium", district: "", booth: "",
  });

  useEffect(() => {
    supabase.from("workers").select("*").eq("status", "active").then(({ data }) => setWorkers(data || []));
  }, []);

  const analyzeTask = async () => {
    if (!form.title.trim()) { toast.error("Enter a task title"); return; }
    setAnalyzing(true);
    setRecommendations([]);

    try {
      const { data, error } = await supabase.functions.invoke("ai-task-assign", {
        body: {
          task: { title: form.title, description: form.description, priority: form.priority, district: form.district, booth: form.booth },
          workers: workers.map((w) => ({
            id: w.id, name: w.full_name, district: w.district, booth: w.booth_assignment,
            skills: w.skills, experience: w.experience_level, score: w.performance_score, tasks_done: w.tasks_completed,
          })),
        },
      });

      if (error) throw error;
      setRecommendations(data?.recommendations || []);
      if (!data?.recommendations?.length) toast.info("No recommendations generated.");
    } catch (err: any) {
      toast.error(err.message || "AI analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const assignWorker = async (workerId: string) => {
    if (!user) return;
    setAssigning(workerId);
    try {
      const { error } = await supabase.from("tasks").insert({
        title: form.title,
        description: form.description || null,
        priority: form.priority as any,
        district: form.district || null,
        booth: form.booth || null,
        assigned_worker_id: workerId,
        status: "assigned" as any,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Task created & assigned to worker!");
      setForm({ title: "", description: "", priority: "medium", district: "", booth: "" });
      setRecommendations([]);
    } catch (err: any) {
      toast.error(err.message || "Assignment failed.");
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
          SMART <span className="text-primary">ASSIGN</span>
        </h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">
          AI-powered task-to-worker matching engine
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task form */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4 text-accent" /> Define Operation
          </h3>
          <div className="space-y-3">
            <div>
              <Label className="text-[10px] font-mono uppercase text-muted-foreground">Task Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-muted border-border font-mono text-sm" placeholder="e.g. Door-to-door canvassing campaign" />
            </div>
            <div>
              <Label className="text-[10px] font-mono uppercase text-muted-foreground">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-muted border-border font-mono text-sm" rows={3} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-[10px] font-mono uppercase text-muted-foreground">Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="bg-muted border-border font-mono text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] font-mono uppercase text-muted-foreground">District</Label>
                <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} className="bg-muted border-border font-mono text-sm" />
              </div>
              <div>
                <Label className="text-[10px] font-mono uppercase text-muted-foreground">Booth</Label>
                <Input value={form.booth} onChange={(e) => setForm({ ...form, booth: e.target.value })} className="bg-muted border-border font-mono text-sm" />
              </div>
            </div>
            <Button onClick={analyzeTask} disabled={analyzing || !form.title.trim() || workers.length === 0} className="w-full font-mono text-xs uppercase tracking-wider">
              {analyzing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
              {analyzing ? "AI Analyzing..." : "Find Best Workers"}
            </Button>
            {workers.length === 0 && (
              <p className="text-[10px] font-mono text-warning text-center">No active workers available. Add workers first.</p>
            )}
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" /> AI Recommendations
          </h3>
          {analyzing ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
                <p className="text-xs font-mono text-muted-foreground mt-2">Processing with AI...</p>
              </div>
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div key={rec.worker_id} className={`border rounded-lg p-3 animate-fade-in ${i === 0 ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">#{i + 1}</span>
                      <p className="font-mono font-bold text-sm text-foreground">{rec.worker_name}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] font-mono ${rec.score >= 80 ? "text-primary border-primary/30" : rec.score >= 60 ? "text-accent border-accent/30" : "text-warning border-warning/30"}`}>
                      {rec.score}% match
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mb-2">{rec.reasoning}</p>
                  <Button
                    size="sm"
                    onClick={() => assignWorker(rec.worker_id)}
                    disabled={assigning === rec.worker_id}
                    className="font-mono text-[10px] uppercase tracking-wider"
                  >
                    {assigning === rec.worker_id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                    Assign
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground font-mono text-sm text-center">
              Define a task and click "Find Best Workers"<br />to get AI-powered recommendations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
