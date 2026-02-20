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
import AnalyticsPage from "./pages/AnalyticsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <SidebarProvider>
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center border-b border-border px-4 gap-3 shrink-0">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        </header>
        <main className="flex-1 overflow-auto">
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
              <Route path="/" element={<Navigate to="/world-cup" replace />} />
              <Route path="/world-cup" element={<WorldCupPage />} />
              <Route path="/liverpool" element={<LiverpoolPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </AuthGuard>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
