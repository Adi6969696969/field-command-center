import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, UserCircle, Trash2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

const STATUS_STYLES: Record<string, string> = {
  active: "bg-primary/10 text-primary border-primary/30",
  inactive: "bg-muted text-muted-foreground border-border",
  suspended: "bg-destructive/10 text-destructive border-destructive/30",
  on_leave: "bg-warning/10 text-warning border-warning/30",
};

export default function Workers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "", booth_assignment: "",
    district: "", constituency: "", skills: "", experience_level: "1",
    status: "active" as string,
  });

  const fetchWorkers = async () => {
    const { data, error } = await supabase
      .from("workers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setWorkers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchWorkers(); }, []);

  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreating(true);

    const workerData = {
      full_name: form.full_name,
      phone: form.phone || null,
      email: form.email || null,
      booth_assignment: form.booth_assignment || null,
      district: form.district || null,
      constituency: form.constituency || null,
      skills: form.skills ? form.skills.split(",").map((s) => s.trim()) : [],
      experience_level: parseInt(form.experience_level),
      status: form.status,
    };

    // If email is provided, use edge function to auto-create login account
    if (form.email) {
      try {
        const { data, error } = await supabase.functions.invoke("create-worker-account", {
          body: workerData,
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.accountCreated) {
          toast.success(`Worker added! Login account created for ${form.email}. Temporary password: ${data.tempPassword}`, { duration: 15000 });
        } else {
          toast.success(data?.message || "Worker added and linked to existing account.");
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to create worker account");
        setCreating(false);
        return;
      }
    } else {
      // No email — create worker without auth account
      const { error } = await supabase.from("workers").insert([{
        ...workerData,
        status: workerData.status as "active" | "inactive" | "on_leave" | "suspended",
        created_by: user.id,
      }]);
      if (error) {
        toast.error(error.message);
        setCreating(false);
        return;
      }
      toast.success("Worker added to roster (no login account — no email provided).");
    }

    setDialogOpen(false);
    setForm({ full_name: "", phone: "", email: "", booth_assignment: "", district: "", constituency: "", skills: "", experience_level: "1", status: "active" });
    fetchWorkers();
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("workers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Worker removed.");
      fetchWorkers();
    }
  };

  const filtered = workers.filter((w) =>
    w.full_name.toLowerCase().includes(search.toLowerCase()) ||
    w.district?.toLowerCase().includes(search.toLowerCase()) ||
    w.booth_assignment?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
            FIELD <span className="text-primary">WORKERS</span>
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            {workers.length} operatives registered
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="font-mono text-xs uppercase tracking-wider">
              <Plus className="w-4 h-4 mr-1" /> Add Worker
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="font-mono text-sm uppercase tracking-wider text-foreground">
                New Operative
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Full Name *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required className="bg-muted border-border font-mono text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-muted border-border font-mono text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-muted border-border font-mono text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">District</Label>
                  <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} className="bg-muted border-border font-mono text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Booth</Label>
                  <Input value={form.booth_assignment} onChange={(e) => setForm({ ...form, booth_assignment: e.target.value })} className="bg-muted border-border font-mono text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Constituency</Label>
                  <Input value={form.constituency} onChange={(e) => setForm({ ...form, constituency: e.target.value })} className="bg-muted border-border font-mono text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-mono uppercase text-muted-foreground">Skills (comma-separated)</Label>
                <Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="canvassing, data entry, logistics" className="bg-muted border-border font-mono text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Experience (1-5)</Label>
                  <Select value={form.experience_level} onValueChange={(v) => setForm({ ...form, experience_level: v })}>
                    <SelectTrigger className="bg-muted border-border font-mono text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="bg-muted border-border font-mono text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" disabled={creating} className="w-full font-mono text-xs uppercase tracking-wider">
                {creating ? "Creating Account..." : "Deploy Operative"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search operatives..."
          className="pl-10 bg-card border-border font-mono text-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
          <span className="ml-2 text-sm font-mono text-muted-foreground">Loading roster...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground font-mono text-sm">
          {workers.length === 0 ? "No operatives registered. Add your first worker." : "No matching operatives found."}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((w) => (
            <div key={w.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4 hover:border-primary/20 transition-colors animate-fade-in">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <UserCircle className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-mono font-semibold text-sm text-foreground truncate">{w.full_name}</p>
                  <Badge variant="outline" className={`text-[10px] font-mono ${STATUS_STYLES[w.status] || ""}`}>
                    {w.status.replace("_", " ")}
                  </Badge>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {[w.district, w.booth_assignment, w.constituency].filter(Boolean).join(" · ") || "No assignment"}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-muted-foreground">
                <div className="text-center">
                  <p className="text-foreground font-semibold">{Number(w.performance_score).toFixed(1)}</p>
                  <p className="text-[9px]">SCORE</p>
                </div>
                <div className="text-center">
                  <p className="text-foreground font-semibold">{w.tasks_completed}</p>
                  <p className="text-[9px]">TASKS</p>
                </div>
                <div className="text-center">
                  <p className="text-foreground font-semibold">Lv.{w.experience_level}</p>
                  <p className="text-[9px]">EXP</p>
                </div>
              </div>
              <button onClick={() => navigate(`/workers/${w.id}`)} className="text-muted-foreground hover:text-accent transition-colors" title="View Profile">
                <Eye className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(w.id)} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
