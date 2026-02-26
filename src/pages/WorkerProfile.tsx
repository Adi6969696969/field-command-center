import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, UserCircle, Star, Trophy, ClipboardList, MapPin, Mail, Phone, Calendar } from "lucide-react";

interface Worker {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  booth_assignment: string | null;
  district: string | null;
  constituency: string | null;
  skills: string[];
  experience_level: number;
  status: string;
  performance_score: number;
  tasks_completed: number;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
}

interface BadgeData {
  id: string;
  badge_name: string;
  badge_type: string;
  description: string | null;
  awarded_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-primary/10 text-primary border-primary/30",
  inactive: "bg-muted text-muted-foreground border-border",
  suspended: "bg-destructive/10 text-destructive border-destructive/30",
  on_leave: "bg-warning/10 text-warning border-warning/30",
};

const BADGE_ICONS: Record<string, string> = {
  top_performer: "🏆",
  task_master: "⚡",
  veteran: "🎖️",
  rising_star: "🌟",
  consistent: "💎",
};

export default function WorkerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [wRes, tRes, bRes] = await Promise.all([
        supabase.from("workers").select("*").eq("id", id).single(),
        supabase.from("tasks").select("id, title, status, priority, created_at").eq("assigned_worker_id", id).order("created_at", { ascending: false }).limit(20),
        supabase.from("badges").select("*").eq("worker_id", id).order("awarded_at", { ascending: false }),
      ]);
      if (wRes.error) { toast.error("Worker not found"); navigate("/workers"); return; }
      setWorker(wRes.data);
      setTasks(tRes.data || []);
      setBadges(bRes.data || []);
      setLoading(false);
    };
    load();
  }, [id, navigate]);

  if (loading || !worker) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
        <span className="ml-2 text-sm font-mono text-muted-foreground">Loading profile...</span>
      </div>
    );
  }

  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const completionRate = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate("/workers")} className="font-mono text-xs text-muted-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Roster
      </Button>

      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
            <UserCircle className="w-10 h-10 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold font-mono text-foreground">{worker.full_name}</h1>
              <Badge variant="outline" className={`text-[10px] font-mono ${STATUS_STYLES[worker.status] || ""}`}>
                {worker.status.replace("_", " ")}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono text-accent border-accent/30">
                Lv.{worker.experience_level}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs font-mono text-muted-foreground flex-wrap">
              {worker.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{worker.email}</span>}
              {worker.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{worker.phone}</span>}
              {worker.district && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{worker.district}</span>}
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Joined {new Date(worker.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <Star className="w-5 h-5 mx-auto text-warning mb-1" />
          <p className="text-2xl font-bold font-mono text-foreground">{Number(worker.performance_score).toFixed(1)}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Performance</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <ClipboardList className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold font-mono text-foreground">{worker.tasks_completed}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Tasks Done</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <Trophy className="w-5 h-5 mx-auto text-accent mb-1" />
          <p className="text-2xl font-bold font-mono text-foreground">{badges.length}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Badges</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Completion Rate</p>
          <p className="text-2xl font-bold font-mono text-primary">{completionRate}%</p>
          <Progress value={completionRate} className="mt-2 h-1" />
        </div>
      </div>

      {/* Skills & Location */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Skills</h3>
          {worker.skills?.length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {worker.skills.map((s, i) => (
                <Badge key={i} variant="outline" className="font-mono text-[10px] text-accent border-accent/30">{s}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs font-mono text-muted-foreground">No skills registered</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Assignment</h3>
          <div className="space-y-1 text-xs font-mono text-muted-foreground">
            <p>District: <span className="text-foreground">{worker.district || "—"}</span></p>
            <p>Booth: <span className="text-foreground">{worker.booth_assignment || "—"}</span></p>
            <p>Constituency: <span className="text-foreground">{worker.constituency || "—"}</span></p>
          </div>
        </div>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Achievements</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {badges.map((b) => (
              <div key={b.id} className="bg-muted border border-border rounded-lg p-3 text-center">
                <span className="text-2xl">{BADGE_ICONS[b.badge_type] || "🏅"}</span>
                <p className="text-xs font-mono font-semibold text-foreground mt-1">{b.badge_name}</p>
                {b.description && <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{b.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Tasks */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Recent Tasks ({tasks.length})
        </h3>
        {tasks.length === 0 ? (
          <p className="text-xs font-mono text-muted-foreground">No tasks assigned</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                <Badge variant="outline" className={`text-[10px] font-mono ${
                  t.status === "completed" ? "text-primary border-primary/30" :
                  t.status === "in_progress" ? "text-accent border-accent/30" :
                  "text-muted-foreground border-border"
                }`}>
                  {t.status.replace("_", " ")}
                </Badge>
                <p className="text-sm font-mono text-foreground flex-1 truncate">{t.title}</p>
                <Badge variant="outline" className="text-[10px] font-mono">{t.priority}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
