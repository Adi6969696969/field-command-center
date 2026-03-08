import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Bot, Send, Loader2, Sparkles, User } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "Give me a campaign readiness briefing",
  "Analyze worker performance trends",
  "Suggest resource allocation improvements",
  "Generate talking points for booth meetings",
  "Identify high-risk areas needing attention",
];

export default function AICoPilot() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load operational context
  useEffect(() => {
    const loadContext = async () => {
      const [workersRes, tasksRes, feedbackRes] = await Promise.all([
        supabase.from("workers").select("full_name, status, performance_score, tasks_completed, district, experience_level"),
        supabase.from("tasks").select("title, status, priority, district"),
        supabase.from("feedback").select("sentiment, sentiment_score, district, topics"),
      ]);
      setContext({
        workers: workersRes.data || [],
        tasks: tasksRes.data || [],
        feedback: feedbackRes.data || [],
        summary: {
          total_workers: workersRes.data?.length || 0,
          active_workers: workersRes.data?.filter((w) => w.status === "active").length || 0,
          total_tasks: tasksRes.data?.length || 0,
          completed_tasks: tasksRes.data?.filter((t) => t.status === "completed").length || 0,
          avg_sentiment: feedbackRes.data?.length
            ? (feedbackRes.data.reduce((s, f) => s + Number(f.sentiment_score || 0), 0) / feedbackRes.data.length).toFixed(2)
            : "N/A",
        },
      });
    };
    loadContext();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const allMessages = [...messages, userMsg];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
            context,
          }),
        }
      );

      if (resp.status === 429) {
        toast.error("Rate limited. Try again shortly.");
        setIsLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error("AI credits exhausted.");
        setIsLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("Failed to start stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("AI Co-Pilot error.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <div className="mb-4">
        <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
          AI <span className="text-accent">CO-PILOT</span>
        </h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">
          Strategic intelligence assistant • {context?.summary?.total_workers || 0} operatives tracked
        </p>
      </div>

      <div className="flex-1 bg-card border border-border rounded-lg flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <Bot className="w-12 h-12 text-accent mb-4" />
              <p className="text-sm font-mono text-muted-foreground mb-6 text-center">
                FieldOPS AI ready. Ask for strategic insights, campaign analysis, or operational briefings.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="text-left text-xs font-mono px-3 py-2 rounded-md bg-muted border border-border hover:border-accent/30 hover:text-accent transition-colors"
                  >
                    <Sparkles className="w-3 h-3 inline mr-1" />
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                  {m.role === "assistant" && (
                    <div className="w-7 h-7 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-accent" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm font-mono ${
                    m.role === "user"
                      ? "bg-primary/10 border border-primary/30 text-foreground"
                      : "bg-muted border border-border text-foreground"
                  }`}>
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  </div>
                  {m.role === "user" && (
                    <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-accent" />
                  </div>
                  <div className="bg-muted border border-border rounded-lg px-3 py-2">
                    <Loader2 className="w-4 h-4 text-accent animate-spin" />
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t border-border">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for strategic insights..."
              className="bg-muted border-border font-mono text-sm flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()} size="icon" className="shrink-0">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
