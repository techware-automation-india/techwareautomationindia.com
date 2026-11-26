import {
  LayoutDashboard,
  Users,
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
  Building2,
  Cpu,
  LifeBuoy,
} from "lucide-react";

export const DEFAULT_CORE_MODULE_KEYS = [
  'overview',
  'mark-attendance',
  'attendance',
  'requests',
  'requests-apply-leave',
  'requests-forgot-punch',
  'requests-tools-inventory',
  'requests-track',
];

export const STANDARD_SUBMODULE_ACTIONS = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create / Add' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
];

export const APPROVAL_ACTIONS = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Approve' },
  { key: 'edit', label: 'Edit / Notes' },
  { key: 'delete', label: 'Reject' },
];

export const APPROVAL_SUBTYPES = [
  { key: 'approvals-leave', label: 'Leave Approval', icon: CalendarDays, description: 'Approve employee leave applications', actions: APPROVAL_ACTIONS },
  { key: 'approvals-attendance', label: 'Unassign Location Approval', icon: MapPin, description: 'Approve out-of-office & GPS punches', actions: APPROVAL_ACTIONS },
  { key: 'approvals-forgot-punch', label: 'Forgot Punch / Time Edit Approval', icon: Clock, description: 'Review employee check in, check out and time edit requests', actions: APPROVAL_ACTIONS },
  { key: 'approvals-tools-inventory', label: 'Tools & Inventory Approval', icon: Wrench, description: 'Approve tool requisitions & inventory returns', actions: APPROVAL_ACTIONS },
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
  {
    key: 'hrms',
    label: 'Team Management',
    icon: Users,
    hasSubTypes: true,
    description: 'Account onboarding, team attendance, shifts, roster, leaves & approvals',
    subModules: [
      { key: 'employee', label: 'Add Account', icon: UserPlus, description: 'User onboarding & account management' },
      { key: 'attendance-management', label: 'Team Attendance', icon: CalendarCheck, description: 'View & monitor team daily/monthly attendance' },
      { key: 'shift-location', label: 'Shift & Location', icon: MapPin, description: 'Assign shifts & geofenced work locations' },
      { key: 'roster', label: 'Roster', icon: CalendarRange, description: 'Schedule monthly shifts and roster plans' },
      { key: 'leave-policy', label: 'Leave Policy & Holiday', icon: ClipboardList, description: 'Manage leave balances, policy rules & holiday calendar' },
    ],
  },
  {
    key: 'approvals',
    label: 'Approvals Hub',
    icon: CheckCircle,
    hasSubTypes: true,
    description: 'Grant authority to review and approve employee requisitions',
    subModules: APPROVAL_SUBTYPES,
  },
  {
    key: 'customer',
    label: 'Customer',
    icon: Building2,
    hasSubTypes: true,
    description: 'Client profiles, customer onboarding, projects & machine deployments',
    subModules: [
      { key: 'customer-list', label: 'Customer Directory', icon: Users, description: 'Browse and manage registered client profiles' },
      { key: 'customer', label: 'Onboard Customer', icon: UserPlus, description: 'Create client accounts and portal access' },
      { key: 'customer-machines', label: 'Machines & Asset Registry', icon: Cpu, description: 'Track deployed machines and warranty' },
      { key: 'customer-tickets', label: 'Service & Breakdown Tickets', icon: LifeBuoy, description: 'Manage breakdown complaints and repairs' },
      { key: 'customer-documents', label: 'Documents & Contracts Vault', icon: FileText, description: 'Store user manuals, schematics and AMC contracts' },
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
