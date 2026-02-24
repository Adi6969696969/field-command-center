import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Clock, CheckCircle, AlertCircle, XCircle, Loader2 } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  booth: string | null;
  district: string | null;
  due_date: string | null;
  created_at: string;
  assigned_worker_id: string | null;
}

const STATUS_ICONS: Record<string, any> = {
  pending: Clock,
  assigned: AlertCircle,
  in_progress: Loader2,
  completed: CheckCircle,
  cancelled: XCircle,
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/10 text-info border-info/30",
  high: "bg-warning/10 text-warning border-warning/30",
  critical: "bg-destructive/10 text-destructive border-destructive/30",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/30",
  assigned: "bg-info/10 text-info border-info/30",
  in_progress: "bg-accent/10 text-accent border-accent/30",
  completed: "bg-primary/10 text-primary border-primary/30",
  cancelled: "bg-muted text-muted-foreground",
};

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", priority: "medium", booth: "", district: "", due_date: "",
  });

  const fetchTasks = async () => {
    const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setTasks(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("tasks").insert({
      title: form.title,
      description: form.description || null,
      priority: form.priority as any,
      booth: form.booth || null,
      district: form.district || null,
      due_date: form.due_date || null,
      created_by: user.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Task deployed.");
      setDialogOpen(false);
      setForm({ title: "", description: "", priority: "medium", booth: "", district: "", due_date: "" });
      fetchTasks();
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const update: any = { status };
    if (status === "completed") update.completed_at = new Date().toISOString();
    const { error } = await supabase.from("tasks").update(update).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Status updated.");
      fetchTasks();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
            TASK <span className="text-primary">CONTROL</span>
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            {tasks.length} operations deployed
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="font-mono text-xs uppercase tracking-wider">
              <Plus className="w-4 h-4 mr-1" /> New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="font-mono text-sm uppercase tracking-wider text-foreground">
                Deploy Operation
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <Label className="text-[10px] font-mono uppercase text-muted-foreground">Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="bg-muted border-border font-mono text-sm" />
              </div>
              <div>
                <Label className="text-[10px] font-mono uppercase text-muted-foreground">Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-muted border-border font-mono text-sm" rows={3} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger className="bg-muted border-border font-mono text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">District</Label>
                  <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} className="bg-muted border-border font-mono text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] font-mono uppercase text-muted-foreground">Booth</Label>
                  <Input value={form.booth} onChange={(e) => setForm({ ...form, booth: e.target.value })} className="bg-muted border-border font-mono text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-mono uppercase text-muted-foreground">Due Date</Label>
                <Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="bg-muted border-border font-mono text-sm" />
              </div>
              <Button type="submit" className="w-full font-mono text-xs uppercase tracking-wider">
                Deploy Task
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
          <span className="ml-2 text-sm font-mono text-muted-foreground">Loading operations...</span>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground font-mono text-sm">
          No operations deployed. Create your first task.
        </div>
      ) : (
        <div className="grid gap-3">
          {tasks.map((t) => {
            const StatusIcon = STATUS_ICONS[t.status] || Clock;
            return (
              <div key={t.id} className="bg-card border border-border rounded-lg p-4 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <StatusIcon className={`w-4 h-4 ${t.status === "completed" ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono font-semibold text-sm text-foreground">{t.title}</p>
                      <Badge variant="outline" className={`text-[10px] font-mono ${PRIORITY_STYLES[t.priority]}`}>
                        {t.priority}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] font-mono ${STATUS_STYLES[t.status]}`}>
                        {t.status.replace("_", " ")}
                      </Badge>
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                    )}
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">
                      {[t.district, t.booth].filter(Boolean).join(" · ")}
                      {t.due_date && ` · Due: ${new Date(t.due_date).toLocaleDateString()}`}
                    </p>
                  </div>
                  {t.status !== "completed" && t.status !== "cancelled" && (
                    <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v)}>
                      <SelectTrigger className="w-32 bg-muted border-border font-mono text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="assigned">Assigned</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
