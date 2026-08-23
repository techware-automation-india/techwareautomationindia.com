import {
  LayoutDashboard,
  UserCircle,
  FolderKanban,
  FileText,
  ShoppingBag,
  FileArchive,
  Receipt,
  Headphones,
  Bell,
  Settings,
} from "lucide-react";

// Customer panel modules
export const customerModules = [
  {
    key: "overview",
    label: "Dashboard",
    path: "/customer",
    icon: LayoutDashboard,
    description: "Overview of your projects and requests.",
  },
  {
    key: "profile",
    label: "My Profile",
    path: "/customer/profile",
    icon: UserCircle,
    description: "View and edit your profile details.",
  },
  {
    key: "projects",
    label: "Projects",
    path: "/customer/projects",
    icon: FolderKanban,
    description: "View your assigned projects and progress.",
  },
  {
    key: "requests",
    label: "Requests",
    path: "/customer/requests",
    icon: FileText,
    description: "Submit and track your service requests.",
  },
  
  {
    key: "documents",
    label: "Documents",
    path: "/customer/documents",
    icon: FileArchive,
    description: "Access your project documents and files.",
  },
  
  {
    key: "support",
    label: "Support",
    path: "/customer/support",
    icon: Headphones,
    description: "Get help and contact support team.",
  },
  {
    key: "notifications",
    label: "Notifications",
    path: "/customer/notifications",
    icon: Bell,
    description: "View all your notifications.",
  },
  {
    key: "settings",
    label: "Settings",
    path: "/customer/settings",
    icon: Settings,
    description: "Manage your account settings.",
  },
];
