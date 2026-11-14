import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import Loading from "../components/Loading";
import ChannelPage from "../pages/Channel";
import ComposePage from "../pages/Compose";
import Dashboard from "../pages/Dashboard";
import Home from "../pages/Home";
import IdeasPage from "../pages/Ideas";
import PostsPage from "../pages/Posts";
import RecurringPage from "../pages/Recurring";
import SettingsPage from "../pages/Settings";
import { restoreSession } from "../store/auth/authService";
import { useAppDispatch, useAppSelector } from "../store/hooks";

function ProtectedRoute() {
  const { isAuthenticated, initialized } = useAppSelector((s) => s.auth);
  const location = useLocation();
  if (!initialized) return <Loading label="Restoring session…" />;
  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to={`/${location.search}`} replace />
  );
}

function LandingRoute() {
  const { isAuthenticated, initialized } = useAppSelector((s) => s.auth);
  if (!initialized) return <Loading />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Home />;
}

export default function AppRoutes() {
  const dispatch = useAppDispatch();
  const { initialized } = useAppSelector((s) => s.auth);
  useEffect(() => {
    if (!initialized) void dispatch(restoreSession());
  }, [dispatch, initialized]);

  return (
    <Routes>
      {/* The home page has no sidebar, so it sits outside the app layout. */}
      <Route path="/" element={<LandingRoute />} />
      <Route element={<AppLayout />}>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/channels/:channelId" element={<ChannelPage />} />
          <Route path="/posts" element={<PostsPage />} />
          <Route path="/create" element={<ComposePage />} />
          <Route path="/ideas" element={<IdeasPage />} />
          <Route path="/recurring" element={<RecurringPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/integrations"
            element={<Navigate to="/dashboard" replace />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
