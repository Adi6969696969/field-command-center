import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  variant?: "default" | "primary" | "accent" | "warning" | "destructive";
}

const variantStyles = {
  default: "border-border",
  primary: "border-primary/30 glow-primary",
  accent: "border-accent/30 glow-accent",
  warning: "border-warning/30",
  destructive: "border-destructive/30 glow-destructive",
};

const iconVariantStyles = {
  default: "bg-muted text-foreground",
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

export function StatCard({ label, value, icon: Icon, trend, variant = "default" }: StatCardProps) {
  return (
    <div className={`bg-card border rounded-lg p-4 animate-slide-up ${variantStyles[variant]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold font-mono mt-1 text-foreground">{value}</p>
          {trend && (
            <p className={`text-xs font-mono mt-1 ${trend.value >= 0 ? "text-primary" : "text-destructive"}`}>
              {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconVariantStyles[variant]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
