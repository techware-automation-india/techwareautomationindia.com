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
  Package,
  CalendarDays,
  CalendarCheck,
} from "lucide-react";

export const APPROVAL_SUBTYPES = [
  { key: 'approvals-leave', label: 'Leave Approval', icon: CalendarDays, description: 'Approve employee leave applications' },
  { key: 'approvals-attendance', label: 'Unassign Location Approval', icon: MapPin, description: 'Approve out-of-office & GPS punches' },
  { key: 'approvals-forgot-punch', label: 'Forgot Punch Approval', icon: Clock, description: 'Approve missed check-in & check-out time corrections' },
];

export const MODULES = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'employee', label: 'Add Account', icon: UserPlus },
  { key: 'requests', label: 'Requests', icon: ClipboardList },
  { key: 'approvals', label: 'Approvals', icon: CheckCircle, hasSubTypes: true },
  { key: 'mark-attendance', label: 'Mark Attendance', icon: Clock },
  { key: 'attendance', label: 'My Attendance', icon: Calendar },
  { key: 'attendance-management', label: 'Team Attendance (All Employees)', icon: CalendarCheck },
  { key: 'roles-access', label: 'Roles & Access', icon: ShieldCheck },
  { key: 'shift-location', label: 'Shifts & Locations', icon: MapPin },
  { key: 'roster', label: 'Roster', icon: CalendarRange },
  { key: 'leave-policy', label: 'Leave Policy & Holiday', icon: ClipboardList },
  { key: 'academic-calendar', label: 'Academic Calendar', icon: CalendarDays },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'projects', label: 'Projects (Master Admin)', icon: FolderKanban },
  { key: 'assigned-projects', label: 'Assigned Projects', icon: FolderKanban },
  { key: 'my-projects', label: 'My Projects', icon: FolderKanban },
];
