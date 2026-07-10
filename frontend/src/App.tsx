import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { Auth } from './pages/Auth';
import { AuthCallback } from './pages/AuthCallback';
import { Dashboard } from './pages/Dashboard';

const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-[#070709] gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#e87070] animate-spin"></div>
        <span className="text-xs text-white/30 tracking-widest uppercase font-medium">Loading…</span>
      </div>
    );
  }

  if (!user) {
    const redirectUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/signin?redirect=${redirectUrl}`} replace />;
  }

  return <>{children}</>;
};

const GuestGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();

  if (loading) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-[#070709] gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#e87070] animate-spin"></div>
        <span className="text-xs text-white/30 tracking-widest uppercase font-medium">Loading…</span>
      </div>
    );
  }

  if (user) {
    const redirect = searchParams.get('redirect') || '/dashboard';
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/auth"
            element={
              <GuestGuard>
                <Auth />
              </GuestGuard>
            }
          />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/signin" element={<Navigate to="/auth" replace />} />
          <Route path="/signup" element={<Navigate to="/auth?mode=signup" replace />} />
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
