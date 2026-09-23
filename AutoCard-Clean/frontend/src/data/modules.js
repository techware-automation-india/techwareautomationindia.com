import {
  LayoutDashboard,
  UserCog,
  ClipboardList,
  CheckCircle,
  Clock,
  Calendar,
  ShieldCheck,
  MapPin,
  CalendarRange
} from "lucide-react";

export const MODULES = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'employee', label: 'Employee Management', icon: UserCog },
  { key: 'requests', label: 'Requests', icon: ClipboardList },
  { key: 'approvals', label: 'Approvals', icon: CheckCircle },
  { key: 'mark-attendance', label: 'Mark Attendance', icon: Clock },
  { key: 'attendance', label: 'Attendance', icon: Calendar },
  { key: 'roles-access', label: 'Roles & Access', icon: ShieldCheck },
  { key: 'shift-location', label: 'Shifts & Locations', icon: MapPin },
  { key: 'roster', label: 'Roster', icon: CalendarRange }
];
