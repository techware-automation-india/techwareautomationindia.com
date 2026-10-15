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
  CalendarDays,
  CalendarCheck,
  Wrench,
  FileText,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckSquare,
  Eye,
  AlertTriangle,
} from "lucide-react";

export const APPROVAL_SUBTYPES = [
  { key: 'approvals-leave', label: 'Leave Approval', icon: CalendarDays, description: 'Approve employee leave applications' },
  { key: 'approvals-attendance', label: 'Unassign Location Approval', icon: MapPin, description: 'Approve out-of-office & GPS punches' },
  { key: 'approvals-forgot-punch', label: 'Forgot Punch / Time Edit Approval', icon: Clock, description: 'Review employee check in, check out and time edit requests' },
  { key: 'approvals-tools-inventory', label: 'Tools & Inventory Approval', icon: Wrench, description: 'Approve tool requisitions & inventory returns' },
];

export const INVENTORY_SUBMODULE_ACTIONS = {
  'inventory-in': [
    { key: 'view', label: 'View' },
    { key: 'create', label: 'Create / Add' },
    { key: 'edit', label: 'Edit' },
    { key: 'delete', label: 'Delete' },
  ],
  'inventory-out': [
    { key: 'view', label: 'View' },
    { key: 'create', label: 'Create / Add' },
    { key: 'edit', label: 'Edit' },
    { key: 'delete', label: 'Delete' },
  ],
  'view-inventory': [
    { key: 'view', label: 'View' },
    { key: 'create', label: 'Create / Add' },
    { key: 'edit', label: 'Edit' },
    { key: 'delete', label: 'Delete' },
  ],
  'inventory-alert': [
    { key: 'view', label: 'View' },
    { key: 'edit', label: 'Edit Thresholds' },
  ],
  'general-consumables': [
    { key: 'view', label: 'View' },
    { key: 'create', label: 'Create / Issue' },
    { key: 'edit', label: 'Edit' },
    { key: 'delete', label: 'Delete' },
  ],
};

export const MODULES = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'employee', label: 'Add Account', icon: UserPlus },
  {
    key: 'requests',
    label: 'Requests',
    icon: ClipboardList,
    hasSubTypes: true,
    subModules: [
      { key: 'requests-apply-leave', label: 'Apply for Leave', icon: CalendarDays, description: 'Submit leave applications' },
      { key: 'requests-forgot-punch', label: 'Forgot Punch / Time Edit', icon: Clock, description: 'Review employee check in, check out and time edit requests' },
      { key: 'requests-tools-inventory', label: 'Request Tools / Inventory', icon: Wrench, description: 'Request or return project tools and equipment' },
      { key: 'requests-track', label: 'Track All Requests', icon: FileText, description: 'View status of all submitted requests' },
    ],
  },
  {
    key: 'approvals',
    label: 'Approvals',
    icon: CheckCircle,
    hasSubTypes: true,
    subModules: APPROVAL_SUBTYPES,
  },
  { key: 'mark-attendance', label: 'Mark Attendance', icon: Clock },
  { key: 'attendance', label: 'My Attendance', icon: Calendar },
  { key: 'attendance-management', label: 'Team Attendance (All Employees)', icon: CalendarCheck },
  { key: 'roles-access', label: 'Roles & Access', icon: ShieldCheck },
  { key: 'shift-location', label: 'Shifts & Locations', icon: MapPin },
  { key: 'roster', label: 'Roster', icon: CalendarRange },
  {
    key: 'leave-policy',
    label: 'Leave Policy & Holiday',
    icon: ClipboardList,
    hasSubTypes: true,
    subModules: [
      { key: 'leave-policy-types', label: 'Leave Policy', icon: FileText, description: 'Configure leave types, quotas & rules' },
      { key: 'leave-policy-holidays', label: 'Holiday Calendar', icon: CalendarDays, description: 'Manage organizational public holidays' },
    ],
  },
  {
    key: 'projects',
    label: 'Projects',
    icon: FolderKanban,
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: Package,
    hasSubTypes: true,
    subModules: [
      { key: 'inventory-in', label: '1. Inventory In', icon: ArrowDownToLine, description: 'Material Inward Register & Category Tree', actions: INVENTORY_SUBMODULE_ACTIONS['inventory-in'] },
      { key: 'inventory-out', label: '2. Inventory Out', icon: ArrowUpFromLine, description: 'Material Outward Register & Allocations', actions: INVENTORY_SUBMODULE_ACTIONS['inventory-out'] },
      { key: 'view-inventory', label: '3. View Stock', icon: Eye, description: 'Master Stock Catalog & Valuation', actions: INVENTORY_SUBMODULE_ACTIONS['view-inventory'] },
      { key: 'inventory-alert', label: '4. Stock Alerts', icon: AlertTriangle, description: 'Low stock & reorder notifications', actions: INVENTORY_SUBMODULE_ACTIONS['inventory-alert'] },
      { key: 'general-consumables', label: '5. Tools & Consumables', icon: Wrench, description: 'Tools and consumables requisition register', actions: INVENTORY_SUBMODULE_ACTIONS['general-consumables'] },
    ],
  },
];
