import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { AcademicProvider, useAcademic } from './context/AcademicContext';
import { ToastProvider } from './context/ToastContext';
import {
  AchievementsPage,
  ReportsPage,
} from './pages/AnalyticsAccountPages';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { AttendancePage } from './pages/AttendancePage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { InsightsPage } from './pages/InsightsPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { PerformancePage } from './pages/PerformancePage';
import { NotificationsPage } from './pages/PlanningPages';
import { PredictorPage } from './pages/PredictorPage';
import { RecoveryPage } from './pages/RecoveryPage';
import { SettingsPage } from './pages/SettingsPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { StudyPlannerPage } from './pages/StudyPlannerPage';
import { TimetableExamsPage } from './pages/TimetableExamsPage';

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthLoading, isDataLoading, student } = useAcademic();

  if (isAuthLoading || isDataLoading) {
    return (
      <div className="min-h-screen bg-[#EDEAE6] p-6 lg:p-12 max-w-[1200px] mx-auto">
        <LoadingSkeleton />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (student.onboardingCompleted === false) {
    return <Navigate to="/onboarding" replace />;
  }
  return <AppShell>{children}</AppShell>;
}

function RootRedirect() {
  const { isAuthenticated, isAuthLoading, isDataLoading, student } = useAcademic();
  if (isAuthLoading || isDataLoading) {
    return (
      <div className="min-h-screen bg-[#EDEAE6] p-6 lg:p-12 max-w-[1200px] mx-auto">
        <LoadingSkeleton />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return (
    <Navigate
      to={student.onboardingCompleted === false ? '/onboarding' : '/dashboard'}
      replace
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AcademicProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
              <Route path="/onboarding" element={<OnboardingPage />} />

              <Route
                path="/dashboard"
                element={
                  <ProtectedShell>
                    <DashboardPage />
                  </ProtectedShell>
                }
              />
              <Route
                path="/attendance"
                element={
                  <ProtectedShell>
                    <AttendancePage />
                  </ProtectedShell>
                }
              />
              <Route
                path="/predictor"
                element={
                  <ProtectedShell>
                    <PredictorPage />
                  </ProtectedShell>
                }
              />
              <Route
                path="/recovery"
                element={
                  <ProtectedShell>
                    <RecoveryPage />
                  </ProtectedShell>
                }
              />
              <Route
                path="/timetable-exams"
                element={
                  <ProtectedShell>
                    <TimetableExamsPage />
                  </ProtectedShell>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedShell>
                    <NotificationsPage />
                  </ProtectedShell>
                }
              />
              <Route
                path="/ai-assistant"
                element={
                  <ProtectedShell>
                    <AiAssistantPage />
                  </ProtectedShell>
                }
              />
              <Route
                path="/study-planner"
                element={
                  <ProtectedShell>
                    <StudyPlannerPage />
                  </ProtectedShell>
                }
              />
              <Route
                path="/performance"
                element={
                  <ProtectedShell>
                    <PerformancePage />
                  </ProtectedShell>
                }
              />
              <Route
                path="/simulator"
                element={
                  <ProtectedShell>
                    <SimulatorPage />
                  </ProtectedShell>
                }
              />
              <Route
                path="/achievements"
                element={
                  <ProtectedShell>
                    <AchievementsPage />
                  </ProtectedShell>
                }
              />
              <Route
                path="/insights"
                element={
                  <ProtectedShell>
                    <InsightsPage />
                  </ProtectedShell>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedShell>
                    <ReportsPage />
                  </ProtectedShell>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedShell>
                    <SettingsPage />
                  </ProtectedShell>
                }
              />

              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </BrowserRouter>
        </AcademicProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
