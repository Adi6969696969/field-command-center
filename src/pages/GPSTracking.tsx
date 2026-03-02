import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Navigation,
  MapPin,
  Radio,
  Satellite,
  Clock,
  Users,
  Activity,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  Eye,
  Plus,
  Trash2,
  Edit2,
  Route,
  Bell,
  BellOff,
} from "lucide-react";
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

interface GeoFenceZone {
  id: string;
  name: string;
  center: [number, number];
  radiusKm: number;
  district: string;
  type: "booth" | "district";
}

interface AttendanceRecord {
  workerId: string;
  workerName: string;
  zone: string;
  event: "entered" | "exited";
  timestamp: Date;
}

interface BreachAlert {
  id: string;
  workerId: string;
  workerName: string;
  district: string;
  distanceKm: number;
  timestamp: Date;
  severity: "warning" | "critical";
}

const DISTRICT_COORDS: Record<string, [number, number]> = {
  north: [28.7041, 77.1025],
  south: [12.9716, 77.5946],
  east: [22.5726, 88.3639],
  west: [19.076, 72.8777],
  central: [23.2599, 77.4126],
};

const DEFAULT_GEO_FENCE_ZONES: GeoFenceZone[] = [
  { id: "gf-north-1", name: "North HQ Zone", center: [28.7041, 77.1025], radiusKm: 25, district: "north", type: "district" },
  { id: "gf-north-b1", name: "North Booth A", center: [28.72, 77.12], radiusKm: 5, district: "north", type: "booth" },
  { id: "gf-south-1", name: "South HQ Zone", center: [12.9716, 77.5946], radiusKm: 25, district: "south", type: "district" },
  { id: "gf-south-b1", name: "South Booth A", center: [12.98, 77.60], radiusKm: 5, district: "south", type: "booth" },
  { id: "gf-east-1", name: "East HQ Zone", center: [22.5726, 88.3639], radiusKm: 25, district: "east", type: "district" },
  { id: "gf-east-b1", name: "East Booth A", center: [22.58, 88.37], radiusKm: 5, district: "east", type: "booth" },
  { id: "gf-west-1", name: "West HQ Zone", center: [19.076, 72.8777], radiusKm: 25, district: "west", type: "district" },
  { id: "gf-west-b1", name: "West Booth A", center: [19.08, 72.88], radiusKm: 5, district: "west", type: "booth" },
  { id: "gf-central-1", name: "Central HQ Zone", center: [23.2599, 77.4126], radiusKm: 25, district: "central", type: "district" },
  { id: "gf-central-b1", name: "Central Booth A", center: [23.27, 77.42], radiusKm: 5, district: "central", type: "booth" },
];

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getWorkerCoords(worker: Worker): [number, number] {
  const district = worker.district?.toLowerCase() || "";
  for (const [key, coords] of Object.entries(DISTRICT_COORDS)) {
    if (district.includes(key))
      return [coords[0] + (Math.random() - 0.5) * 0.3, coords[1] + (Math.random() - 0.5) * 0.3];
  }
  return [22.5 + (Math.random() - 0.5) * 8, 78.9 + (Math.random() - 0.5) * 12];
}

// Nearest-neighbor route optimization
function optimizeRoute(points: [number, number][]): [number, number][] {
  if (points.length <= 2) return points;
  const visited = new Set<number>();
  const route: [number, number][] = [points[0]];
  visited.add(0);

  while (visited.size < points.length) {
    const last = route[route.length - 1];
    let nearest = -1;
    let nearestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) continue;
      const d = haversineDistance(last[0], last[1], points[i][0], points[i][1]);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    }
    if (nearest >= 0) {
      visited.add(nearest);
      route.push(points[nearest]);
    }
  }
  return route;
}

// Request push notification permission
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function sendPushNotification(title: string, body: string, severity: "warning" | "critical") {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const icon = severity === "critical" ? "🚨" : "⚠️";
  new Notification(`${icon} ${title}`, {
    body,
    icon: "/favicon.ico",
    tag: `breach-${Date.now()}`,
    requireInteraction: severity === "critical",
  });
}

export default function GPSTracking() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const trailsRef = useRef<Map<string, L.Polyline>>(new Map());
  const positionsRef = useRef<Map<string, GPSPosition[]>>(new Map());
  const geoFenceCirclesRef = useRef<Map<string, L.Circle>>(new Map());
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const routeMarkersRef = useRef<L.Marker[]>([]);
  const workerZoneStateRef = useRef<Map<string, Set<string>>>(new Map());

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [showGeoFences, setShowGeoFences] = useState(true);
  const [myPosition, setMyPosition] = useState<GeolocationPosition | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [attendanceLog, setAttendanceLog] = useState<AttendanceRecord[]>([]);
  const [breachAlerts, setBreachAlerts] = useState<BreachAlert[]>([]);
  const [activeTab, setActiveTab] = useState<"map" | "attendance" | "breaches" | "geofence" | "routes">("map");
  const [geoFenceZones, setGeoFenceZones] = useState<GeoFenceZone[]>(DEFAULT_GEO_FENCE_ZONES);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [showRouteFor, setShowRouteFor] = useState<string | null>(null);

  // Geo-fence editor state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<GeoFenceZone | null>(null);
  const [zoneForm, setZoneForm] = useState({ name: "", lat: "", lng: "", radiusKm: "", district: "", type: "booth" as "booth" | "district" });

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
    // Check notification permission
    if ("Notification" in window && Notification.permission === "granted") {
      setPushEnabled(true);
    }
  }, []);

  // Draw/redraw geo-fence circles on map
  const drawGeoFences = useCallback(() => {
    const map = leafletMap.current;
    if (!map) return;
    // Remove old circles
    geoFenceCirclesRef.current.forEach((c) => c.remove());
    geoFenceCirclesRef.current.clear();
    // Draw new
    geoFenceZones.forEach((zone) => {
      const color = zone.type === "district" ? "#3b82f6" : "#f59e0b";
      const circle = L.circle(zone.center, {
        radius: zone.radiusKm * 1000,
        color,
        fillColor: color,
        fillOpacity: showGeoFences ? 0.08 : 0,
        opacity: showGeoFences ? 1 : 0,
        weight: 1,
        dashArray: zone.type === "booth" ? "6 4" : undefined,
      }).addTo(map);
      circle.bindTooltip(
        `<span style="font-family:monospace;font-size:10px;">${zone.name}<br/>${zone.radiusKm}km radius</span>`,
        { className: "dark-tooltip" }
      );
      geoFenceCirclesRef.current.set(zone.id, circle);
    });
  }, [geoFenceZones, showGeoFences]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || loading || leafletMap.current) return;

    const map = L.map(mapRef.current, { center: [22.5, 78.9], zoom: 5, zoomControl: true });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    leafletMap.current = map;

    // Place worker markers
    workers.forEach((w) => {
      const coords = getWorkerCoords(w);
      const color = w.status === "active" ? "#00cc66" : w.status === "on_leave" ? "#f59e0b" : "#ef4444";

      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid ${color}60;box-shadow:0 0 12px ${color}80;"></div>`,
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

      const insideZones = new Set<string>();
      geoFenceZones.forEach((zone) => {
        if (haversineDistance(coords[0], coords[1], zone.center[0], zone.center[1]) <= zone.radiusKm) {
          insideZones.add(zone.id);
        }
      });
      workerZoneStateRef.current.set(w.id, insideZones);
    });

    return () => {
      map.remove();
      leafletMap.current = null;
      markersRef.current.clear();
      trailsRef.current.clear();
      geoFenceCirclesRef.current.clear();
    };
  }, [workers, loading]);

  // Draw geo-fences when map or zones change
  useEffect(() => {
    drawGeoFences();
  }, [drawGeoFences]);

  // Toggle geo-fence visibility
  useEffect(() => {
    geoFenceCirclesRef.current.forEach((c) => {
      c.setStyle({ opacity: showGeoFences ? 1 : 0, fillOpacity: showGeoFences ? 0.08 : 0 });
    });
  }, [showGeoFences]);

  // Check geo-fence boundaries for a worker
  const checkGeoFences = useCallback(
    (workerId: string, lat: number, lng: number) => {
      const worker = workers.find((w) => w.id === workerId);
      if (!worker) return;

      const prevZones = workerZoneStateRef.current.get(workerId) || new Set();
      const currentZones = new Set<string>();

      geoFenceZones.forEach((zone) => {
        const dist = haversineDistance(lat, lng, zone.center[0], zone.center[1]);
        const inside = dist <= zone.radiusKm;

        if (inside) currentZones.add(zone.id);

        if (inside && !prevZones.has(zone.id)) {
          const record: AttendanceRecord = {
            workerId,
            workerName: worker.full_name,
            zone: zone.name,
            event: "entered",
            timestamp: new Date(),
          };
          setAttendanceLog((prev) => [record, ...prev].slice(0, 100));
          if (zone.type === "booth") {
            toast.success(`✅ ${worker.full_name} checked in at ${zone.name}`);
          }
        }

        if (!inside && prevZones.has(zone.id)) {
          const record: AttendanceRecord = {
            workerId,
            workerName: worker.full_name,
            zone: zone.name,
            event: "exited",
            timestamp: new Date(),
          };
          setAttendanceLog((prev) => [record, ...prev].slice(0, 100));

          if (zone.type === "district") {
            const severity = dist > zone.radiusKm * 1.5 ? "critical" : "warning";
            const alert: BreachAlert = {
              id: `br-${Date.now()}-${workerId}`,
              workerId,
              workerName: worker.full_name,
              district: zone.name,
              distanceKm: parseFloat(dist.toFixed(2)),
              timestamp: new Date(),
              severity,
            };
            setBreachAlerts((prev) => [alert, ...prev].slice(0, 50));
            toast.error(`🚨 BREACH: ${worker.full_name} left ${zone.name} (${dist.toFixed(1)}km away)`, {
              duration: 8000,
            });
            // Push notification
            sendPushNotification(
              `Boundary Breach: ${worker.full_name}`,
              `Left ${zone.name} — ${dist.toFixed(1)}km from center`,
              severity
            );
          }
        }
      });

      workerZoneStateRef.current.set(workerId, currentZones);
    },
    [workers, geoFenceZones]
  );

  // Simulate live GPS movement
  const simulateMovement = useCallback(() => {
    if (!leafletMap.current) return;
    const map = leafletMap.current;

    markersRef.current.forEach((marker, workerId) => {
      const pos = marker.getLatLng();
      const drift = Math.random() > 0.92 ? 0.05 : 0.008;
      const newLat = pos.lat + (Math.random() - 0.5) * drift;
      const newLng = pos.lng + (Math.random() - 0.5) * drift;

      marker.setLatLng([newLat, newLng]);

      const positions = positionsRef.current.get(workerId) || [];
      positions.push({ workerId, lat: newLat, lng: newLng, timestamp: Date.now(), accuracy: Math.random() * 15 + 5 });
      if (positions.length > 20) positions.shift();
      positionsRef.current.set(workerId, positions);

      const trail = trailsRef.current.get(workerId);
      const latlngs = positions.map((p) => [p.lat, p.lng] as L.LatLngTuple);
      if (trail) {
        trail.setLatLngs(latlngs);
      } else {
        const worker = workers.find((w) => w.id === workerId);
        const color = worker?.status === "active" ? "#00cc6640" : "#f59e0b40";
        const newTrail = L.polyline(latlngs, { color, weight: 2, dashArray: "4 4" }).addTo(map);
        trailsRef.current.set(workerId, newTrail);
      }

      checkGeoFences(workerId, newLat, newLng);
    });

    setLastUpdate(new Date());
  }, [workers, checkGeoFences]);

  const startTracking = () => {
    setTracking(true);
    toast.success("Live GPS tracking activated with geo-fence monitoring");
    intervalRef.current = setInterval(simulateMovement, 3000);

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
    trailsRef.current.forEach((trail) => trail.remove());
    trailsRef.current.clear();
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // Push notification toggle
  const togglePush = async () => {
    if (pushEnabled) {
      setPushEnabled(false);
      toast.info("Push notifications disabled");
    } else {
      const granted = await requestNotificationPermission();
      setPushEnabled(granted);
      if (granted) toast.success("Push notifications enabled for breach alerts");
      else toast.error("Notification permission denied");
    }
  };

  // Geo-fence editor handlers
  const openAddZone = () => {
    setEditingZone(null);
    setZoneForm({ name: "", lat: "", lng: "", radiusKm: "5", district: "", type: "booth" });
    setEditDialogOpen(true);
  };

  const openEditZone = (zone: GeoFenceZone) => {
    setEditingZone(zone);
    setZoneForm({
      name: zone.name,
      lat: zone.center[0].toString(),
      lng: zone.center[1].toString(),
      radiusKm: zone.radiusKm.toString(),
      district: zone.district,
      type: zone.type,
    });
    setEditDialogOpen(true);
  };

  const saveZone = () => {
    const lat = parseFloat(zoneForm.lat);
    const lng = parseFloat(zoneForm.lng);
    const radius = parseFloat(zoneForm.radiusKm);
    if (!zoneForm.name || isNaN(lat) || isNaN(lng) || isNaN(radius) || radius <= 0) {
      toast.error("Please fill all fields correctly");
      return;
    }
    const newZone: GeoFenceZone = {
      id: editingZone?.id || `gf-custom-${Date.now()}`,
      name: zoneForm.name,
      center: [lat, lng],
      radiusKm: radius,
      district: zoneForm.district || "custom",
      type: zoneForm.type,
    };
    if (editingZone) {
      setGeoFenceZones((prev) => prev.map((z) => (z.id === editingZone.id ? newZone : z)));
      toast.success(`Updated zone: ${newZone.name}`);
    } else {
      setGeoFenceZones((prev) => [...prev, newZone]);
      toast.success(`Added zone: ${newZone.name}`);
    }
    setEditDialogOpen(false);
  };

  const deleteZone = (zoneId: string) => {
    setGeoFenceZones((prev) => prev.filter((z) => z.id !== zoneId));
    toast.success("Geo-fence zone deleted");
  };

  // Route optimization
  const showOptimizedRoute = (workerId: string) => {
    const map = leafletMap.current;
    if (!map) return;

    // Clear previous route
    if (routeLayerRef.current) { routeLayerRef.current.remove(); routeLayerRef.current = null; }
    routeMarkersRef.current.forEach((m) => m.remove());
    routeMarkersRef.current = [];

    const worker = workers.find((w) => w.id === workerId);
    if (!worker) return;

    // Get worker current position
    const marker = markersRef.current.get(workerId);
    if (!marker) return;
    const workerPos: [number, number] = [marker.getLatLng().lat, marker.getLatLng().lng];

    // Find booth zones in the worker's district
    const district = worker.district?.toLowerCase() || "";
    const boothZones = geoFenceZones.filter(
      (z) => z.type === "booth" && z.district.toLowerCase().includes(district)
    );

    if (boothZones.length === 0) {
      // If no district-specific booths, use all booth zones
      const allBooths = geoFenceZones.filter((z) => z.type === "booth");
      if (allBooths.length === 0) { toast.info("No booth zones to route to"); return; }
      boothZones.push(...allBooths);
    }

    const points: [number, number][] = [workerPos, ...boothZones.map((z) => z.center)];
    const optimized = optimizeRoute(points);

    // Calculate total distance
    let totalDist = 0;
    for (let i = 1; i < optimized.length; i++) {
      totalDist += haversineDistance(optimized[i - 1][0], optimized[i - 1][1], optimized[i][0], optimized[i][1]);
    }

    // Draw route
    const routeLine = L.polyline(optimized, {
      color: "#10b981",
      weight: 3,
      opacity: 0.8,
      dashArray: "8 6",
    }).addTo(map);
    routeLayerRef.current = routeLine;

    // Add numbered markers for stops
    optimized.forEach((pt, idx) => {
      if (idx === 0) return; // Skip worker position
      const stopIcon = L.divIcon({
        className: "route-stop",
        html: `<div style="width:20px;height:20px;border-radius:50%;background:#10b981;color:#000;font-size:10px;font-weight:bold;display:flex;align-items:center;justify-content:center;border:2px solid #0d9668;">${idx}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      const m = L.marker(pt, { icon: stopIcon }).addTo(map);
      m.bindTooltip(`Stop ${idx}: ${boothZones[idx - 1]?.name || "Waypoint"}`, { className: "dark-tooltip" });
      routeMarkersRef.current.push(m);
    });

    map.fitBounds(routeLine.getBounds().pad(0.2));
    setShowRouteFor(workerId);
    toast.success(`Optimized route: ${boothZones.length} stops, ${totalDist.toFixed(1)}km total`);
  };

  const clearRoute = () => {
    if (routeLayerRef.current) { routeLayerRef.current.remove(); routeLayerRef.current = null; }
    routeMarkersRef.current.forEach((m) => m.remove());
    routeMarkersRef.current = [];
    setShowRouteFor(null);
  };

  const activeCount = workers.filter((w) => w.status === "active").length;
  const criticalBreaches = breachAlerts.filter((b) => b.severity === "critical").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
            GPS <span className="text-primary">TRACKING</span>
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Real-time tracking · geo-fence attendance · breach alerts · route optimization
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tracking && (
            <Badge variant="outline" className="font-mono text-[10px] border-primary text-primary animate-pulse">
              <Radio className="w-3 h-3 mr-1" /> LIVE
            </Badge>
          )}
          {criticalBreaches > 0 && (
            <Badge variant="destructive" className="font-mono text-[10px] animate-pulse">
              <ShieldAlert className="w-3 h-3 mr-1" /> {criticalBreaches} CRITICAL
            </Badge>
          )}
          <Button onClick={togglePush} variant="outline" size="sm" className="font-mono text-[10px] uppercase">
            {pushEnabled ? <Bell className="w-3 h-3 mr-1" /> : <BellOff className="w-3 h-3 mr-1" />}
            {pushEnabled ? "Push On" : "Push Off"}
          </Button>
          <Button onClick={() => setShowGeoFences(!showGeoFences)} variant="outline" size="sm" className="font-mono text-[10px] uppercase">
            <Eye className="w-3 h-3 mr-1" /> {showGeoFences ? "Hide" : "Show"} Fences
          </Button>
          <Button onClick={tracking ? stopTracking : startTracking} variant={tracking ? "destructive" : "default"} className="font-mono text-xs uppercase tracking-wider">
            <Satellite className="w-4 h-4 mr-1" />
            {tracking ? "Stop Tracking" : "Start Live GPS"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
          <CheckCircle className="w-4 h-4 text-primary" />
          <div>
            <p className="text-lg font-bold font-mono text-foreground">
              {attendanceLog.filter((a) => a.event === "entered").length}
            </p>
            <p className="text-[10px] font-mono text-muted-foreground uppercase">Check-ins</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-destructive" />
          <div>
            <p className="text-lg font-bold font-mono text-foreground">{breachAlerts.length}</p>
            <p className="text-[10px] font-mono text-muted-foreground uppercase">Breaches</p>
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

      {/* Tabs */}
      <div className="flex gap-1 bg-card border border-border rounded-lg p-1 overflow-x-auto">
        {(["map", "attendance", "breaches", "geofence", "routes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 min-w-[80px] px-3 py-2 rounded font-mono text-xs uppercase tracking-wider transition-colors ${
              activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {tab === "map" && <MapPin className="w-3 h-3 inline mr-1" />}
            {tab === "attendance" && <CheckCircle className="w-3 h-3 inline mr-1" />}
            {tab === "breaches" && <ShieldAlert className="w-3 h-3 inline mr-1" />}
            {tab === "geofence" && <Navigation className="w-3 h-3 inline mr-1" />}
            {tab === "routes" && <Route className="w-3 h-3 inline mr-1" />}
            {tab === "geofence" ? "Geo-Fence" : tab} {tab === "breaches" && breachAlerts.length > 0 ? `(${breachAlerts.length})` : ""}
          </button>
        ))}
      </div>

      {/* Map Tab */}
      {activeTab === "map" && (
        <>
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
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#00cc66" }} /><span>Active</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#f59e0b" }} /><span>On Leave</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ef4444" }} /><span>Inactive</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full border" style={{ borderColor: "#3b82f6" }} /><span>District Fence</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full border border-dashed" style={{ borderColor: "#f59e0b" }} /><span>Booth Fence</span></div>
            <div className="flex items-center gap-1.5"><div className="w-8 h-0 border-t border-dashed" style={{ borderColor: "#10b981" }} /><span>Optimized Route</span></div>
          </div>
        </>
      )}

      {/* Attendance Tab */}
      {activeTab === "attendance" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-mono text-sm font-bold text-foreground uppercase tracking-wider">Geo-Fence Attendance Log</h3>
            <p className="text-[10px] font-mono text-muted-foreground mt-1">Auto-detected check-ins/outs when workers enter or exit geo-fenced zones</p>
          </div>
          <div className="max-h-[500px] overflow-auto">
            {attendanceLog.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm font-mono text-muted-foreground">No attendance events yet</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-1">Start tracking to see auto check-in/out events</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/30 sticky top-0">
                  <tr className="text-[10px] font-mono text-muted-foreground uppercase">
                    <th className="text-left p-3">Time</th>
                    <th className="text-left p-3">Worker</th>
                    <th className="text-left p-3">Zone</th>
                    <th className="text-left p-3">Event</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceLog.map((record, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/20">
                      <td className="p-3 text-xs font-mono text-muted-foreground">{record.timestamp.toLocaleTimeString()}</td>
                      <td className="p-3 text-xs font-mono text-foreground">{record.workerName}</td>
                      <td className="p-3 text-xs font-mono text-muted-foreground">{record.zone}</td>
                      <td className="p-3">
                        <Badge
                          variant={record.event === "entered" ? "default" : "outline"}
                          className={`font-mono text-[10px] ${record.event === "entered" ? "bg-primary/20 text-primary border-primary/30" : "text-muted-foreground"}`}
                        >
                          {record.event === "entered" ? "✅ ENTERED" : "↩ EXITED"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Breaches Tab */}
      {activeTab === "breaches" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-mono text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-destructive" /> Boundary Breach Alerts
            </h3>
            <p className="text-[10px] font-mono text-muted-foreground mt-1">Real-time alerts with push notifications when workers leave assigned boundaries</p>
          </div>
          <div className="max-h-[500px] overflow-auto">
            {breachAlerts.length === 0 ? (
              <div className="text-center py-16">
                <ShieldAlert className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm font-mono text-muted-foreground">No boundary breaches detected</p>
              </div>
            ) : (
              <div className="space-y-2 p-3">
                {breachAlerts.map((alert) => (
                  <div key={alert.id} className={`border rounded-lg p-3 ${alert.severity === "critical" ? "border-destructive/50 bg-destructive/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`w-4 h-4 ${alert.severity === "critical" ? "text-destructive" : "text-yellow-500"}`} />
                        <span className="font-mono text-xs font-bold text-foreground">{alert.workerName}</span>
                        <Badge variant="outline" className={`font-mono text-[9px] ${alert.severity === "critical" ? "border-destructive text-destructive" : "border-yellow-500 text-yellow-500"}`}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">{alert.timestamp.toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground mt-1">
                      Left <span className="text-foreground">{alert.district}</span> — now <span className="text-foreground">{alert.distanceKm}km</span> from boundary center
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Geo-Fence Editor Tab */}
      {activeTab === "geofence" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-mono text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Navigation className="w-4 h-4 text-primary" /> Geo-Fence Manager
              </h3>
              <p className="text-[10px] font-mono text-muted-foreground mt-1">Create, edit, and delete custom geo-fence zones</p>
            </div>
            <Button onClick={openAddZone} size="sm" className="font-mono text-xs uppercase">
              <Plus className="w-3 h-3 mr-1" /> Add Zone
            </Button>
          </div>
          <div className="max-h-[500px] overflow-auto">
            <table className="w-full">
              <thead className="bg-muted/30 sticky top-0">
                <tr className="text-[10px] font-mono text-muted-foreground uppercase">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">District</th>
                  <th className="text-left p-3">Center</th>
                  <th className="text-left p-3">Radius</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {geoFenceZones.map((zone) => (
                  <tr key={zone.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-3 text-xs font-mono text-foreground">{zone.name}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={`font-mono text-[10px] ${zone.type === "district" ? "border-blue-500 text-blue-500" : "border-yellow-500 text-yellow-500"}`}>
                        {zone.type.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs font-mono text-muted-foreground">{zone.district}</td>
                    <td className="p-3 text-[10px] font-mono text-muted-foreground">{zone.center[0].toFixed(3)}, {zone.center[1].toFixed(3)}</td>
                    <td className="p-3 text-xs font-mono text-foreground">{zone.radiusKm}km</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditZone(zone)} className="h-7 w-7 p-0">
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteZone(zone.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Routes Tab */}
      {activeTab === "routes" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-mono text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Route className="w-4 h-4 text-primary" /> Route Optimization
              </h3>
              <p className="text-[10px] font-mono text-muted-foreground mt-1">Calculate the most efficient path between assigned booths for each worker</p>
            </div>
            {showRouteFor && (
              <Button onClick={clearRoute} variant="outline" size="sm" className="font-mono text-xs">
                Clear Route
              </Button>
            )}
          </div>
          <div className="max-h-[500px] overflow-auto">
            {workers.length === 0 ? (
              <div className="text-center py-16">
                <Route className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm font-mono text-muted-foreground">No workers to optimize routes for</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/30 sticky top-0">
                  <tr className="text-[10px] font-mono text-muted-foreground uppercase">
                    <th className="text-left p-3">Worker</th>
                    <th className="text-left p-3">District</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {workers.filter((w) => w.status === "active").map((worker) => (
                    <tr key={worker.id} className={`border-t border-border hover:bg-muted/20 ${showRouteFor === worker.id ? "bg-primary/5" : ""}`}>
                      <td className="p-3 text-xs font-mono text-foreground">{worker.full_name}</td>
                      <td className="p-3 text-xs font-mono text-muted-foreground">{worker.district || "N/A"}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="font-mono text-[10px] border-primary/50 text-primary">ACTIVE</Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant={showRouteFor === worker.id ? "secondary" : "default"}
                          onClick={() => {
                            if (showRouteFor === worker.id) clearRoute();
                            else { showOptimizedRoute(worker.id); setActiveTab("map"); }
                          }}
                          className="font-mono text-[10px] uppercase"
                        >
                          <Route className="w-3 h-3 mr-1" />
                          {showRouteFor === worker.id ? "Active" : "Optimize"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Geo-Fence Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm uppercase tracking-wider">
              {editingZone ? "Edit Geo-Fence Zone" : "Add Geo-Fence Zone"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1">Zone Name</label>
              <Input value={zoneForm.name} onChange={(e) => setZoneForm((f) => ({ ...f, name: e.target.value }))} className="font-mono text-xs" placeholder="e.g. North Booth B" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1">Latitude</label>
                <Input value={zoneForm.lat} onChange={(e) => setZoneForm((f) => ({ ...f, lat: e.target.value }))} className="font-mono text-xs" placeholder="28.7041" />
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1">Longitude</label>
                <Input value={zoneForm.lng} onChange={(e) => setZoneForm((f) => ({ ...f, lng: e.target.value }))} className="font-mono text-xs" placeholder="77.1025" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1">Radius (km)</label>
                <Input value={zoneForm.radiusKm} onChange={(e) => setZoneForm((f) => ({ ...f, radiusKm: e.target.value }))} className="font-mono text-xs" placeholder="5" />
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1">District</label>
                <Input value={zoneForm.district} onChange={(e) => setZoneForm((f) => ({ ...f, district: e.target.value }))} className="font-mono text-xs" placeholder="north" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1">Type</label>
              <div className="flex gap-2">
                {(["booth", "district"] as const).map((t) => (
                  <Button key={t} variant={zoneForm.type === t ? "default" : "outline"} size="sm" onClick={() => setZoneForm((f) => ({ ...f, type: t }))} className="font-mono text-[10px] uppercase flex-1">
                    {t}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="font-mono text-xs">Cancel</Button>
            <Button onClick={saveZone} className="font-mono text-xs">{editingZone ? "Update" : "Create"} Zone</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
