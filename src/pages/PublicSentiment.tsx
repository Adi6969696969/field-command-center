import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Activity, TrendingUp, TrendingDown, Minus, Eye, ThumbsUp, ThumbsDown, MessageCircle, Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const SENTIMENT_COLORS = { positive: "#10b981", neutral: "#6b7280", negative: "#ef4444" };

// Simulated public sentiment data across regions and time
const DAILY_TREND = Array.from({ length: 14 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (13 - i));
  return {
    date: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    positive: Math.floor(40 + Math.random() * 30),
    neutral: Math.floor(15 + Math.random() * 15),
    negative: Math.floor(10 + Math.random() * 20),
  };
});

const DISTRICT_SENTIMENT = [
  { district: "Central Delhi", positive: 62, neutral: 20, negative: 18, score: 72, trend: "up", topIssue: "Infrastructure" },
  { district: "North Delhi", positive: 45, neutral: 25, negative: 30, score: 58, trend: "down", topIssue: "Security" },
  { district: "Mumbai South", positive: 70, neutral: 18, negative: 12, score: 80, trend: "up", topIssue: "Economy" },
  { district: "Mumbai North", positive: 55, neutral: 22, negative: 23, score: 65, trend: "stable", topIssue: "Traffic" },
  { district: "Bangalore Urban", positive: 68, neutral: 17, negative: 15, score: 76, trend: "up", topIssue: "Tech Jobs" },
  { district: "Chennai Central", positive: 50, neutral: 28, negative: 22, score: 63, trend: "down", topIssue: "Water" },
  { district: "Kolkata South", positive: 42, neutral: 30, negative: 28, score: 55, trend: "down", topIssue: "Employment" },
  { district: "Hyderabad", positive: 65, neutral: 20, negative: 15, score: 74, trend: "up", topIssue: "Development" },
];

const TOPIC_BREAKDOWN = [
  { topic: "Economy & Jobs", mentions: 2340, sentiment: 0.65 },
  { topic: "Infrastructure", mentions: 1890, sentiment: 0.72 },
  { topic: "Healthcare", mentions: 1560, sentiment: 0.45 },
  { topic: "Education", mentions: 1230, sentiment: 0.58 },
  { topic: "Security & Law", mentions: 980, sentiment: 0.38 },
  { topic: "Environment", mentions: 750, sentiment: 0.55 },
  { topic: "Housing", mentions: 620, sentiment: 0.42 },
  { topic: "Transportation", mentions: 540, sentiment: 0.6 },
];

const SOCIAL_SOURCES = [
  { name: "Field Reports", value: 35 },
  { name: "Social Media", value: 28 },
  { name: "News Outlets", value: 20 },
  { name: "Surveys", value: 12 },
  { name: "Call Centers", value: 5 },
];

const SOURCE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#6b7280"];

export default function PublicSentiment() {
  const [timeRange, setTimeRange] = useState("14d");
  const [districtFilter, setDistrictFilter] = useState("all");

  const { data: feedbackData } = useQuery({
    queryKey: ["public-sentiment-feedback"],
    queryFn: async () => {
      const { data } = await supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
  });

  const overallScore = useMemo(() => {
    const avg = DISTRICT_SENTIMENT.reduce((sum, d) => sum + d.score, 0) / DISTRICT_SENTIMENT.length;
    return Math.round(avg);
  }, []);

  const totalPositive = DAILY_TREND.reduce((s, d) => s + d.positive, 0);
  const totalNeutral = DAILY_TREND.reduce((s, d) => s + d.neutral, 0);
  const totalNegative = DAILY_TREND.reduce((s, d) => s + d.negative, 0);
  const total = totalPositive + totalNeutral + totalNegative;

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return <TrendingUp className="w-3 h-3 text-green-400" />;
    if (trend === "down") return <TrendingDown className="w-3 h-3 text-red-400" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  const getSentimentColor = (score: number) => {
    if (score >= 70) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold tracking-wider">
            PUBLIC <span className="text-primary">SENTIMENT</span>
          </h1>
          <p className="text-sm font-mono text-muted-foreground">Real-time voter & public opinion tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[130px] font-mono text-xs bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="14d">Last 14 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: "SENTIMENT SCORE", value: `${overallScore}%`, icon: Activity, color: getSentimentColor(overallScore) },
          { label: "POSITIVE", value: `${Math.round((totalPositive / total) * 100)}%`, icon: ThumbsUp, color: "text-green-400" },
          { label: "NEGATIVE", value: `${Math.round((totalNegative / total) * 100)}%`, icon: ThumbsDown, color: "text-red-400" },
          { label: "MENTIONS", value: TOPIC_BREAKDOWN.reduce((s, t) => s + t.mentions, 0).toLocaleString(), icon: MessageCircle, color: "text-primary" },
          { label: "DISTRICTS", value: DISTRICT_SENTIMENT.length, icon: Globe, color: "text-blue-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-muted-foreground uppercase">{stat.label}</span>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <span className={`text-xl font-mono font-bold ${stat.color}`}>{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Sentiment Trend */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-xs font-mono text-muted-foreground uppercase mb-3">Sentiment Trend</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={DAILY_TREND}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
            <Area type="monotone" dataKey="positive" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
            <Area type="monotone" dataKey="neutral" stackId="1" stroke="#6b7280" fill="#6b7280" fillOpacity={0.3} />
            <Area type="monotone" dataKey="negative" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-6 mt-2 text-[10px] font-mono text-muted-foreground">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-500" /> Positive</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-gray-500" /> Neutral</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500" /> Negative</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Topic Sentiment */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono text-muted-foreground uppercase mb-3">Topic Sentiment Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={TOPIC_BREAKDOWN} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <YAxis type="category" dataKey="topic" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={90} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} formatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
              <Bar dataKey="sentiment" radius={[0, 4, 4, 0]}>
                {TOPIC_BREAKDOWN.map((entry, i) => (
                  <Cell key={i} fill={entry.sentiment >= 0.6 ? "#10b981" : entry.sentiment >= 0.45 ? "#eab308" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Source Distribution */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono text-muted-foreground uppercase mb-3">Data Sources</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={SOCIAL_SOURCES} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {SOCIAL_SOURCES.map((_, i) => (
                  <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* District Sentiment Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-3 border-b border-border">
          <h3 className="text-xs font-mono text-muted-foreground uppercase">District-Level Sentiment</h3>
        </div>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left p-3 uppercase">District</th>
              <th className="text-left p-3 uppercase">Score</th>
              <th className="text-left p-3 uppercase">Positive</th>
              <th className="text-left p-3 uppercase">Neutral</th>
              <th className="text-left p-3 uppercase">Negative</th>
              <th className="text-left p-3 uppercase">Trend</th>
              <th className="text-left p-3 uppercase">Top Issue</th>
            </tr>
          </thead>
          <tbody>
            {DISTRICT_SENTIMENT.map((d, idx) => (
              <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                <td className="p-3 font-bold">{d.district}</td>
                <td className={`p-3 font-bold ${getSentimentColor(d.score)}`}>{d.score}%</td>
                <td className="p-3 text-green-400">{d.positive}%</td>
                <td className="p-3 text-muted-foreground">{d.neutral}%</td>
                <td className="p-3 text-red-400">{d.negative}%</td>
                <td className="p-3">{getTrendIcon(d.trend)}</td>
                <td className="p-3">
                  <Badge variant="outline" className="text-[10px] font-mono">{d.topIssue}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Real Feedback Integration */}
      {feedbackData && feedbackData.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono text-muted-foreground uppercase mb-3">
            <Eye className="w-3 h-3 inline mr-1" />
            Live Field Reports ({feedbackData.length})
          </h3>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {feedbackData.slice(0, 10).map((fb) => (
              <div key={fb.id} className="flex items-start gap-3 p-2 rounded bg-muted/20">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${fb.sentiment === "positive" ? "bg-green-500" : fb.sentiment === "negative" ? "bg-red-500" : "bg-gray-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">{fb.content}</p>
                  <p className="text-[10px] text-muted-foreground">{fb.district || "Unknown"} • {fb.sentiment || "neutral"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
