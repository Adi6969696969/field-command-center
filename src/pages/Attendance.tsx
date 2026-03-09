import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, Users, CheckCircle, XCircle, AlertTriangle, Navigation, UserCheck, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface AttendanceRecord {
  id: string;
  worker_id: string;
  date: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  is_gps_verified: boolean;
  notes: string | null;
  marked_by: string | null;
  workers?: { full_name: string; district: string | null; booth_assignment: string | null };
}

interface Worker {
  id: string;
  full_name: string;
  district: string | null;
  booth_assignment: string | null;
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  present: { label: "Present", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle },
  absent: { label: "Absent", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
  on_leave: { label: "On Leave", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Calendar },
  half_day: { label: "Half Day", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Clock },
  late: { label: "Late", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: AlertTriangle },
};

const PIE_COLORS = ["hsl(var(--primary))", "#ef4444", "#3b82f6", "#f59e0b", "#f97316"];

export default function Attendance() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [gpsPosition, setGpsPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    fetchData();
    // Try to get GPS position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGpsPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.log("GPS not available")
      );
    }
  }, [selectedDate]);

  useEffect(() => {
    const channel = supabase
      .channel("attendance-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    const [attendanceRes, workersRes] = await Promise.all([
      supabase
        .from("attendance")
        .select("*, workers(full_name, district, booth_assignment)")
        .eq("date", selectedDate),
      supabase.from("workers").select("id, full_name, district, booth_assignment, status").eq("status", "active"),
    ]);
    setRecords((attendanceRes.data as AttendanceRecord[]) || []);
    setWorkers(workersRes.data || []);
    setLoading(false);
  };

  const markAttendance = async (workerId: string, status: string) => {
    if (!user) return;
    setCheckingIn(workerId);
    try {
      const existing = records.find((r) => r.worker_id === workerId);
      if (existing) {
        await supabase.from("attendance").update({ status, marked_by: user.id }).eq("id", existing.id);
      } else {
        await supabase.from("attendance").insert({
          worker_id: workerId,
          date: selectedDate,
          status,
          check_in_time: status === "present" || status === "late" ? new Date().toISOString() : null,
          check_in_lat: gpsPosition?.lat ?? null,
          check_in_lng: gpsPosition?.lng ?? null,
          is_gps_verified: !!gpsPosition,
          marked_by: user.id,
        });
      }
      toast({ title: "Attendance updated", description: `Marked as ${STATUS_CONFIG[status]?.label || status}` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setCheckingIn(null);
  };

  const handleCheckOut = async (record: AttendanceRecord) => {
    if (!user) return;
    try {
      await supabase.from("attendance").update({
        check_out_time: new Date().toISOString(),
        check_out_lat: gpsPosition?.lat ?? null,
        check_out_lng: gpsPosition?.lng ?? null,
      }).eq("id", record.id);
      toast({ title: "Checked out", description: "Check-out time recorded" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const districts = [...new Set(workers.map((w) => w.district).filter(Boolean))] as string[];
  const filteredWorkers = filterDistrict === "all" ? workers : workers.filter((w) => w.district === filterDistrict);

  // Stats
  const presentCount = records.filter((r) => r.status === "present" || r.status === "late" || r.status === "half_day").length;
  const absentCount = workers.length - records.length + records.filter((r) => r.status === "absent").length;
  const leaveCount = records.filter((r) => r.status === "on_leave").length;
  const gpsVerified = records.filter((r) => r.is_gps_verified).length;
  const attendanceRate = workers.length > 0 ? Math.round((presentCount / workers.length) * 100) : 0;

  // Chart data
  const pieData = [
    { name: "Present", value: presentCount },
    { name: "Absent", value: Math.max(0, absentCount) },
    { name: "On Leave", value: leaveCount },
    { name: "Half Day", value: records.filter((r) => r.status === "half_day").length },
    { name: "Late", value: records.filter((r) => r.status === "late").length },
  ].filter((d) => d.value > 0);

  const districtData = districts.map((d) => {
    const dWorkers = workers.filter((w) => w.district === d);
    const dRecords = records.filter((r) => {
      const w = workers.find((w) => w.id === r.worker_id);
      return w?.district === d;
    });
    const dPresent = dRecords.filter((r) => ["present", "late", "half_day"].includes(r.status)).length;
    return { district: d, total: dWorkers.length, present: dPresent, rate: dWorkers.length > 0 ? Math.round((dPresent / dWorkers.length) * 100) : 0 };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-primary" />
            ATTENDANCE SYSTEM
          </h1>
          <p className="text-sm font-mono text-muted-foreground mt-1">
            Manual + GPS-verified attendance tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="font-mono text-sm w-44 bg-card border-border"
          />
          {gpsPosition && (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono text-xs">
              <Navigation className="w-3 h-3 mr-1" /> GPS Active
            </Badge>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Workers", value: workers.length, icon: Users, color: "text-primary" },
          { label: "Present", value: presentCount, icon: CheckCircle, color: "text-emerald-400" },
          { label: "Absent", value: Math.max(0, absentCount), icon: XCircle, color: "text-red-400" },
          { label: "On Leave", value: leaveCount, icon: Calendar, color: "text-blue-400" },
          { label: "GPS Verified", value: gpsVerified, icon: MapPin, color: "text-amber-400" },
        ].map((s) => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-mono font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] font-mono text-muted-foreground uppercase">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="mark" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="mark" className="font-mono text-xs">Mark Attendance</TabsTrigger>
          <TabsTrigger value="records" className="font-mono text-xs">Records</TabsTrigger>
          <TabsTrigger value="analytics" className="font-mono text-xs">Analytics</TabsTrigger>
        </TabsList>

        {/* Mark Attendance Tab */}
        <TabsContent value="mark" className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={filterDistrict} onValueChange={setFilterDistrict}>
              <SelectTrigger className="w-48 font-mono text-xs bg-card border-border">
                <SelectValue placeholder="Filter by District" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Districts</SelectItem>
                {districts.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="font-mono text-xs border-border">
              {attendanceRate}% Attendance Rate
            </Badge>
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="font-mono text-xs">Worker</TableHead>
                    <TableHead className="font-mono text-xs">District</TableHead>
                    <TableHead className="font-mono text-xs">Booth</TableHead>
                    <TableHead className="font-mono text-xs">Status</TableHead>
                    <TableHead className="font-mono text-xs">Check In</TableHead>
                    <TableHead className="font-mono text-xs">Check Out</TableHead>
                    <TableHead className="font-mono text-xs">GPS</TableHead>
                    <TableHead className="font-mono text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground font-mono text-sm">Loading...</TableCell></TableRow>
                  ) : filteredWorkers.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground font-mono text-sm">No active workers found</TableCell></TableRow>
                  ) : (
                    filteredWorkers.map((worker) => {
                      const record = records.find((r) => r.worker_id === worker.id);
                      const status = record?.status || "unmarked";
                      const cfg = STATUS_CONFIG[status];
                      return (
                        <TableRow key={worker.id} className="border-border">
                          <TableCell className="font-mono text-sm text-foreground">{worker.full_name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{worker.district || "—"}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{worker.booth_assignment || "—"}</TableCell>
                          <TableCell>
                            {cfg ? (
                              <Badge variant="outline" className={`${cfg.color} font-mono text-[10px]`}>
                                <cfg.icon className="w-3 h-3 mr-1" /> {cfg.label}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-border text-muted-foreground font-mono text-[10px]">Unmarked</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {record?.check_in_time ? format(new Date(record.check_in_time), "HH:mm") : "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {record?.check_out_time ? format(new Date(record.check_out_time), "HH:mm") : "—"}
                          </TableCell>
                          <TableCell>
                            {record?.is_gps_verified ? (
                              <MapPin className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isAdmin ? (
                              <div className="flex gap-1 flex-wrap">
                                {["present", "absent", "late", "on_leave", "half_day"].map((s) => (
                                  <Button
                                    key={s}
                                    size="sm"
                                    variant={status === s ? "default" : "outline"}
                                    className="font-mono text-[10px] h-6 px-2"
                                    disabled={checkingIn === worker.id}
                                    onClick={() => markAttendance(worker.id, s)}
                                  >
                                    {STATUS_CONFIG[s].label}
                                  </Button>
                                ))}
                                {record && record.check_in_time && !record.check_out_time && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="font-mono text-[10px] h-6 px-2 border-warning/30 text-warning"
                                    onClick={() => handleCheckOut(record)}
                                  >
                                    Check Out
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <span className="font-mono text-[10px] text-muted-foreground">Admin only</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Records Tab */}
        <TabsContent value="records" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm text-foreground">Attendance Records — {format(new Date(selectedDate), "MMM dd, yyyy")}</CardTitle>
              <CardDescription className="font-mono text-xs">{records.length} records for this date</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="font-mono text-xs">Worker</TableHead>
                    <TableHead className="font-mono text-xs">Status</TableHead>
                    <TableHead className="font-mono text-xs">Check In</TableHead>
                    <TableHead className="font-mono text-xs">Check Out</TableHead>
                    <TableHead className="font-mono text-xs">Duration</TableHead>
                    <TableHead className="font-mono text-xs">GPS Verified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => {
                    const cfg = STATUS_CONFIG[r.status];
                    const duration = r.check_in_time && r.check_out_time
                      ? `${Math.round((new Date(r.check_out_time).getTime() - new Date(r.check_in_time).getTime()) / 3600000 * 10) / 10}h`
                      : "—";
                    return (
                      <TableRow key={r.id} className="border-border">
                        <TableCell className="font-mono text-sm text-foreground">{r.workers?.full_name || "Unknown"}</TableCell>
                        <TableCell>
                          {cfg && (
                            <Badge variant="outline" className={`${cfg.color} font-mono text-[10px]`}>
                              {cfg.label}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {r.check_in_time ? format(new Date(r.check_in_time), "HH:mm:ss") : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {r.check_out_time ? format(new Date(r.check_out_time), "HH:mm:ss") : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-foreground">{duration}</TableCell>
                        <TableCell>
                          {r.is_gps_verified ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono text-[10px]">
                              <MapPin className="w-3 h-3 mr-1" /> Verified
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs font-mono">Manual</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {records.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-mono text-sm">No records for this date</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-mono text-sm text-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Status Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontFamily: "monospace", fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-mono text-sm text-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> District Attendance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={districtData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="district" tick={{ fill: "hsl(var(--muted-foreground))", fontFamily: "monospace", fontSize: 10 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontFamily: "monospace", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontFamily: "monospace", fontSize: 12 }} />
                      <Bar dataKey="present" fill="hsl(var(--primary))" name="Present" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="total" fill="hsl(var(--muted))" name="Total" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
