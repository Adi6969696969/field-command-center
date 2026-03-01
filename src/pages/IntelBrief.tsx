import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, FileText, Download, Brain, FileDown } from "lucide-react";
import jsPDF from "jspdf";

export default function IntelBrief() {
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const [wRes, tRes, fRes] = await Promise.all([
        supabase.from("workers").select("full_name, status, performance_score, tasks_completed, district, experience_level"),
        supabase.from("tasks").select("title, status, priority, district, created_at, completed_at"),
        supabase.from("feedback").select("sentiment, sentiment_score, district, topics, created_at"),
      ]);
      setContext({
        workers: wRes.data || [],
        tasks: tRes.data || [],
        feedback: fRes.data || [],
      });
    };
    load();
  }, []);

  const generateBrief = async () => {
    if (!context) return;
    setLoading(true);
    setBrief("");

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [{
              role: "user",
              content: `Generate a comprehensive weekly intelligence briefing report with the following sections:

## Executive Summary
Key highlights of the week

## Operational Status
- Total workers and their status breakdown
- Task completion rates
- Performance trends

## District-Level Analysis
Performance by district with specific metrics

## Sentiment Analysis
Ground feedback trends, top issues, sentiment distribution

## Risk Assessment
Critical areas, resource gaps, potential problems

## Strategic Recommendations
Top 5 actionable recommendations for the coming week

## Readiness Score
Overall campaign readiness percentage with justification

Format as a clean markdown document. Be specific with numbers from the data provided.`,
            }],
            context,
          }),
        }
      );

      if (!resp.ok || !resp.body) throw new Error("Failed to generate brief");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullText = "";

      while (true) {
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
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setBrief(fullText);
            }
          } catch { textBuffer = line + "\n" + textBuffer; break; }
        }
      }
    } catch (e) {
      toast.error("Brief generation failed");
    } finally {
      setLoading(false);
    }
  };

  const exportBrief = () => {
    const blob = new Blob([brief], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intel-brief-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Brief exported as Markdown");
  };

  const exportPDF = () => {
    if (!brief) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(0, 204, 102);
    doc.text("INTEL BRIEF", margin, y);
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | FieldOps Intelligence`, margin, y);
    y += 4;
    doc.setDrawColor(0, 204, 102);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Body
    doc.setTextColor(40, 40, 40);
    const lines = brief.split("\n");

    for (const line of lines) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }

      if (line.startsWith("## ")) {
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(0, 150, 80);
        doc.text(line.replace("## ", ""), margin, y);
        y += 7;
      } else if (line.startsWith("# ")) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(0, 204, 102);
        doc.text(line.replace("# ", ""), margin, y);
        y += 9;
      } else if (line.startsWith("- ")) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        const wrapped = doc.splitTextToSize(`• ${line.slice(2)}`, maxWidth - 5);
        doc.text(wrapped, margin + 3, y);
        y += wrapped.length * 5;
      } else if (line.trim() === "") {
        y += 3;
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        const wrapped = doc.splitTextToSize(line.replace(/\*\*/g, ""), maxWidth);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 5;
      }
    }

    // Footer on last page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`FieldOps Intel Brief — Page ${i}/${pageCount}`, margin, 290);
    }

    doc.save(`intel-brief-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Brief exported as PDF");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
            INTEL <span className="text-accent">BRIEF</span>
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">AI-generated weekly intelligence report</p>
        </div>
        <div className="flex gap-2">
          {brief && (
            <>
              <Button onClick={exportPDF} variant="outline" className="font-mono text-xs uppercase tracking-wider">
                <FileDown className="w-4 h-4 mr-1" /> PDF
              </Button>
              <Button onClick={exportBrief} variant="outline" className="font-mono text-xs uppercase tracking-wider">
                <Download className="w-4 h-4 mr-1" /> Markdown
              </Button>
            </>
          )}
          <Button onClick={generateBrief} disabled={loading || !context} className="font-mono text-xs uppercase tracking-wider">
            {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Brain className="w-4 h-4 mr-1" />}
            {loading ? "Generating..." : "Generate Brief"}
          </Button>
        </div>
      </div>

      {brief ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="prose prose-invert prose-sm max-w-none font-mono text-foreground">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{brief}</div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20">
          <FileText className="w-16 h-16 mx-auto text-accent mb-4" />
          <p className="text-sm font-mono text-muted-foreground">Click "Generate Brief" to create an AI-powered intelligence report</p>
          <p className="text-[10px] font-mono text-muted-foreground mt-1">Uses real-time operational data for analysis</p>
        </div>
      )}
    </div>
  );
}
