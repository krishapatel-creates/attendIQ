import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckSquare,
  Compass,
  FileText,
  GraduationCap,
  LayoutDashboard,
  RefreshCw,
  Settings,
  Sliders,
  Sparkles,
} from 'lucide-react';

export interface NavRouteItem {
  path: string;
  label: string;
  shortLabel: string;
  description: string;
  group: 'Overview' | 'Intelligence & Planning' | 'Analytics & Records' | 'Account';
  icon: LucideIcon;
}

export const APP_ROUTES: NavRouteItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    shortLabel: 'Dashboard',
    description: 'Executive semester pulse and daily action summary',
    group: 'Overview',
    icon: LayoutDashboard,
  },
  {
    path: '/attendance',
    label: 'My Attendance',
    shortLabel: 'Attendance',
    description: 'Course-by-course attendance ledger and standing',
    group: 'Overview',
    icon: BookOpen,
  },
  {
    path: '/timetable-exams',
    label: 'Timetable & Exams',
    shortLabel: 'Schedule',
    description: 'Weekly class matrix and exam countdowns',
    group: 'Overview',
    icon: CalendarDays,
  },
  {
    path: '/predictor',
    label: 'Attendance Predictor',
    shortLabel: 'Predictor',
    description: 'End-of-semester projection based on current pace',
    group: 'Intelligence & Planning',
    icon: Compass,
  },
  {
    path: '/recovery',
    label: 'Recovery Calculator',
    shortLabel: 'Recovery',
    description: 'Consecutive classes needed to clear threshold',
    group: 'Intelligence & Planning',
    icon: RefreshCw,
  },
  {
    path: '/simulator',
    label: 'What-If Simulator',
    shortLabel: 'Simulator',
    description: 'Test planned absences before skipping class',
    group: 'Intelligence & Planning',
    icon: Sliders,
  },
  {
    path: '/study-planner',
    label: 'Study Planner',
    shortLabel: 'Planner',
    description: 'Focused academic tasks and revision blocks',
    group: 'Intelligence & Planning',
    icon: CheckSquare,
  },
  {
    path: '/ai-assistant',
    label: 'AI Assistant',
    shortLabel: 'AI Assistant',
    description: 'Guided academic strategy and schedule advisor',
    group: 'Intelligence & Planning',
    icon: Sparkles,
  },
  {
    path: '/performance',
    label: 'Academic Performance',
    shortLabel: 'Performance',
    description: 'Course grades, credits, and SGPA trajectory',
    group: 'Analytics & Records',
    icon: GraduationCap,
  },
  {
    path: '/insights',
    label: 'Academic Insights',
    shortLabel: 'Insights',
    description: 'Day-of-week patterns and consistency telemetry',
    group: 'Analytics & Records',
    icon: BarChart3,
  },
  {
    path: '/reports',
    label: 'Monthly Reports',
    shortLabel: 'Reports',
    description: 'Structured monthly attendance transcripts',
    group: 'Analytics & Records',
    icon: FileText,
  },
  {
    path: '/achievements',
    label: 'Achievements',
    shortLabel: 'Milestones',
    description: 'Consistency streaks and academic honors',
    group: 'Analytics & Records',
    icon: Award,
  },
  {
    path: '/notifications',
    label: 'Notifications',
    shortLabel: 'Alerts',
    description: 'Threshold alerts and exam reminders',
    group: 'Account',
    icon: Bell,
  },
  {
    path: '/settings',
    label: 'Settings & Profile',
    shortLabel: 'Settings',
    description: 'Benchmark targets, profile, and preferences',
    group: 'Account',
    icon: Settings,
  },
];

export const MOBILE_PRIMARY_PATHS = [
  '/dashboard',
  '/attendance',
  '/simulator',
  '/ai-assistant',
] as const;

export const ROUTE_GROUPS: Array<NavRouteItem['group']> = [
  'Overview',
  'Intelligence & Planning',
  'Analytics & Records',
  'Account',
];
