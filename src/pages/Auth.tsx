import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "district_head" | "booth_head" | "volunteer";

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  district_head: "District Head",
  booth_head: "Booth Head",
  volunteer: "Volunteer",
};

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("volunteer");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        toast.success("Welcome back, operative.");
      } else {
        await signUp(email, password, fullName, role);
        toast.success("Account created. You're now operational.");
      }
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center tactical-grid relative">
      <div className="absolute inset-0 scan-lines" />
      <div className="w-full max-w-md mx-4 animate-slide-up relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-primary/10 border border-primary/30 mb-4 glow-primary">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-wider text-foreground">
            FIELD<span className="text-primary">OPS</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1 font-mono">
            Political Field Intelligence System
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 border-glow">
          <div className="flex mb-6 bg-muted rounded-md p-1">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-mono rounded transition-all ${
                isLogin ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              LOGIN
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-mono rounded transition-all ${
                !isLogin ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              SIGN UP
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter operative name"
                  required={!isLogin}
                  className="bg-muted border-border font-mono text-sm"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operative@fieldops.com"
                required
                className="bg-muted border-border font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="bg-muted border-border font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {!isLogin && (
              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Role
                </Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger className="bg-muted border-border font-mono text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key} className="font-mono text-sm">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full font-mono uppercase tracking-wider"
            >
              {submitting ? "Processing..." : isLogin ? "Authenticate" : "Create Account"}
            </Button>
            {isLogin && (
              <button
                type="button"
                onClick={async () => {
                  if (!email) {
                    toast.error("Enter your email first");
                    return;
                  }
                  try {
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (error) throw error;
                    toast.success("Password reset link sent to your email");
                  } catch (err: any) {
                    toast.error(err.message || "Failed to send reset link");
                  }
                }}
                className="w-full text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
              >
                Forgot Password?
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
