import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Shield, CheckCircle, XCircle, Lock, Hash, Link2 } from "lucide-react";

interface AuditEntry {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  data_hash: string;
  previous_hash: string | null;
  created_at: string;
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function BlockchainLedger() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [validationResults, setValidationResults] = useState<Map<string, boolean>>(new Map());
  const [validating, setValidating] = useState(false);

  const fetchEntries = async () => {
    const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) toast.error(error.message);
    else setEntries(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, []);

  const logActivity = async (actionType: string, entityType: string, entityId: string, details: any) => {
    if (!user) return;
    const lastEntry = entries[0];
    const previousHash = lastEntry?.data_hash || "GENESIS";
    const payload = JSON.stringify({ actionType, entityType, entityId, details, timestamp: Date.now(), previousHash });
    const dataHash = await sha256(payload);

    const { error } = await supabase.from("audit_log").insert({
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      actor_id: user.id,
      details,
      data_hash: dataHash,
      previous_hash: previousHash,
    });

    if (error) toast.error(error.message);
    else {
      toast.success("Activity logged to ledger");
      fetchEntries();
    }
  };

  const validateChain = async () => {
    setValidating(true);
    const sorted = [...entries].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const results = new Map<string, boolean>();

    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      if (i === 0) {
        results.set(entry.id, entry.previous_hash === null || entry.previous_hash === "GENESIS");
      } else {
        const prevEntry = sorted[i - 1];
        results.set(entry.id, entry.previous_hash === prevEntry.data_hash);
      }
    }

    setValidationResults(results);
    setValidating(false);

    const valid = Array.from(results.values()).every((v) => v);
    if (valid) toast.success("Chain integrity verified ✓");
    else toast.error("Chain integrity compromised!");
  };

  const seedLedger = async () => {
    // Seed from existing workers and tasks
    const [wRes, tRes] = await Promise.all([
      supabase.from("workers").select("id, full_name, created_at").limit(5),
      supabase.from("tasks").select("id, title, created_at").limit(5),
    ]);

    for (const w of (wRes.data || [])) {
      await logActivity("CREATE", "worker", w.id, { name: w.full_name });
    }
    for (const t of (tRes.data || [])) {
      await logActivity("CREATE", "task", t.id, { title: t.title });
    }
    toast.success("Ledger seeded from existing data");
  };

  const validCount = Array.from(validationResults.values()).filter(Boolean).length;
  const invalidCount = Array.from(validationResults.values()).filter((v) => !v).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
            BLOCKCHAIN <span className="text-accent">LEDGER</span>
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">Immutable activity audit trail</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={seedLedger} variant="outline" className="font-mono text-xs uppercase tracking-wider">
            <Hash className="w-4 h-4 mr-1" /> Seed Ledger
          </Button>
          <Button onClick={validateChain} disabled={validating} className="font-mono text-xs uppercase tracking-wider">
            <Shield className="w-4 h-4 mr-1" /> Validate Chain
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Lock className="w-5 h-5 mx-auto text-accent mb-1" />
          <p className="text-xl font-bold font-mono text-foreground">{entries.length}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Total Blocks</p>
        </div>
        <div className="bg-card border border-primary/30 rounded-lg p-3 text-center">
          <CheckCircle className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-xl font-bold font-mono text-primary">{validCount || "—"}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Verified</p>
        </div>
        <div className="bg-card border border-destructive/30 rounded-lg p-3 text-center">
          <XCircle className="w-5 h-5 mx-auto text-destructive mb-1" />
          <p className="text-xl font-bold font-mono text-destructive">{invalidCount || "—"}</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Broken Links</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Link2 className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
          <p className="text-xl font-bold font-mono text-foreground">SHA-256</p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Hash Algorithm</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
          <span className="ml-2 text-sm font-mono text-muted-foreground">Loading ledger...</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <Lock className="w-12 h-12 mx-auto text-accent mb-3" />
          <p className="text-sm font-mono text-muted-foreground">Ledger empty. Click "Seed Ledger" to import existing data.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {entries.map((e, i) => {
            const isValid = validationResults.get(e.id);
            return (
              <div key={e.id} className={`bg-card border rounded-lg p-3 animate-fade-in ${isValid === true ? "border-primary/30" : isValid === false ? "border-destructive/30" : "border-border"}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {isValid === true ? <CheckCircle className="w-4 h-4 text-primary" /> :
                     isValid === false ? <XCircle className="w-4 h-4 text-destructive" /> :
                     <Lock className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] font-mono text-accent border-accent/30">{e.action_type}</Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">{e.entity_type}</Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">Block #{entries.length - i}</span>
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1 truncate" title={e.data_hash}>
                      Hash: {e.data_hash.slice(0, 16)}...{e.data_hash.slice(-8)}
                    </p>
                    {e.previous_hash && (
                      <p className="text-[10px] font-mono text-muted-foreground truncate" title={e.previous_hash}>
                        Prev: {e.previous_hash.slice(0, 16)}...{e.previous_hash.slice(-8)}
                      </p>
                    )}
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{new Date(e.created_at).toLocaleString()}</p>
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
