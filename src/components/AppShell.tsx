import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronRight,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { APP_ROUTES, MOBILE_PRIMARY_PATHS, ROUTE_GROUPS } from '../config/navigation';
import { useAcademic } from '../context/AcademicContext';
import { formatBranchSemesterBadge } from '../data/academicCatalog';
import { BrandLogo } from './BrandLogo';
import { LoadingSkeleton } from './LoadingSkeleton';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { student, unreadCount, isDataLoading, logout } = useAcademic();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const currentRoute = useMemo(
    () => APP_ROUTES.find((r) => r.path === location.pathname) ?? APP_ROUTES[0],
    [location.pathname],
  );

  const mobilePrimaryRoutes = useMemo(
    () =>
      MOBILE_PRIMARY_PATHS.map((path) => APP_ROUTES.find((r) => r.path === path)).filter(
        (item): item is NonNullable<typeof item> => Boolean(item),
      ),
    [],
  );

  const drawerRoutes = useMemo(
    () => APP_ROUTES.filter((r) => !MOBILE_PRIMARY_PATHS.includes(r.path as (typeof MOBILE_PRIMARY_PATHS)[number])),
    [],
  );

  const isDrawerRouteActive = useMemo(
    () => drawerRoutes.some((r) => r.path === location.pathname),
    [drawerRoutes, location.pathname],
  );

  const initials = useMemo(() => {
    const parts = student.name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }, [student.name]);

  const branchSemester = useMemo(
    () => formatBranchSemesterBadge(student),
    [student],
  );

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moreOpen]);

  const handleLogout = async () => {
    setMoreOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#EDEAE6] text-[#0A0A0A] flex flex-col lg:flex-row overflow-x-clip">
      {/* Desktop Sidebar (>= 1024px) */}
      <aside
        aria-label="Primary navigation"
        className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-[260px] bg-[#0F223A] text-white border-r border-[#1C3352] z-30"
      >
        <div className="px-6 py-6 border-b border-white/10">
          <Link to="/dashboard" className="inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-md">
            <BrandLogo variant="light" showTagline />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {ROUTE_GROUPS.map((group) => {
            const groupItems = APP_ROUTES.filter((item) => item.group === group);
            return (
              <div key={group}>
                <p className="px-3 mb-1.5 text-[11px] font-medium tracking-[0.04em] text-[#A8B6C8]">
                  {group}
                </p>
                <ul className="space-y-0.5">
                  {groupItems.map((item) => {
                    const Icon = item.icon;
                    const isNotifications = item.path === '/notifications';
                    return (
                      <li key={item.path}>
                        <NavLink
                          to={item.path}
                          className={({ isActive }) =>
                            `flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                              isActive
                                ? 'bg-[#2F466F] text-white'
                                : 'text-[#D3D9E2] hover:bg-white/8 hover:text-white'
                            }`
                          }
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon className="w-4 h-4 shrink-0 opacity-90" aria-hidden="true" />
                            <span className="truncate whitespace-nowrap">{item.label}</span>
                          </span>
                          {isNotifications && unreadCount > 0 && (
                            <span className="text-[11px] font-mono-tabular text-[#D3D1CE] shrink-0">
                              {unreadCount}
                            </span>
                          )}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-white truncate">{student.name}</p>
              <p className="text-[11px] text-[#D3D9E2] truncate mt-0.5">{branchSemester}</p>
              {student.studentId && (
                <p className="text-[11px] text-[#A8B6C8] truncate tabular-nums">{student.studentId}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#D3D9E2] hover:bg-white/10 hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header (< 1024px) — 56px height */}
      <header className="lg:hidden sticky top-0 z-30 h-14 bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#D3D1CE] px-4 flex items-center justify-between gap-3">
        <Link
          to="/dashboard"
          className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F466F] rounded-md shrink-0"
        >
          <BrandLogo variant="dark" compact />
        </Link>

        <div className="flex items-center gap-1 shrink-0">
          <Link
            to="/notifications"
            aria-label={`Notifications (${unreadCount} unread)`}
            className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#1C1C1C] hover:bg-[#EDEAE6] transition-colors"
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#2F466F] text-white text-[10px] font-mono-tabular font-semibold flex items-center justify-center leading-none">
                {unreadCount}
              </span>
            )}
          </Link>

          <Link
            to="/settings"
            aria-label="Settings and Profile"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[#EDEAE6] transition-colors"
          >
            <span className="w-8 h-8 rounded-full bg-[#0F223A] text-white text-xs font-medium flex items-center justify-center tracking-tight">
              {initials}
            </span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-[260px] flex flex-col min-w-0">
        {/* Desktop Sticky Header (>= 1024px) */}
        <header className="hidden lg:flex sticky top-0 z-20 h-16 bg-[#EDEAE6]/95 backdrop-blur-md border-b border-[#D3D1CE] px-8 items-center justify-between gap-8">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
            <Link
              to="/dashboard"
              className="text-[#262E36] hover:text-[#0A0A0A] transition-colors whitespace-nowrap shrink-0"
            >
              AttendIQ
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-[#536878] shrink-0" aria-hidden="true" />
            <span className="font-medium text-[#0A0A0A] truncate whitespace-nowrap">
              {currentRoute.label}
            </span>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to="/settings"
              title="Edit branch, semester, and academic profile"
              className="inline-flex items-center px-3 py-2 rounded-lg border border-[#D3D1CE] bg-white text-xs font-medium text-[#1C1C1C] hover:border-[#2F466F] transition-colors whitespace-nowrap shrink-0"
            >
              {branchSemester}
            </Link>

            <Link
              to="/notifications"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-xs font-medium text-[#1C1C1C] hover:border-[#2F466F] transition-colors whitespace-nowrap shrink-0"
            >
              <Bell className="w-3.5 h-3.5 text-[#2F466F]" aria-hidden="true" />
              <span>Alerts</span>
              <span className="font-mono-tabular text-[#536878]">{unreadCount}</span>
            </Link>

            <Link
              to="/settings"
              className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] transition-colors whitespace-nowrap shrink-0"
            >
              <span className="w-5 h-5 rounded-full bg-white/15 text-[10px] flex items-center justify-center font-semibold">
                {initials}
              </span>
              <span>{student.name}</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-24 lg:py-8 min-w-0">
          {isDataLoading ? <LoadingSkeleton /> : children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (< 1024px) — 64px height */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#FFFFFF]/95 backdrop-blur-md border-t border-[#D3D1CE] grid grid-cols-5 items-center px-1"
      >
        {mobilePrimaryRoutes.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `min-h-[48px] flex flex-col items-center justify-center gap-1 px-1 rounded-lg transition-colors ${
                  isActive ? 'text-[#2F466F] font-semibold' : 'text-[#262E36] hover:text-[#0A0A0A]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#2F466F]' : 'text-[#536878]'}`}
                    strokeWidth={isActive ? 2.25 : 1.75}
                    aria-hidden="true"
                  />
                  <span className="text-[10.5px] leading-none tracking-tight whitespace-nowrap truncate max-w-full">
                    {item.shortLabel}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          aria-controls="mobile-more-drawer"
          className={`min-h-[48px] flex flex-col items-center justify-center gap-1 px-1 rounded-lg transition-colors cursor-pointer ${
            moreOpen || isDrawerRouteActive
              ? 'text-[#2F466F] font-semibold'
              : 'text-[#262E36] hover:text-[#0A0A0A]'
          }`}
        >
          <Menu
            className={`w-5 h-5 shrink-0 ${
              moreOpen || isDrawerRouteActive ? 'text-[#2F466F]' : 'text-[#536878]'
            }`}
            strokeWidth={moreOpen || isDrawerRouteActive ? 2.25 : 1.75}
            aria-hidden="true"
          />
          <span className="text-[10.5px] leading-none tracking-tight whitespace-nowrap">More</span>
        </button>
      </nav>

      {/* Mobile Slide-Up Drawer for remaining 10 routes */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-[#0A0A0A]/45 backdrop-blur-xs"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div
            id="mobile-more-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Additional navigation routes"
            className="relative bg-white rounded-t-2xl border-t border-[#D3D1CE] max-h-[82vh] flex flex-col"
          >
            <div className="pt-3 pb-2 px-5 border-b border-[#D3D1CE] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-1 bg-[#D3D1CE] rounded-full" aria-hidden="true" />
                <h2 className="font-display text-base font-semibold text-[#0A0A0A]">
                  All Academic Tools
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close navigation drawer"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#262E36] hover:bg-[#EDEAE6] cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-3 divide-y divide-[#EDEAE6]">
              {drawerRoutes.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMoreOpen(false)}
                    className={`min-h-[54px] py-2.5 px-2 flex items-center justify-between gap-3 rounded-lg transition-colors ${
                      active ? 'bg-[#EDEAE6] text-[#0F223A]' : 'text-[#1C1C1C] hover:bg-[#EDEAE6]/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-lg border border-[#D3D1CE] bg-white flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-[#2F466F]" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0A0A0A] truncate">{item.label}</p>
                        <p className="text-xs text-[#262E36] truncate">{item.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#536878] shrink-0" aria-hidden="true" />
                  </Link>
                );
              })}
            </div>

            <div className="p-4 border-t border-[#D3D1CE] bg-[#EDEAE6]/50 space-y-2.5">
              <div className="flex items-center justify-between gap-2 px-1 text-xs">
                <span className="font-medium text-[#0A0A0A] truncate">{student.name}</span>
                <span className="text-[#2F466F] font-medium shrink-0">{branchSemester}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg border border-[#D3D1CE] bg-white text-sm font-medium text-[#1C1C1C] hover:border-[#0F223A] transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-[#536878]" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
