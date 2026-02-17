// src/App.tsx

import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppErrorBoundary } from "@/components/debug/AppErrorBoundary";
import { AppLifecycleHandler } from "@/components/AppLifecycleHandler";
import Index from "./pages/Index";
// ...
// <Route path="/" element={<div>Refactor Debug Header</div>} />
import AuthPage from "./pages/AuthPage";
import Profile from "./pages/Profile";
import ProfileEdit from "./pages/ProfileEdit";
import UserProfile from "./pages/UserProfile";
import CompletedPaths from "./pages/CompletedPaths";
import { Post } from "./pages/Post";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import SettingsPrivacy from "./pages/SettingsPrivacy";
import AdsPolicy from "./pages/AdsPolicy";
import Transparency from "./pages/Transparency";
import CookiePolicy from "./pages/CookiePolicy";
import ConsentScreen from "./pages/ConsentScreen";
import Messages from "./pages/Messages";
import MessageThread from "./pages/MessageThread";
import { Notifications } from "./pages/Notifications";
import { Search } from "./pages/Search";
import { Saved } from "./pages/Saved";
import NotFound from "./pages/NotFound";

// queryClient moved below with config

// Listener per messaggi dal Service Worker (per navigazione push notification su iOS)
function ServiceWorkerNavigationHandler() {
  useEffect(() => {
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE' && event.data?.url) {
        console.log('[App] Received NAVIGATE message from SW:', event.data.url);
        // Usa window.location.href per navigazione affidabile su iOS
        window.location.href = event.data.url;
      }
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    return () => {
      if ('serviceWorker' in navigator && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
    };
  }, []);

  return null;
}

// [HARDENING] Component for navigation recovery
// Fixes white screen issues when returning from background or external browser
function NavigationRecovery() {
  useEffect(() => {
    // Check if we are in a "lost" state (empty path or similar)
    if (window.location.pathname === 'blank' || window.location.href.includes('about:blank')) {
      console.warn('[NavigationRecovery] Detected blank state, recovering to home');
      window.location.replace('/');
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[App] App resumed');
        // Force redraw if needed or check vital state
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // [HARDENING] Disable aggressive refetching on window focus
      // This prevents "random" state resets when switching apps or closing control center
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes defaults
    },
  },
});

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
      >
        <AuthProvider>
          <TooltipProvider>
            <Sonner />
            <ServiceWorkerNavigationHandler />
            <NavigationRecovery />
            <AppLifecycleHandler />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/consent" element={<ConsentScreen />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/:userId" element={<UserProfile />} />
                <Route path="/profile/edit" element={<ProfileEdit />} />
                <Route path="/completed-paths" element={<CompletedPaths />} />
                <Route path="/post/:postId" element={<Post />} />
                <Route path="/post/:postId/comments" element={<Post />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/settings/privacy" element={<SettingsPrivacy />} />
                <Route path="/legal/ads" element={<AdsPolicy />} />
                <Route path="/legal/transparency" element={<Transparency />} />
                <Route path="/cookies" element={<CookiePolicy />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/messages/:threadId" element={<MessageThread />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/search" element={<Search />} />
                <Route path="/saved" element={<Saved />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
