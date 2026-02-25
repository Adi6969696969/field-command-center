import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Activity } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Worker {
  id: string;
  full_name: string;
  district: string | null;
  booth_assignment: string | null;
  status: string;
  performance_score: number;
}

// Indian district approximate coordinates for demo placement
const DISTRICT_COORDS: Record<string, [number, number]> = {
  "north": [28.7041, 77.1025],
  "south": [12.9716, 77.5946],
  "east": [22.5726, 88.3639],
  "west": [19.0760, 72.8777],
  "central": [23.2599, 77.4126],
};

function getWorkerCoords(worker: Worker): [number, number] {
  const district = worker.district?.toLowerCase() || "";
  for (const [key, coords] of Object.entries(DISTRICT_COORDS)) {
    if (district.includes(key)) return [coords[0] + (Math.random() - 0.5) * 0.5, coords[1] + (Math.random() - 0.5) * 0.5];
  }
  // Default: scatter around India center
  return [22.5 + (Math.random() - 0.5) * 10, 78.9 + (Math.random() - 0.5) * 15];
}

export default function GeoIntel() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkers = async () => {
      const { data } = await supabase.from("workers").select("id, full_name, district, booth_assignment, status, performance_score");
      setWorkers(data || []);
      setLoading(false);
    };
    fetchWorkers();
  }, []);

  useEffect(() => {
    if (!mapRef.current || loading || leafletMap.current) return;

    const map = L.map(mapRef.current, {
      center: [22.5, 78.9],
      zoom: 5,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    workers.forEach((w) => {
      const coords = getWorkerCoords(w);
      const color = w.status === "active" ? "#00cc66" : w.status === "on_leave" ? "#f59e0b" : "#ef4444";

      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid ${color}40;box-shadow:0 0 8px ${color}80;"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      L.marker(coords, { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:monospace;font-size:11px;color:#ccc;background:#1a1f2e;padding:8px;border-radius:6px;min-width:140px;">
            <strong style="color:#00cc66;">${w.full_name}</strong><br/>
            District: ${w.district || "N/A"}<br/>
            Booth: ${w.booth_assignment || "N/A"}<br/>
            Score: ${Number(w.performance_score).toFixed(1)}<br/>
            Status: <span style="color:${color}">${w.status}</span>
          </div>
        `, { className: "dark-popup" });
    });

    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, [workers, loading]);

  const activeCount = workers.filter((w) => w.status === "active").length;
  const districts = [...new Set(workers.map((w) => w.district).filter(Boolean))];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
          GEO <span className="text-primary">INTEL</span>
        </h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">
          Field operative deployment map
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <div>
            <p className="text-lg font-bold font-mono text-foreground">{workers.length}</p>
            <p className="text-[10px] font-mono text-muted-foreground uppercase">Total Deployed</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent" />
          <div>
            <p className="text-lg font-bold font-mono text-foreground">{activeCount}</p>
            <p className="text-[10px] font-mono text-muted-foreground uppercase">Active</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-warning" />
          <div>
            <p className="text-lg font-bold font-mono text-foreground">{districts.length}</p>
            <p className="text-[10px] font-mono text-muted-foreground uppercase">Districts</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden" style={{ height: "500px" }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
            <span className="ml-2 text-sm font-mono text-muted-foreground">Loading map data...</span>
          </div>
        ) : (
          <div ref={mapRef} className="w-full h-full" />
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#00cc66" }} />
          <span className="text-[10px] font-mono text-muted-foreground">Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
          <span className="text-[10px] font-mono text-muted-foreground">On Leave</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ef4444" }} />
          <span className="text-[10px] font-mono text-muted-foreground">Inactive/Suspended</span>
        </div>
      </div>
    </div>
  );
}
