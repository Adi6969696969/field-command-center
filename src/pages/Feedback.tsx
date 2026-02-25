import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, MessageSquare, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";

interface FeedbackItem {
  id: string;
  content: string;
  sentiment: string;
  sentiment_score: number;
  topics: string[];
  district: string | null;
  booth: string | null;
  created_at: string;
}

const SENTIMENT_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  positive: { icon: TrendingUp, color: "text-primary", label: "Positive" },
  negative: { icon: TrendingDown, color: "text-destructive", label: "Negative" },
  neutral: { icon: Minus, color: "text-muted-foreground", label: "Neutral" },
  mixed: { icon: MessageSquare, color: "text-warning", label: "Mixed" },
};

export default function Feedback() {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");
  const [district, setDistrict] = useState("");
  const [booth, setBooth] = useState("");

  const fetchFeedback = async () => {
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setFeedbacks(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchFeedback(); }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("feedback-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "feedback" }, () => {
        fetchFeedback();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !content.trim()) return;
    setSubmitting(true);

    try {
      // Analyze sentiment via AI
      const { data: analysis, error: aiError } = await supabase.functions.invoke("analyze-sentiment", {
        body: { content: content.trim() },
      });

      if (aiError) {
        console.error("AI analysis failed:", aiError);
        toast.error("Sentiment analysis failed, submitting without analysis.");
      }

      const { error } = await supabase.from("feedback").insert({
        submitted_by: user.id,
        content: content.trim(),
        sentiment: analysis?.sentiment || "neutral",
        sentiment_score: analysis?.sentiment_score || 0,
        topics: analysis?.topics || [],
        district: district || null,
        booth: booth || null,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Feedback submitted & analyzed.");
        setContent("");
        setDistrict("");
        setBooth("");
        fetchFeedback();
      }
    } catch (err) {
      toast.error("Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  const sentimentCounts = feedbacks.reduce((acc, f) => {
    acc[f.sentiment] = (acc[f.sentiment] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const avgScore = feedbacks.length
    ? (feedbacks.reduce((sum, f) => sum + Number(f.sentiment_score), 0) / feedbacks.length).toFixed(2)
    : "0";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
          GROUND <span className="text-primary">FEEDBACK</span>
        </h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">
          AI-powered sentiment analysis engine
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Total Reports</p>
          <p className="text-xl font-bold font-mono text-foreground">{feedbacks.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Avg Sentiment</p>
          <p className={`text-xl font-bold font-mono ${Number(avgScore) > 0 ? "text-primary" : Number(avgScore) < 0 ? "text-destructive" : "text-muted-foreground"}`}>{avgScore}</p>
        </div>
        <div className="bg-card border border-primary/30 rounded-lg p-3">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Positive</p>
          <p className="text-xl font-bold font-mono text-primary">{sentimentCounts.positive || 0}</p>
        </div>
        <div className="bg-card border border-destructive/30 rounded-lg p-3">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Negative</p>
          <p className="text-xl font-bold font-mono text-destructive">{sentimentCounts.negative || 0}</p>
        </div>
      </div>

      {/* Submit form */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Submit Field Report</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter ground-level observations, issues, or feedback..."
            className="bg-muted border-border font-mono text-sm min-h-[100px]"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] font-mono uppercase text-muted-foreground">District</Label>
              <Input value={district} onChange={(e) => setDistrict(e.target.value)} className="bg-muted border-border font-mono text-sm" />
            </div>
            <div>
              <Label className="text-[10px] font-mono uppercase text-muted-foreground">Booth</Label>
              <Input value={booth} onChange={(e) => setBooth(e.target.value)} className="bg-muted border-border font-mono text-sm" />
            </div>
          </div>
          <Button type="submit" disabled={submitting || !content.trim()} className="font-mono text-xs uppercase tracking-wider">
            {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            {submitting ? "Analyzing..." : "Submit & Analyze"}
          </Button>
        </form>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
          <span className="ml-2 text-sm font-mono text-muted-foreground">Loading feedback...</span>
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground font-mono text-sm">No field reports yet.</div>
      ) : (
        <div className="grid gap-3">
          {feedbacks.map((f) => {
            const config = SENTIMENT_CONFIG[f.sentiment] || SENTIMENT_CONFIG.neutral;
            const SIcon = config.icon;
            return (
              <div key={f.id} className="bg-card border border-border rounded-lg p-4 animate-fade-in">
                <div className="flex items-start gap-3">
                  <SIcon className={`w-4 h-4 mt-0.5 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-mono">{f.content}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] font-mono ${config.color}`}>{config.label}</Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">Score: {Number(f.sentiment_score).toFixed(2)}</span>
                      {f.topics?.map((t, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] font-mono bg-accent/10 text-accent border-accent/30">{t}</Badge>
                      ))}
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">
                      {[f.district, f.booth].filter(Boolean).join(" · ")}
                      {" · "}{new Date(f.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
