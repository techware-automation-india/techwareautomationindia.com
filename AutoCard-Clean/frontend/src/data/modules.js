import {
  LayoutDashboard,
  UserPlus,
  ClipboardList,
  CheckCircle,
  Clock,
  Calendar,
  ShieldCheck,
  MapPin,
  CalendarRange,
  BookOpen,
  FolderKanban,
} from "lucide-react";

export const MODULES = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'employee', label: 'Add Account', icon: UserPlus },
  { key: 'requests', label: 'Requests', icon: ClipboardList },
  { key: 'approvals', label: 'Approvals', icon: CheckCircle },
  { key: 'mark-attendance', label: 'Mark Attendance', icon: Clock },
  { key: 'attendance', label: 'My Attendance', icon: Calendar },
  { key: 'roles-access', label: 'Roles & Access', icon: ShieldCheck },
  { key: 'shift-location', label: 'Shifts & Locations', icon: MapPin },
  { key: 'roster', label: 'Roster', icon: CalendarRange },
  { key: 'leave-policy', label: 'Leave Policy', icon: BookOpen },
  { key: 'projects', label: 'Projects', icon: FolderKanban },
];
