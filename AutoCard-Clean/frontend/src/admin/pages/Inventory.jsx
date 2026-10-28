import { useState, useEffect } from "react";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import {
  Package, PackagePlus, PackageMinus, Boxes, CheckCircle2,
  Inbox, AlertTriangle, ArrowRight, ArrowLeft, RefreshCw,
  FolderTree, ShieldCheck, ClipboardList, Bell, Layers, Sparkles, Wrench,
  User, Users, Settings
} from "lucide-react";
import InventoryInView from "../components/inventory/InventoryInView.jsx";
import InventoryOutView from "../components/inventory/InventoryOutView.jsx";
import InventoryApprovalView from "../components/inventory/InventoryApprovalView.jsx";
import ViewInventoryView from "../components/inventory/ViewInventoryView.jsx";
import InventoryRequestView from "../components/inventory/InventoryRequestView.jsx";
import InventoryAlertView from "../components/inventory/InventoryAlertView.jsx";
import GeneralConsumablesView from "../components/inventory/GeneralConsumablesView.jsx";
import InventorySettingsModal from "../components/inventory/InventorySettingsModal.jsx";
import { hasModuleAccess } from "../../lib/permissions.js";
import { apiGet } from "../../lib/api.js";
import { getAuthUser } from "../../lib/auth.js";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════
// INVENTORY SUBMODULES DEFINITIONS (Core Inventory Submodules)
// ═══════════════════════════════════════════════════════════════════════
const INVENTORY_SUBMODULES = [
  {
    id: "in",
    key: "inventory-in",
    title: "1. Inventory In",
    tagline: "Material Inward Register",
    description: "Inward stock entries, category tree management, and new item registration.",
    icon: PackagePlus,
    badge: "Active",
    badgeType: "active",
    color: "from-blue-600/10 to-indigo-600/10 text-blue-600 border-blue-500/30",
    buttonText: "Open Inventory In",
  },
  {
    id: "out",
    key: "inventory-out",
    title: "2. Inventory Out",
    tagline: "Material Outward Register",
    description: "Stock OUT entries, dispatches to employees/projects, and return tracking.",
    icon: PackageMinus,
    badge: "Active",
    badgeType: "active",
    color: "from-amber-600/10 to-orange-600/10 text-amber-600 border-amber-500/30",
    buttonText: "Open Inventory Out",
  },
  {
    id: "view",
    key: "view-inventory",
    title: "3. View Inventory",
    tagline: "Master Stock Catalog",
    description: "Browse stock catalog, category filters, physical locations, and valuation.",
    icon: Boxes,
    badge: "Active",
    badgeType: "active",
    color: "from-violet-600/10 to-purple-600/10 text-violet-600 border-violet-500/30",
    buttonText: "Open View Inventory",
  },
  {
    id: "alert",
    key: "inventory-alert",
    title: "4. Inventory Alert",
    tagline: "Low Stock & Alerts",
    description: "Alerts for items below minimum threshold, zero stock, and reorder levels.",
    icon: Bell,
    badge: "Active",
    badgeType: "active",
    color: "from-rose-600/10 to-red-600/10 text-rose-600 border-rose-500/30",
    buttonText: "Open Inventory Alert",
  },
  {
    id: "general",
    key: "general-consumables",
    title: "5. Tools / Consumables",
    tagline: "Tools & Consumables Folders",
    description: "Manage tool requests and consumable item issuance history.",
    icon: Wrench,
    badge: "Active",
    badgeType: "active",
    color: "from-teal-600/10 to-emerald-600/10 text-teal-600 border-teal-500/30",
    buttonText: "Open Tools / Consumables",
  },
];

// ═══════════════════════════════════════════════════════════════════════
// Placeholder Component for Upcoming Submodules
// ═══════════════════════════════════════════════════════════════════════
const UpcomingSubmoduleView = ({ submodule, onBack }) => {
  const Icon = submodule.icon;
  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary card-shadow transition-all active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1 text-primary" />
          <span>Back to Inventory Submodules</span>
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-background p-10 card-shadow text-center max-w-xl mx-auto space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-secondary/80 flex items-center justify-center mx-auto text-primary">
          <Icon className="h-8 w-8" />
        </div>

        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">
            {submodule.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {submodule.description}
          </p>
        </div>

        <div>
          <button
            onClick={onBack}
            className="cta-gradient text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          >
            Return to Inventory Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Main Inventory Component
// ═══════════════════════════════════════════════════════════════════════
const Inventory = ({ defaultSubmodule = null }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { submodule: paramSubmodule } = useParams();
  const navigate = useNavigate();

  // Determine active submodule from prop, url param, or query string
  const getSelectedSubmodule = () => {
    const raw = paramSubmodule || searchParams.get("submodule") || searchParams.get("tab") || defaultSubmodule;
    if (!raw) return null;
    const lower = raw.toLowerCase();
    if (lower === "in" || lower === "inventory-in") return "in";
    if (lower === "out" || lower === "inventory-out" || lower === "issued") return "out";
    if (lower === "approval" || lower === "inventory-approval") return "approval";
    if (lower === "view" || lower === "view-inventory" || lower === "all") return "view";
    if (lower === "request" || lower === "inventory-request") return "request";
    if (lower === "alert" || lower === "inventory-alert" || lower === "low-stock" || lower === "out-stock") return "alert";
    if (lower === "general" || lower === "general-consumables" || lower === "consumables") return "general";
    return null;
  };

  const [activeSubmodule, setActiveSubmodule] = useState(getSelectedSubmodule);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [assignedUsers, setAssignedUsers] = useState({
    inventoryInUsers: [],
    inventoryOutUsers: [],
  });
  const currentUser = getAuthUser();

  useEffect(() => {
    apiGet("/inventory/assigned-users")
      .then((data) => {
        setAssignedUsers({
          inventoryInUsers: data.inventoryInUsers || [],
          inventoryOutUsers: data.inventoryOutUsers || [],
        });
      })
      .catch((err) => {
        console.warn("Could not load assigned inventory users:", err);
      });
  }, []);

  useEffect(() => {
    const nextSub = getSelectedSubmodule();
    if (nextSub) {
      setActiveSubmodule(nextSub);
    } else if (currentUser?.role === "EMPLOYEE") {
      // If employee opens inventory without a submodule param, check how many submodules they have access to
      const allowedSubs = INVENTORY_SUBMODULES.filter((sub) => hasModuleAccess(sub.key));
      if (allowedSubs.length === 1) {
        // Automatically direct them straight into their permitted submodule!
        setActiveSubmodule(allowedSubs[0].id);
      } else {
        setActiveSubmodule(null);
      }
    } else {
      setActiveSubmodule(null);
    }
  }, [paramSubmodule, searchParams.get("submodule"), searchParams.get("tab")]);

  const handleSelectSubmodule = (subId) => {
    if (subId) {
      const subObj = INVENTORY_SUBMODULES.find((s) => s.id === subId);
      if (subObj && !hasModuleAccess(subObj.key)) {
        toast.error(`Access Denied: You do not have permission to access "${subObj.title}".`);
        return;
      }
      setActiveSubmodule(subId);
      setSearchParams({ submodule: subId });
    } else {
      setActiveSubmodule(null);
      searchParams.delete("submodule");
      searchParams.delete("tab");
      setSearchParams(searchParams);
    }
  };

  // Find first accessible submodule for the quick-action button
  const firstAccessibleSub = INVENTORY_SUBMODULES.find((sub) => hasModuleAccess(sub.key)) || INVENTORY_SUBMODULES[0];

  // Render Submodule 1: Inventory In
  if (activeSubmodule === "in") {
    if (!hasModuleAccess("inventory-in")) {
      return (
        <div className="p-8 text-center bg-background border border-border rounded-2xl">
          <p className="text-red-500 font-semibold mb-2">Access Denied</p>
          <p className="text-sm text-muted-foreground mb-4">You do not have permission to view Inventory In.</p>
          <button onClick={() => handleSelectSubmodule(null)} className="px-4 py-2 bg-secondary text-sm font-medium rounded-lg">Back to Hub</button>
        </div>
      );
    }
    return (
      <InventoryInView
        onBackToHub={() => handleSelectSubmodule(null)}
        assignedUsers={assignedUsers.inventoryInUsers}
        currentUser={currentUser}
      />
    );
  }

  // Render Submodule 2: Inventory Out
  if (activeSubmodule === "out") {
    if (!hasModuleAccess("inventory-out")) {
      return (
        <div className="p-8 text-center bg-background border border-border rounded-2xl">
          <p className="text-red-500 font-semibold mb-2">Access Denied</p>
          <p className="text-sm text-muted-foreground mb-4">You do not have permission to view Inventory Out.</p>
          <button onClick={() => handleSelectSubmodule(null)} className="px-4 py-2 bg-secondary text-sm font-medium rounded-lg">Back to Hub</button>
        </div>
      );
    }
    return (
      <InventoryOutView
        onBackToHub={() => handleSelectSubmodule(null)}
        assignedUsers={assignedUsers.inventoryOutUsers}
        currentUser={currentUser}
      />
    );
  }

  // Render Submodule 3: Inventory Approval
  if (activeSubmodule === "approval") {
    return (
      <InventoryApprovalView
        onBackToHub={() => handleSelectSubmodule(null)}
      />
    );
  }

  // Render Submodule 4: View Inventory
  if (activeSubmodule === "view") {
    if (!hasModuleAccess("view-inventory")) {
      return (
        <div className="p-8 text-center bg-background border border-border rounded-2xl">
          <p className="text-red-500 font-semibold mb-2">Access Denied</p>
          <p className="text-sm text-muted-foreground mb-4">You do not have permission to view Master Inventory.</p>
          <button onClick={() => handleSelectSubmodule(null)} className="px-4 py-2 bg-secondary text-sm font-medium rounded-lg">Back to Hub</button>
        </div>
      );
    }
    return (
      <ViewInventoryView
        onBackToHub={() => handleSelectSubmodule(null)}
      />
    );
  }

  // Render Submodule 5: Inventory Request
  if (activeSubmodule === "request") {
    return (
      <InventoryRequestView
        onBackToHub={() => handleSelectSubmodule(null)}
      />
    );
  }

  // Render Submodule 6: Inventory Alert
  if (activeSubmodule === "alert") {
    if (!hasModuleAccess("inventory-alert")) {
      return (
        <div className="p-8 text-center bg-background border border-border rounded-2xl">
          <p className="text-red-500 font-semibold mb-2">Access Denied</p>
          <p className="text-sm text-muted-foreground mb-4">You do not have permission to view Inventory Alerts.</p>
          <button onClick={() => handleSelectSubmodule(null)} className="px-4 py-2 bg-secondary text-sm font-medium rounded-lg">Back to Hub</button>
        </div>
      );
    }
    return (
      <InventoryAlertView
        onBackToHub={() => handleSelectSubmodule(null)}
      />
    );
  }

  // Render Submodule 7: General / Consumables
  if (activeSubmodule === "general") {
    if (!hasModuleAccess("general-consumables")) {
      return (
        <div className="p-8 text-center bg-background border border-border rounded-2xl">
          <p className="text-red-500 font-semibold mb-2">Access Denied</p>
          <p className="text-sm text-muted-foreground mb-4">You do not have permission to view Tools & Consumables.</p>
          <button onClick={() => handleSelectSubmodule(null)} className="px-4 py-2 bg-secondary text-sm font-medium rounded-lg">Back to Hub</button>
        </div>
      );
    }
    return (
      <GeneralConsumablesView
        onBackToHub={() => handleSelectSubmodule(null)}
      />
    );
  }

  // Render Upcoming Submodules
  if (activeSubmodule) {
    const selectedObj = INVENTORY_SUBMODULES.find((s) => s.id === activeSubmodule) || {
      id: activeSubmodule,
      title: `Submodule: ${activeSubmodule}`,
      description: "Submodule under development.",
      icon: Package,
    };
    return (
      <UpcomingSubmoduleView
        submodule={selectedObj}
        onBack={() => handleSelectSubmodule(null)}
      />
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // Main Inventory Hub: The Submodules Grid
  // ═════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs shrink-0">
            <Package className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground truncate">
                Inventory Dashboard
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
                5 Modules
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage stock inward, outward dispatches, inventory catalog, alerts, and tool requests.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          {currentUser?.role === "ADMIN" && (
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-xl border border-border bg-background hover:bg-secondary text-foreground transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer group"
              title="Inventory Access Settings (Configure Employee Permissions)"
            >
              <Settings className="h-4 w-4 text-primary group-hover:rotate-45 transition-transform" />
              <span className="text-xs sm:text-sm font-semibold">Access Settings</span>
            </button>
          )}
        </div>
      </div>

      {/* Submodules Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h2 className="font-display text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-primary shrink-0" />
            <span>Select Inventory Submodule</span>
          </h2>
          <span className="text-[11px] sm:text-xs text-muted-foreground">
            Centralized inventory, inward, outward, alerts &amp; consumables
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {INVENTORY_SUBMODULES.filter((sub) => hasModuleAccess(sub.key)).map((sub) => {
            const Icon = sub.icon;
            const isActive = sub.badgeType === "active";

            return (
              <div
                key={sub.id}
                onClick={() => handleSelectSubmodule(sub.id)}
                className={`group relative rounded-2xl border bg-background p-6 card-shadow transition-all cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? "border-primary/40 hover:border-primary hover:shadow-lg hover:-translate-y-0.5 bg-gradient-to-b from-primary/[0.03] to-transparent ring-1 ring-primary/20"
                    : "border-border hover:border-border hover:bg-secondary/20 hover:shadow-md"
                }`}
              >
                <div>
                  {/* Top Bar inside Card */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-secondary text-foreground"
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        isActive
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-secondary text-muted-foreground border-border"
                      }`}
                    >
                      {sub.badge}
                    </span>
                  </div>

                  {/* Title & Tagline */}
                  <h3 className="font-display text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                    {sub.title}
                  </h3>
                  <p className="text-xs font-medium text-primary/80 mt-0.5">
                    {sub.tagline}
                  </p>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2.5 leading-relaxed">
                    {sub.description}
                  </p>
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-5 pt-3.5 border-t border-border flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                      isActive
                        ? "text-primary group-hover:underline"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    <span>{sub.buttonText}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>

                  {isActive && (
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inventory Settings (Employee Access) Modal */}
      <InventorySettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default Inventory;
