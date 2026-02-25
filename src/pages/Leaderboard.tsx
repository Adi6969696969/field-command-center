import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Star, Flame, Award, TrendingUp } from "lucide-react";

interface Worker {
  id: string;
  full_name: string;
  performance_score: number;
  tasks_completed: number;
  experience_level: number;
  status: string;
  district: string | null;
}

interface BadgeData {
  id: string;
  worker_id: string;
  badge_type: string;
  badge_name: string;
}

const RANK_ICONS = [Trophy, Medal, Star];
const RANK_COLORS = ["text-warning", "text-muted-foreground", "text-accent"];

const BADGE_ICONS: Record<string, string> = {
  top_performer: "🏆",
  task_master: "⚡",
  veteran: "🎖️",
  rising_star: "🌟",
  consistent: "💎",
};

export default function Leaderboard() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [workersRes, badgesRes] = await Promise.all([
        supabase.from("workers").select("id, full_name, performance_score, tasks_completed, experience_level, status, district").eq("status", "active").order("performance_score", { ascending: false }),
        supabase.from("badges").select("*"),
      ]);
      setWorkers(workersRes.data || []);
      setBadges(badgesRes.data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const getWorkerBadges = (workerId: string) => badges.filter((b) => b.worker_id === workerId);

  const computeRankScore = (w: Worker) =>
    Number(w.performance_score) * 2 + w.tasks_completed * 3 + w.experience_level * 5;

  const ranked = [...workers].sort((a, b) => computeRankScore(b) - computeRankScore(a));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
        <span className="ml-2 text-sm font-mono text-muted-foreground">Loading rankings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
          LEADER<span className="text-primary">BOARD</span>
        </h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">
          Performance rankings & achievements
        </p>
      </div>

      {/* Top 3 podium */}
      {ranked.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          {[1, 0, 2].map((idx) => {
            const w = ranked[idx];
            const Icon = RANK_ICONS[idx] || Star;
            const isFirst = idx === 0;
            return (
              <div
                key={w.id}
                className={`bg-card border rounded-lg p-4 text-center ${isFirst ? "border-warning/40 glow-primary -mt-2" : "border-border mt-2"}`}
              >
                <Icon className={`w-6 h-6 mx-auto mb-2 ${RANK_COLORS[idx]}`} />
                <p className="text-[10px] font-mono text-muted-foreground uppercase">#{idx + 1}</p>
                <p className="font-mono font-bold text-sm text-foreground mt-1 truncate">{w.full_name}</p>
                <p className="text-2xl font-bold font-mono text-primary mt-1">{computeRankScore(w)}</p>
                <p className="text-[10px] font-mono text-muted-foreground">POINTS</p>
                <div className="flex gap-1 justify-center mt-2 flex-wrap">
                  {getWorkerBadges(w.id).map((b) => (
                    <span key={b.id} title={b.badge_name} className="text-sm">
                      {BADGE_ICONS[b.badge_type] || "🏅"}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full rankings */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-border text-[10px] font-mono uppercase text-muted-foreground tracking-widest">
          <div className="col-span-1">#</div>
          <div className="col-span-3">Operative</div>
          <div className="col-span-2">District</div>
          <div className="col-span-1 text-center">Score</div>
          <div className="col-span-1 text-center">Tasks</div>
          <div className="col-span-1 text-center">Level</div>
          <div className="col-span-1 text-center">Points</div>
          <div className="col-span-2">Badges</div>
        </div>
        {ranked.map((w, i) => (
          <div
            key={w.id}
            className={`grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm font-mono border-b border-border/50 hover:bg-muted/30 transition-colors animate-fade-in ${i < 3 ? "bg-primary/5" : ""}`}
          >
            <div className="col-span-1 text-muted-foreground font-bold">{i + 1}</div>
            <div className="col-span-3 text-foreground font-semibold truncate">{w.full_name}</div>
            <div className="col-span-2 text-muted-foreground text-xs truncate">{w.district || "—"}</div>
            <div className="col-span-1 text-center text-primary">{Number(w.performance_score).toFixed(1)}</div>
            <div className="col-span-1 text-center text-foreground">{w.tasks_completed}</div>
            <div className="col-span-1 text-center text-accent">Lv.{w.experience_level}</div>
            <div className="col-span-1 text-center text-warning font-bold">{computeRankScore(w)}</div>
            <div className="col-span-2 flex gap-1 flex-wrap">
              {getWorkerBadges(w.id).map((b) => (
                <span key={b.id} title={b.badge_name} className="text-xs">
                  {BADGE_ICONS[b.badge_type] || "🏅"}
                </span>
              ))}
            </div>
          </div>
        ))}
        {ranked.length === 0 && (
          <div className="text-center py-8 text-muted-foreground font-mono text-sm">
            No active workers to rank. Add workers first.
          </div>
        )}
      </div>
    </div>
  );
}
