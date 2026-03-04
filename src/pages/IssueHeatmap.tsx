import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import L from "leaflet";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Flame, MapPin, AlertTriangle, Filter, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import "leaflet/dist/leaflet.css";

const ISSUE_CATEGORIES = ["logistics", "security", "communication", "infrastructure", "personnel", "other"];
const SEVERITY_COLORS: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e" };
const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#6b7280"];

const SIMULATED_ISSUES = [
  { lat: 28.6139, lng: 77.209, district: "Central Delhi", category: "logistics", severity: "high", count: 14, description: "Vehicle shortage for booth material delivery" },
  { lat: 28.7041, lng: 77.1025, district: "North Delhi", category: "security", severity: "critical", count: 8, description: "Booth-level altercation reports" },
  { lat: 19.076, lng: 72.8777, district: "Mumbai South", category: "communication", severity: "medium", count: 22, description: "Network dead zones affecting coordination" },
  { lat: 19.186, lng: 72.8484, district: "Mumbai North", category: "infrastructure", severity: "low", count: 6, description: "EVM storage facility maintenance" },
  { lat: 12.9716, lng: 77.5946, district: "Bangalore Urban", category: "personnel", severity: "high", count: 18, description: "Worker no-shows in outer booths" },
  { lat: 13.0827, lng: 80.2707, district: "Chennai Central", category: "logistics", severity: "medium", count: 11, description: "Pamphlet distribution delays" },
  { lat: 22.5726, lng: 88.3639, district: "Kolkata South", category: "security", severity: "high", count: 15, description: "Opposition rally clashes near booths" },
  { lat: 26.8467, lng: 80.9462, district: "Lucknow", category: "infrastructure", severity: "critical", count: 9, description: "Power outages at counting centers" },
  { lat: 23.0225, lng: 72.5714, district: "Ahmedabad", category: "communication", severity: "low", count: 5, description: "Minor WhatsApp group sync delays" },
  { lat: 17.385, lng: 78.4867, district: "Hyderabad", category: "personnel", severity: "medium", count: 13, description: "Volunteer fatigue in afternoon shifts" },
  { lat: 26.9124, lng: 75.7873, district: "Jaipur", category: "other", severity: "high", count: 7, description: "Weather disruption at open-air rallies" },
  { lat: 30.7333, lng: 76.7794, district: "Chandigarh", category: "logistics", severity: "medium", count: 10, description: "Banner printing delays" },
  { lat: 25.3176, lng: 82.9739, district: "Varanasi", category: "security", severity: "critical", count: 12, description: "Crowd control concerns at ghats" },
  { lat: 21.1702, lng: 72.8311, district: "Surat", category: "infrastructure", severity: "low", count: 4, description: "Minor signage issues" },
  { lat: 15.3173, lng: 75.7139, district: "Hubli-Dharwad", category: "personnel", severity: "medium", count: 9, description: "Training gap for new recruits" },
];

export default function IssueHeatmap() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);

  const { data: feedbackData } = useQuery({
    queryKey: ["feedback-issues"],
    queryFn: async () => {
      const { data } = await supabase.from("feedback").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filteredIssues = useMemo(() => {
    return SIMULATED_ISSUES.filter((issue) => {
      if (categoryFilter !== "all" && issue.category !== categoryFilter) return false;
      if (severityFilter !== "all" && issue.severity !== severityFilter) return false;
      return true;
    });
  }, [categoryFilter, severityFilter]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, { center: [22.5, 78.9], zoom: 5, zoomControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OSM &copy; CARTO',
    }).addTo(map);
    leafletMap.current = map;
    return () => { map.remove(); leafletMap.current = null; };
  }, []);

  // Update markers when filters change
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    filteredIssues.forEach((issue) => {
      const radius = Math.max(8, Math.min(issue.count * 1.5, 30));
      const color = SEVERITY_COLORS[issue.severity] || "#6b7280";
      const marker = L.circleMarker([issue.lat, issue.lng], {
        radius,
        fillColor: color,
        color,
        weight: 1,
        fillOpacity: 0.6,
      }).addTo(map);
      marker.bindPopup(`
        <div style="font-size:11px;">
          <strong>${issue.district}</strong><br/>
          Category: ${issue.category}<br/>
          Severity: ${issue.severity}<br/>
          Reports: ${issue.count}<br/>
          <em>${issue.description}</em>
        </div>
      `);
      markersRef.current.push(marker);
    });
  }, [filteredIssues]);

  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredIssues.forEach((i) => { counts[i.category] = (counts[i.category] || 0) + i.count; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredIssues]);

  const severityStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredIssues.forEach((i) => { counts[i.severity] = (counts[i.severity] || 0) + i.count; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredIssues]);

  const districtStats = useMemo(() => {
    return filteredIssues.sort((a, b) => b.count - a.count).slice(0, 8).map((i) => ({ district: i.district, issues: i.count }));
  }, [filteredIssues]);

  const totalIssues = filteredIssues.reduce((sum, i) => sum + i.count, 0);
  const criticalCount = filteredIssues.filter((i) => i.severity === "critical").reduce((sum, i) => sum + i.count, 0);
  const hotDistrict = [...filteredIssues].sort((a, b) => b.count - a.count)[0]?.district || "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold tracking-wider">
            ISSUE <span className="text-primary">HEATMAP</span>
          </h1>
          <p className="text-sm font-mono text-muted-foreground">Geographic issue density intelligence</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] font-mono text-xs bg-card border-border">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {ISSUE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[140px] font-mono text-xs bg-card border-border">
              <AlertTriangle className="w-3 h-3 mr-1" />
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "TOTAL ISSUES", value: totalIssues, icon: Flame, color: "text-orange-400" },
          { label: "CRITICAL", value: criticalCount, icon: AlertTriangle, color: "text-destructive" },
          { label: "ZONES AFFECTED", value: filteredIssues.length, icon: MapPin, color: "text-primary" },
          { label: "HOTSPOT", value: hotDistrict, icon: TrendingUp, color: "text-yellow-400" },
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

      {/* Map */}
      <div className="bg-card border border-border rounded-lg overflow-hidden" style={{ height: "420px" }}>
        <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-[10px] font-mono text-muted-foreground">
        {Object.entries(SEVERITY_COLORS).map(([label, color]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="capitalize">{label}</span>
          </div>
        ))}
        <span className="ml-2">● Size = issue density</span>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 lg:col-span-1">
          <h3 className="text-xs font-mono text-muted-foreground uppercase mb-3">Top Districts by Issues</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={districtStats} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis type="category" dataKey="district" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={80} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
              <Bar dataKey="issues" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono text-muted-foreground uppercase mb-3">Issue Categories</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={categoryStats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {categoryStats.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono text-muted-foreground uppercase mb-3">Severity Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={severityStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {severityStats.map((entry) => (
                  <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Issue Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left p-3 uppercase">District</th>
              <th className="text-left p-3 uppercase">Category</th>
              <th className="text-left p-3 uppercase">Severity</th>
              <th className="text-left p-3 uppercase">Reports</th>
              <th className="text-left p-3 uppercase">Description</th>
            </tr>
          </thead>
          <tbody>
            {filteredIssues.map((issue, idx) => (
              <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                <td className="p-3">{issue.district}</td>
                <td className="p-3 capitalize">{issue.category}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold" style={{ color: SEVERITY_COLORS[issue.severity] }}>
                    {issue.severity}
                  </span>
                </td>
                <td className="p-3 font-bold">{issue.count}</td>
                <td className="p-3 text-muted-foreground">{issue.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
