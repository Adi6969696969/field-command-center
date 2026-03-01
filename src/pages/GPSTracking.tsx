import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Navigation, MapPin, Radio, Satellite, Clock, Users, Activity } from "lucide-react";
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

interface GPSPosition {
  workerId: string;
  lat: number;
  lng: number;
  timestamp: number;
  accuracy: number;
}

const DISTRICT_COORDS: Record<string, [number, number]> = {
  north: [28.7041, 77.1025],
  south: [12.9716, 77.5946],
  east: [22.5726, 88.3639],
  west: [19.076, 72.8777],
  central: [23.2599, 77.4126],
};

function getWorkerCoords(worker: Worker): [number, number] {
  const district = worker.district?.toLowerCase() || "";
  for (const [key, coords] of Object.entries(DISTRICT_COORDS)) {
    if (district.includes(key))
      return [
        coords[0] + (Math.random() - 0.5) * 0.3,
        coords[1] + (Math.random() - 0.5) * 0.3,
      ];
  }
  return [22.5 + (Math.random() - 0.5) * 8, 78.9 + (Math.random() - 0.5) * 12];
}

export default function GPSTracking() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const trailsRef = useRef<Map<string, L.Polyline>>(new Map());
  const positionsRef = useRef<Map<string, GPSPosition[]>>(new Map());
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [myPosition, setMyPosition] = useState<GeolocationPosition | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchWorkers = async () => {
      const { data } = await supabase
        .from("workers")
        .select("id, full_name, district, booth_assignment, status, performance_score");
      setWorkers(data || []);
      setLoading(false);
    };
    fetchWorkers();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || loading || leafletMap.current) return;

    const map = L.map(mapRef.current, {
      center: [22.5, 78.9],
      zoom: 5,
      zoomControl: true,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }
    ).addTo(map);

    // Place initial worker markers
    workers.forEach((w) => {
      const coords = getWorkerCoords(w);
      const color =
        w.status === "active"
          ? "#00cc66"
          : w.status === "on_leave"
          ? "#f59e0b"
          : "#ef4444";

      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid ${color}60;box-shadow:0 0 12px ${color}80;animation:pulse 2s infinite;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker(coords, { icon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:monospace;font-size:11px;color:#ccc;background:#1a1f2e;padding:8px;border-radius:6px;min-width:160px;">
            <strong style="color:#00cc66;">${w.full_name}</strong><br/>
            District: ${w.district || "N/A"}<br/>
            Booth: ${w.booth_assignment || "N/A"}<br/>
            Score: ${Number(w.performance_score).toFixed(1)}<br/>
            Status: <span style="color:${color}">${w.status}</span><br/>
            <span style="color:#888;">📍 GPS Active</span>
          </div>`,
          { className: "dark-popup" }
        );

      markersRef.current.set(w.id, marker);
      positionsRef.current.set(w.id, [{ workerId: w.id, lat: coords[0], lng: coords[1], timestamp: Date.now(), accuracy: 10 }]);
    });

    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
      markersRef.current.clear();
      trailsRef.current.clear();
    };
  }, [workers, loading]);

  // Simulate live GPS movement for workers
  const simulateMovement = useCallback(() => {
    if (!leafletMap.current) return;
    const map = leafletMap.current;

    markersRef.current.forEach((marker, workerId) => {
      const pos = marker.getLatLng();
      const newLat = pos.lat + (Math.random() - 0.5) * 0.01;
      const newLng = pos.lng + (Math.random() - 0.5) * 0.01;

      marker.setLatLng([newLat, newLng]);

      // Update trail
      const positions = positionsRef.current.get(workerId) || [];
      positions.push({ workerId, lat: newLat, lng: newLng, timestamp: Date.now(), accuracy: Math.random() * 15 + 5 });
      if (positions.length > 20) positions.shift();
      positionsRef.current.set(workerId, positions);

      // Draw trail polyline
      const trail = trailsRef.current.get(workerId);
      const latlngs = positions.map((p) => [p.lat, p.lng] as L.LatLngTuple);
      if (trail) {
        trail.setLatLngs(latlngs);
      } else {
        const worker = workers.find((w) => w.id === workerId);
        const color = worker?.status === "active" ? "#00cc6640" : "#f59e0b40";
        const newTrail = L.polyline(latlngs, {
          color,
          weight: 2,
          dashArray: "4 4",
        }).addTo(map);
        trailsRef.current.set(workerId, newTrail);
      }
    });

    setLastUpdate(new Date());
  }, [workers]);

  const startTracking = () => {
    setTracking(true);
    toast.success("Live GPS tracking activated");

    // Start simulated movement
    intervalRef.current = setInterval(simulateMovement, 3000);

    // Start real device GPS
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => setMyPosition(pos),
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }
  };

  const stopTracking = () => {
    setTracking(false);
    toast.info("GPS tracking paused");
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);

    // Clear trails
    trailsRef.current.forEach((trail) => trail.remove());
    trailsRef.current.clear();
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const activeCount = workers.filter((w) => w.status === "active").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
            GPS <span className="text-primary">TRACKING</span>
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Real-time field operative movement tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tracking && (
            <Badge variant="outline" className="font-mono text-[10px] border-primary text-primary animate-pulse">
              <Radio className="w-3 h-3 mr-1" /> LIVE
            </Badge>
          )}
          <Button
            onClick={tracking ? stopTracking : startTracking}
            variant={tracking ? "destructive" : "default"}
            className="font-mono text-xs uppercase tracking-wider"
          >
            <Satellite className="w-4 h-4 mr-1" />
            {tracking ? "Stop Tracking" : "Start Live GPS"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <div>
            <p className="text-lg font-bold font-mono text-foreground">{workers.length}</p>
            <p className="text-[10px] font-mono text-muted-foreground uppercase">Tracked</p>
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
          <Navigation className="w-4 h-4 text-primary" />
          <div>
            <p className="text-lg font-bold font-mono text-foreground">
              {myPosition ? `${myPosition.coords.latitude.toFixed(4)}` : "—"}
            </p>
            <p className="text-[10px] font-mono text-muted-foreground uppercase">Your Lat</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-bold font-mono text-foreground">
              {lastUpdate ? lastUpdate.toLocaleTimeString() : "—"}
            </p>
            <p className="text-[10px] font-mono text-muted-foreground uppercase">Last Update</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden" style={{ height: "500px" }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
            <span className="ml-2 text-sm font-mono text-muted-foreground">Loading GPS data...</span>
          </div>
        ) : (
          <div ref={mapRef} className="w-full h-full" />
        )}
      </div>

      <div className="flex gap-4 flex-wrap text-[10px] font-mono text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#00cc66" }} />
          <span>Active (GPS On)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
          <span>On Leave</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ef4444" }} />
          <span>Inactive</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-0 border-t border-dashed" style={{ borderColor: "#00cc6640" }} />
          <span>Movement Trail</span>
        </div>
      </div>
    </div>
  );
}
