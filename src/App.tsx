import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthGuard } from "@/components/AuthGuard";
import WorldCupPage from "./pages/WorldCupPage";
import LiverpoolPage from "./pages/LiverpoolPage";
import ArsenalPage from "./pages/ArsenalPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import HealthPage from "./pages/HealthPage";
import MarketPage from "./pages/MarketPage";
import HeatmapPage from "./pages/analytics/HeatmapPage";
import TopGamesPage from "./pages/analytics/TopGamesPage";
import RiskPage from "./pages/analytics/RiskPage";
import VelocityPage from "./pages/analytics/VelocityPage";
import SalesPage from "./pages/SalesPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <SidebarProvider>
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-12 flex items-center border-b border-border px-4 gap-3 shrink-0">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        </header>
        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </div>
  </SidebarProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthGuard>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/market" replace />} />
              <Route path="/market" element={<MarketPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/analytics/heatmap" element={<HeatmapPage />} />
              <Route path="/analytics/top-games" element={<TopGamesPage />} />
              <Route path="/analytics/risk" element={<RiskPage />} />
              <Route path="/analytics/velocity" element={<VelocityPage />} />
              <Route path="/liverpool" element={<LiverpoolPage />} />
              <Route path="/arsenal" element={<ArsenalPage />} />
              <Route path="/world-cup" element={<WorldCupPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/health" element={<HealthPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </AuthGuard>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
