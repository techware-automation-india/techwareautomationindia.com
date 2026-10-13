import { useState, useEffect } from "react";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import {
  Package, PackagePlus, PackageMinus, Boxes, CheckCircle2,
  Inbox, AlertTriangle, ArrowRight, ArrowLeft, RefreshCw,
  FolderTree, ShieldCheck, ClipboardList, Bell, Layers, Sparkles, Wrench,
  User, Users
} from "lucide-react";
import InventoryInView from "../components/inventory/InventoryInView.jsx";
import InventoryOutView from "../components/inventory/InventoryOutView.jsx";
import InventoryApprovalView from "../components/inventory/InventoryApprovalView.jsx";
import ViewInventoryView from "../components/inventory/ViewInventoryView.jsx";
import InventoryRequestView from "../components/inventory/InventoryRequestView.jsx";
import InventoryAlertView from "../components/inventory/InventoryAlertView.jsx";
import GeneralConsumablesView from "../components/inventory/GeneralConsumablesView.jsx";
import { hasModuleAccess } from "../../lib/permissions.js";
import { apiGet } from "../../lib/api.js";
import { getAuthUser } from "../../lib/auth.js";

// ═══════════════════════════════════════════════════════════════════════
// INVENTORY SUBMODULES DEFINITIONS (Core Inventory Submodules)
// ═══════════════════════════════════════════════════════════════════════
const INVENTORY_SUBMODULES = [
  {
    id: "in",
    key: "inventory-in",
    title: "1. Inventory In",
    tagline: "Material Inward Register & Category Tree",
    description:
      "Track product inward entries (stock IN logs), create & edit hierarchical categories (up to 4 levels), and register items at any level.",
    icon: PackagePlus,
    badge: "Active Module",
    badgeType: "active",
    color: "from-blue-600/10 to-indigo-600/10 text-blue-600 border-blue-500/30",
    buttonText: "Open Inventory In",
  },
  {
    id: "out",
    key: "inventory-out",
    title: "2. Inventory Out",
    tagline: "Material Outward Register & Allocations",
    description:
      "Track product outward entries (stock OUT logs), dispatch products and materials to employees, running projects, or client organizations with status and return tracking.",
    icon: PackageMinus,
    badge: "Active Module",
    badgeType: "active",
    color: "from-amber-600/10 to-orange-600/10 text-amber-600 border-amber-500/30",
    buttonText: "Open Inventory Out",
  },
  {
    id: "view",
    key: "view-inventory",
    title: "3. View Inventory",
    tagline: "Master Stock Catalog & Valuation",
    description:
      "Comprehensive catalog of all company materials, workshop assets, category filters, physical locations, and stock summaries.",
    icon: Boxes,
    badge: "Active Module",
    badgeType: "active",
    color: "from-violet-600/10 to-purple-600/10 text-violet-600 border-violet-500/30",
    buttonText: "Open View Inventory",
  },
  {
    id: "alert",
    key: "inventory-alert",
    title: "4. Inventory Alert",
    tagline: "Low Stock & Threshold Warnings",
    description:
      "Real-time notifications for items running below minimum stock limits, zero-stock items, and automated reorder alerts.",
    icon: Bell,
    badge: "Active Module",
    badgeType: "active",
    color: "from-rose-600/10 to-red-600/10 text-rose-600 border-rose-500/30",
    buttonText: "Open Inventory Alert",
  },
  {
    id: "general",
    key: "general-consumables",
    title: "5. Tools / Consumables",
    tagline: "2 Folders: Tools & General / Consumables",
    description:
      "Dedicated management for employee tool requests and general consumable product taking history organized into Tools and General / Consumables folders.",
    icon: Wrench,
    badge: "Active Module",
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

      <div className="rounded-2xl border border-border bg-background p-10 card-shadow text-center max-w-2xl mx-auto space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-secondary/80 flex items-center justify-center mx-auto text-primary">
          <Icon className="h-8 w-8" />
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 mb-3">
            <Sparkles className="h-3.5 w-3.5" /> Next Phase of Inventory System
          </span>
          <h2 className="font-display text-2xl font-bold text-foreground">
            {submodule.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {submodule.description}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-secondary/40 border border-border text-xs text-muted-foreground leading-relaxed text-left space-y-2">
          <p className="font-semibold text-foreground">
            Development Plan Note:
          </p>
          <p>
            As requested, <strong>Sub-module 1 (Inventory In)</strong> has been prioritized and developed first with flexible 4-level category hierarchy and custom item cards.
          </p>
          <p>
            Once you review and approve <strong>Inventory In</strong>, specifications and workflows for <strong>{submodule.title}</strong> will be implemented in the next phase.
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
    setActiveSubmodule(nextSub);
  }, [paramSubmodule, searchParams.get("submodule"), searchParams.get("tab")]);

  const handleSelectSubmodule = (subId) => {
    setActiveSubmodule(subId);
    if (subId) {
      setSearchParams({ submodule: subId });
    } else {
      searchParams.delete("submodule");
      searchParams.delete("tab");
      setSearchParams(searchParams);
    }
  };

  // Render Submodule 1: Inventory In
  if (activeSubmodule === "in") {
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
    return (
      <InventoryAlertView
        onBackToHub={() => handleSelectSubmodule(null)}
      />
    );
  }

  // Render Submodule 7: General / Consumables
  if (activeSubmodule === "general") {
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
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex items-start justify-between flex-wrap gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
            <Package className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
                Inventory Management System
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                5 Sub-Modules
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-2xl">
              Flexible multi-tier inventory architecture designed for Techware Automation. Manage categories up to 4 levels, items at any level, custom specifications, photos, and stock movements.
            </p>
          </div>
        </div>

        <button
          onClick={() => handleSelectSubmodule("in")}
          className="cta-gradient text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm cursor-pointer"
        >
          <PackagePlus className="h-4 w-4" /> Go to Inventory In
        </button>
      </div>

      {/* 6 Submodules Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-primary" />
            <span>Select Inventory Submodule</span>
          </h2>
          <span className="text-xs text-muted-foreground">
            Phase 1: Submodule 1 (Inventory In) is active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  <h3 className="font-display text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                    {sub.title}
                  </h3>
                  <p className="text-xs font-medium text-primary/80 mt-0.5">
                    {sub.tagline}
                  </p>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                    {sub.description}
                  </p>

                  {/* Assigned Personnel Names */}
                  {sub.id === "in" && assignedUsers.inventoryInUsers?.length > 0 && (
                    <div className="mt-3.5 pt-3 border-t border-border/70">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground mb-1.5">
                        <Users className="h-3.5 w-3.5 text-blue-600" />
                        <span>Assigned Access Personnel:</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {assignedUsers.inventoryInUsers.map((u) => (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                          >
                            <User className="h-2.5 w-2.5" />
                            {u.fullName} {u.role === "ADMIN" ? "(Admin)" : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {sub.id === "out" && assignedUsers.inventoryOutUsers?.length > 0 && (
                    <div className="mt-3.5 pt-3 border-t border-border/70">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground mb-1.5">
                        <Users className="h-3.5 w-3.5 text-amber-600" />
                        <span>Assigned Access Personnel:</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {assignedUsers.inventoryOutUsers.map((u) => (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                          >
                            <User className="h-2.5 w-2.5" />
                            {u.fullName} {u.role === "ADMIN" ? "(Admin)" : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
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

      {/* Flexible Design Info Box */}
      <div className="rounded-2xl border border-border bg-secondary/30 p-6 card-shadow space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h3 className="font-display text-base font-bold text-foreground">
            Techware Flexible Inventory Architecture
          </h3>
        </div>
        <div className="grid md:grid-cols-3 gap-4 text-xs text-muted-foreground">
          <div className="p-3.5 rounded-xl bg-background border border-border">
            <span className="font-semibold text-foreground block mb-1">
              1. Unlimited Custom Categories
            </span>
            Create any number of root categories and subcategories dynamically without hardcoded limits.
          </div>
          <div className="p-3.5 rounded-xl bg-background border border-border">
            <span className="font-semibold text-foreground block mb-1">
              2. Strict 4-Level Hierarchy
            </span>
            Nesting supported up to 4 levels. At Level 4, subcategory creation is locked and items are listed.
          </div>
          <div className="p-3.5 rounded-xl bg-background border border-border">
            <span className="font-semibold text-foreground block mb-1">
              3. Items at Any Level
            </span>
            Items can be listed directly at Level 1, 2, 3, or 4 with photo, code, qty, and 5 specifications.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
