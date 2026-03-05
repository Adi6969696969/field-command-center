import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Workers from "./pages/Workers";
import WorkerProfile from "./pages/WorkerProfile";
import Tasks from "./pages/Tasks";
import SmartAssign from "./pages/SmartAssign";
import GeoIntel from "./pages/GeoIntel";
import Leaderboard from "./pages/Leaderboard";
import Feedback from "./pages/Feedback";
import FraudDetection from "./pages/FraudDetection";
import AICoPilot from "./pages/AICoPilot";
import ReadinessIndex from "./pages/ReadinessIndex";
import BurnoutDetection from "./pages/BurnoutDetection";
import WarMode from "./pages/WarMode";
import DigitalTwin from "./pages/DigitalTwin";
import BlockchainLedger from "./pages/BlockchainLedger";
import HierarchyAnalytics from "./pages/HierarchyAnalytics";
import IntelBrief from "./pages/IntelBrief";
import ResourceOptimization from "./pages/ResourceOptimization";
import WorkloadBalancer from "./pages/WorkloadBalancer";
import GPSTracking from "./pages/GPSTracking";
import IssueHeatmap from "./pages/IssueHeatmap";
import PublicSentiment from "./pages/PublicSentiment";
import Attendance from "./pages/Attendance";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background tactical-grid">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
          <span className="text-sm font-mono text-muted-foreground">Initializing system...</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <DashboardLayout>{children}</DashboardLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/workers" element={<ProtectedRoute><Workers /></ProtectedRoute>} />
            <Route path="/workers/:id" element={<ProtectedRoute><WorkerProfile /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
            <Route path="/smart-assign" element={<ProtectedRoute><SmartAssign /></ProtectedRoute>} />
            <Route path="/geo-intel" element={<ProtectedRoute><GeoIntel /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
            <Route path="/fraud-detection" element={<ProtectedRoute><FraudDetection /></ProtectedRoute>} />
            <Route path="/ai-copilot" element={<ProtectedRoute><AICoPilot /></ProtectedRoute>} />
            <Route path="/readiness" element={<ProtectedRoute><ReadinessIndex /></ProtectedRoute>} />
            <Route path="/burnout" element={<ProtectedRoute><BurnoutDetection /></ProtectedRoute>} />
            <Route path="/war-mode" element={<ProtectedRoute><WarMode /></ProtectedRoute>} />
            <Route path="/digital-twin" element={<ProtectedRoute><DigitalTwin /></ProtectedRoute>} />
            <Route path="/blockchain" element={<ProtectedRoute><BlockchainLedger /></ProtectedRoute>} />
            <Route path="/hierarchy" element={<ProtectedRoute><HierarchyAnalytics /></ProtectedRoute>} />
            <Route path="/intel-brief" element={<ProtectedRoute><IntelBrief /></ProtectedRoute>} />
            <Route path="/resources" element={<ProtectedRoute><ResourceOptimization /></ProtectedRoute>} />
            <Route path="/workload" element={<ProtectedRoute><WorkloadBalancer /></ProtectedRoute>} />
            <Route path="/gps-tracking" element={<ProtectedRoute><GPSTracking /></ProtectedRoute>} />
            <Route path="/issue-heatmap" element={<ProtectedRoute><IssueHeatmap /></ProtectedRoute>} />
            <Route path="/public-sentiment" element={<ProtectedRoute><PublicSentiment /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
