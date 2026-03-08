import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, FileText, Download, Brain, FileDown } from "lucide-react";
import jsPDF from "jspdf";

/** Simple markdown → HTML converter for the brief display */
function renderMarkdown(md: string): string {
  return md
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="brief-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="brief-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="brief-h1">$1</h1>')
    // Bold & italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="brief-hr" />')
    // Bullet lists (- or *)
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+\.\s+(.+)$/gm, '<li class="brief-ol">$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="brief-ul">$1</ul>')
    // Paragraphs — wrap non-tag lines with content
    .replace(/^(?!<[hulo]|<hr|<li)(.+)$/gm, '<p class="brief-p">$1</p>')
    // Clean up empty paragraphs
    .replace(/<p class="brief-p">\s*<\/p>/g, "");
}

/** Strip markdown to clean plain text for PDF */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^[\-\*]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^---$/gm, "")
    .trim();
}

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
            messages: [{
              role: "user",
              content: `Generate a comprehensive weekly intelligence briefing report. Use clean, professional language without any special symbols, asterisks for decoration, or unnecessary formatting characters.

Structure the report with these sections using markdown headers:

## Executive Summary
Provide 3-4 key highlights in clear sentences.

## Operational Status
- Total workforce count and active/inactive breakdown
- Task completion rates and pending workload
- Performance trends across the team

## District-Level Analysis
Break down performance metrics by district with specific numbers.

## Sentiment Analysis
Summarize ground-level feedback trends, top issues raised, and overall sentiment.

## Risk Assessment
Identify 3-5 critical risk areas with brief explanations.

## Strategic Recommendations
List 5 actionable recommendations for the coming week as numbered items.

## Readiness Score
Provide an overall campaign readiness percentage with a one-line justification.

Rules:
- Use clean bullet points (- ) for lists
- Use numbered lists (1. 2. 3.) for recommendations
- Bold important metrics with **value**
- Do NOT use decorative symbols like ★ ✦ ⚡ 🔥 or similar
- Do NOT use triple asterisks or excessive formatting
- Keep language professional and concise
- Use actual numbers from the data provided`,
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

    const addPage = () => { doc.addPage(); y = 20; };
    const checkPage = (needed: number) => { if (y + needed > 275) addPage(); };

    // Title block
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(0, 180, 90);
    doc.text("INTEL BRIEF", margin, y);
    y += 7;
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`, margin, y);
    y += 4;
    doc.text("FieldOps Political Field Intelligence System", margin, y);
    y += 5;
    doc.setDrawColor(0, 180, 90);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    const cleanLines = stripMarkdown(brief).split("\n");

    for (const raw of cleanLines) {
      const line = raw.trim();
      if (!line) { y += 3; continue; }

      // Detect original headers from the brief
      const origLine = brief.split("\n").find(l => l.replace(/^#{1,3}\s+/, "").trim() === line);
      const isH1 = origLine?.startsWith("# ");
      const isH2 = origLine?.startsWith("## ");
      const isH3 = origLine?.startsWith("### ");

      if (isH1) {
        checkPage(14);
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(0, 180, 90);
        doc.text(line, margin, y);
        y += 9;
      } else if (isH2) {
        checkPage(12);
        y += 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(0, 140, 70);
        doc.text(line, margin, y);
        y += 2;
        doc.setDrawColor(0, 140, 70);
        doc.setLineWidth(0.3);
        doc.line(margin, y, margin + doc.getTextWidth(line), y);
        y += 6;
      } else if (isH3) {
        checkPage(10);
        y += 3;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(60, 60, 60);
        doc.text(line, margin, y);
        y += 6;
      } else if (line.startsWith("•")) {
        checkPage(8);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        const wrapped = doc.splitTextToSize(line, maxWidth - 6);
        doc.text(wrapped, margin + 4, y);
        y += wrapped.length * 5;
      } else {
        checkPage(8);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        const wrapped = doc.splitTextToSize(line, maxWidth);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 5;
      }
    }

    // Footer on every page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`FieldOps Intel Brief — Page ${i} of ${pageCount}`, margin, 290);
      doc.text("CLASSIFIED — FOR INTERNAL USE ONLY", pageWidth - margin - 55, 290);
    }

    doc.save(`intel-brief-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Brief exported as PDF");
  };

  const renderedHtml = useMemo(() => renderMarkdown(brief), [brief]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wider text-foreground">
            INTEL <span className="text-primary">BRIEF</span>
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
        <div className="bg-card border border-border rounded-lg p-8">
          <div
            className="intel-brief-content"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </div>
      ) : (
        <div className="text-center py-20">
          <FileText className="w-16 h-16 mx-auto text-primary/40 mb-4" />
          <p className="text-sm font-mono text-muted-foreground">Click "Generate Brief" to create an AI-powered intelligence report</p>
          <p className="text-[10px] font-mono text-muted-foreground mt-1">Uses real-time operational data for analysis</p>
        </div>
      )}
    </div>
  );
}
