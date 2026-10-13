import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Wrench,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Clock,
  Clock3,
  UserCheck,
  ShieldCheck,
  Zap,
  Cog,
  Loader2,
  Box,
  RefreshCw,
  LayoutGrid,
  List,
  Plus,
  FolderKanban,
  Tag,
  X,
  Sparkles,
  RotateCcw,
  PackageCheck,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";

const fmtDateTime = (val) => {
  if (!val) return "—";
  const date = new Date(val);
  if (Number.isNaN(date.getTime())) return String(val);
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, "0");

  return `${d}/${m}/${y}, ${formattedHours}:${minutes} ${ampm}`;
};

const extractFieldFromDesc = (desc, fieldName) => {
  if (!desc) return "";
  const match = desc.match(new RegExp(`${fieldName}:\\s*(.+)`, "i"));
  return match ? match[1].trim() : "";
};

const getToolTypeByName = (itemName = "", productType = "") => {
  const combined = `${itemName} ${productType}`.toLowerCase();
  if (
    combined.includes("electric") ||
    combined.includes("multi") ||
    combined.includes("meter") ||
    combined.includes("volt") ||
    combined.includes("amp") ||
    combined.includes("wire") ||
    combined.includes("cable") ||
    combined.includes("test")
  ) {
    return "Electrical";
  }
  if (
    combined.includes("safety") ||
    combined.includes("helmet") ||
    combined.includes("glove") ||
    combined.includes("goggle") ||
    combined.includes("jacket") ||
    combined.includes("ppe")
  ) {
    return "Safety";
  }
  return "Mechanical";
};

const getReviewerInfo = (req) => {
  if (!req) return "Admin / Operations";

  if (req.reviewedBy) {
    if (typeof req.reviewedBy === "string" && req.reviewedBy.trim()) return req.reviewedBy.trim();
    if (typeof req.reviewedBy === "object") {
      if (req.reviewedBy.fullName) return req.reviewedBy.fullName;
      if (req.reviewedBy.name) return req.reviewedBy.name;
      if (req.reviewedBy.email) return req.reviewedBy.email.split("@")[0];
    }
  }

  if (req.approvedBy) {
    if (typeof req.approvedBy === "string" && req.approvedBy.trim()) return req.approvedBy.trim();
    if (typeof req.approvedBy === "object") {
      if (req.approvedBy.fullName) return req.approvedBy.fullName;
      if (req.approvedBy.name) return req.approvedBy.name;
    }
  }

  if (req.reviewerName) return req.reviewerName;

  const text = String(req.reviewNote || req.adminNote || req.description || "").trim();

  const matchName = text.match(/(?:Approved|Rejected|Found)\s+by\s+([^:|\.]+)/i);
  if (matchName && matchName[1]) {
    const name = matchName[1].trim();
    if (name) return name;
  }

  return "Admin / Operations";
};

const getReturnStep = (req) => {
  const text = `${req?.status || ""} ${req?.reviewNote || ""} ${req?.adminNote || ""} ${req?.description || ""}`.toUpperCase();
  if (text.includes("[PRODUCT_FOUND]") || req?.status === "COMPLETED") return 4;
  if (text.includes("[ITEM_RETURNED]") || text.includes("[PHYSICALLY_RETURNED]")) return 3;
  if (text.includes("[QUALITY_INSPECTED]") || req?.status === "APPROVED") return 2;
  return 1;
};

export default function MyTools() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [toolsList, setToolsList] = useState([]);
  const [activeTab, setActiveTab] = useState("ACTIVE"); // "ACTIVE" | "NOT_RECEIVED" | "RECEIVED"
  const [returnsReceivedList, setReturnsReceivedList] = useState([]);
  const [returnsNotReceivedList, setReturnsNotReceivedList] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState("table");
  const [refreshing, setRefreshing] = useState(false);
  const [pendingTools, setPendingTools] = useState([]);
  const [actingToolId, setActingToolId] = useState(null);

  const handleMarkToolFound = async (id) => {
    if (actingToolId) return;
    setActingToolId(id);
    try {
      await apiPost(`/requests/${id}/found`, {});
      toast.success("Tool marked as found and added to your tools!");
      await fetchProfileAndTools(true);
    } catch (err) {
      toast.error(err.message || "Failed to mark tool as found.");
    } finally {
      setActingToolId(null);
    }
  };

  const handleMarkToolNotFound = async (id) => {
    if (actingToolId) return;
    setActingToolId(id);
    try {
      await apiPost(`/requests/${id}/not-found`, {
        reason: "Tool not found on workshop rack.",
      });
      toast.warning("Reported as Tool Not Found. Admin has been notified.");
      await fetchProfileAndTools(true);
    } catch (err) {
      toast.error(err.message || "Failed to report tool not found.");
    } finally {
      setActingToolId(null);
    }
  };

  const handleReturnTool = (tool) => {
    navigate("/employee/requests/tools-inventory", {
      state: {
        actionType: "Return",
        category: "Tools",
        productId: tool?.productId || "",
        itemName: tool?.toolName || "",
        projectName: "",
        productType: tool?.type || "",
      },
    });
  };

  const handlePhysicalReturn = async (tool) => {
    const targetId = tool.returnRequestId || tool.id;
    if (!targetId) return;
    try {
      setSubmittingId(tool.id);
      await apiPost(`/requests/${targetId}/item-return`, {});
      toast.success("Item Return confirmed! Item handed over to store/admin.");
      await fetchProfileAndTools(true);
    } catch (err) {
      toast.error(err.message || "Failed to confirm Item Return.");
    } finally {
      setSubmittingId(null);
    }
  };

  const fetchProfileAndTools = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [profileRes, requestsRes] = await Promise.allSettled([
        apiGet("/onboarding/me"),
        apiGet("/requests/my"),
      ]);

      const prof = profileRes.status === "fulfilled" ? profileRes.value?.profile : null;
      setProfile(prof);

      const rawRequests = requestsRes.status === "fulfilled" ? (requestsRes.value?.requests || []) : [];

      // Sort requests chronologically (oldest first) to accurately process TAKING then RETURN
      const sortedRequests = [...rawRequests].sort(
        (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      );

      const activeToolsMap = new Map();
      const pendingToolsList = [];
      const returnsRecTemp = [];
      const returnsNotRecTemp = [];

      sortedRequests.forEach((req) => {
        const isEquipment =
          req.type === "EQUIPMENT" ||
          (req.subject && (req.subject.includes("[Inventory") || req.subject.toLowerCase().includes("tool"))) ||
          (req.description && req.description.includes("Action Type:"));

        if (!isEquipment) return;

        const desc = req.description || "";

        // STRICT RULE: ONLY requests where Category is strictly "Tools" (or tool requests) are saved in My Tools.
        // ALL other categories ("Project", "Product", "General / Consumables", etc.) ARE EXPLICITLY EXCLUDED.
        const categoryVal = extractFieldFromDesc(desc, "Category").toLowerCase().trim();
        const hasProjectInDesc = Boolean(extractFieldFromDesc(desc, "Project Name"));
        const hasProjectInSubject = Boolean(req.subject && req.subject.match(/\[Inventory (?:Taking|Return):\s*([^\]]+)\]/i));

        if (categoryVal) {
          // If Category field exists, it MUST be "tools" or contain "tool"
          if (categoryVal !== "tools" && !categoryVal.includes("tool")) {
            return; // Explicitly exclude Project, Product, General / Consumables, etc.
          }
        } else {
          // Fallback for legacy requests without Category header: exclude if any project name is associated
          if (hasProjectInDesc || hasProjectInSubject) {
            return;
          }
        }

        const actionTypeStr = extractFieldFromDesc(desc, "Action Type").toUpperCase();
        const isReturn =
          actionTypeStr === "RETURN" ||
          (req.subject && req.subject.toLowerCase().includes("inventory return"));

        const productId =
          extractFieldFromDesc(desc, "Product ID") ||
          (req.subject?.match(/ID:\s*([^)]+)/i)?.[1] || "").trim();

        const itemName =
          extractFieldFromDesc(desc, "Item Name") ||
          (req.subject?.match(/\]\s*([^(]+)/)?.[1] || req.subject || "Tool Item").trim();

        const key = (productId || itemName).toLowerCase();

        if (isReturn) {
          const step = getReturnStep(req);
          const productType = extractFieldFromDesc(desc, "Product Type");
          const toolType = getToolTypeByName(itemName, productType);
          const reviewerName = getReviewerInfo(req);
          const reqCreateDate = fmtDateTime(req.createdAt);
          const reqApproveDate =
            req.reviewedAt || (req.status !== "PENDING" && req.updatedAt)
              ? fmtDateTime(req.reviewedAt || req.updatedAt)
              : "Pending Approval";
          const reqReceivedDate = step === 4 ? fmtDateTime(req.updatedAt || req.createdAt) : null;

          const returnItem = {
            id: req.id || req._id,
            toolName: itemName,
            productId: productId,
            category: categoryVal || "Tools",
            projectName: extractFieldFromDesc(desc, "Project Name") || "AutoCard Assembly Line 1",
            type: toolType,
            createdDate: reqCreateDate,
            approvedDate: reqApproveDate,
            receivedDate: reqReceivedDate,
            approvedBy: reviewerName,
            status: req.status,
            step: step,
            reviewNote: req.reviewNote || req.adminNote || req.description || "",
            rawRequest: req,
          };

          if (step === 4) {
            returnsRecTemp.push(returnItem);
            // Step 4: Found Item & Restocked -> Remove from active tools list
            activeToolsMap.delete(key);
          } else {
            returnsNotRecTemp.push(returnItem);
            // Step 1 or 2: Return request in progress
            const existing = activeToolsMap.get(key);
            if (existing) {
              activeToolsMap.set(key, {
                ...existing,
                returnStep: step,
                returnRequestId: req.id || req._id,
                returnNote: req.reviewNote || req.description || "",
              });
            }
          }
        } else {
          const st = (req.status || "").toUpperCase();
          const note = (req.reviewNote || req.adminNote || "").toUpperCase();
          const isFoundItem =
            note.includes("[PRODUCT_FOUND]") || st === "FOUND" || st === "COMPLETED";

          // If product has not been physically received / marked found by employee, add to pending collection list
          if (!isFoundItem) {
            if (st === "APPROVED") {
              pendingToolsList.push({
                id: req.id || req._id,
                toolName: itemName,
                productId: productId,
                projectName: extractFieldFromDesc(desc, "Project Name") || "Workshop",
                createdAt: req.createdAt,
                reviewNote: req.reviewNote,
                isItemNotFound: note.includes("[ITEM_NOT_FOUND]"),
              });
            }
            return;
          }

          const projectName =
            extractFieldFromDesc(desc, "Project Name") ||
            (req.subject?.match(/\[Inventory (?:Taking|Return):\s*([^\]]+)\]/i)?.[1] || "").trim();

          const productType = extractFieldFromDesc(desc, "Product Type");
          const toolType = getToolTypeByName(itemName, productType);
          const reviewerName = getReviewerInfo(req);
          const approveTimeStr = fmtDateTime(req.updatedAt || req.createdAt);
          const foundTimeStr = isFoundItem ? fmtDateTime(req.updatedAt || req.createdAt) : "—";

          activeToolsMap.set(key, {
            id: req.id || req._id || key,
            toolName: itemName,
            productId: productId,
            projectName: projectName || "AutoCard Assembly Line 1",
            type: toolType,
            createdDate: fmtDateTime(req.createdAt),
            approvedDate: approveTimeStr,
            foundDate: foundTimeStr,
            approvedBy: reviewerName,
            status: isFoundItem ? "Product Found" : "Approved",
            isFound: isFoundItem,
            returnStep: 0,
          });
        }
      });

      // Parse onboarding profile fallback tools if available and not explicitly returned
      const rawOnboarding = prof?.assignedTools || "";
      let onboardingParsed = [];
      if (rawOnboarding.trim().startsWith("[") && rawOnboarding.trim().endsWith("]")) {
        try {
          onboardingParsed = JSON.parse(rawOnboarding);
        } catch {
          onboardingParsed = [];
        }
      }

      if (!Array.isArray(onboardingParsed) || onboardingParsed.length === 0) {
        const items = rawOnboarding
          .split(/,\s*|\n+/)
          .map((t) => t.trim())
          .filter(Boolean);

        const createDate = prof?.createdAt ? fmtDateTime(prof.createdAt) : "01/10/2026, 10:00 AM";
        const approveDate = prof?.updatedAt ? fmtDateTime(prof.updatedAt) : "02/10/2026, 11:30 AM";
        const foundDate = prof?.updatedAt ? fmtDateTime(prof.updatedAt) : "02/10/2026, 11:35 AM";

        onboardingParsed = items.map((item, index) => ({
          id: `onboard-${index + 1}`,
          toolName: item,
          productId: "",
          projectName: "AutoCard Assembly Line 1",
          type: getToolTypeByName(item),
          createdDate: createDate,
          approvedDate: approveDate,
          foundDate: foundDate,
          approvedBy: "Admin / Operations Manager",
          status: "Product Found",
          isFound: true,
        }));
      }

      // Merge onboarding tools if not already present in activeToolsMap from requests
      onboardingParsed.forEach((onbTool) => {
        const key = (onbTool.productId || onbTool.toolName || "").toLowerCase();
        if (key && !activeToolsMap.has(key)) {
          activeToolsMap.set(key, onbTool);
        }
      });

      setToolsList(Array.from(activeToolsMap.values()));
      setPendingTools(pendingToolsList);
      setReturnsReceivedList(returnsRecTemp.reverse());
      setReturnsNotReceivedList(returnsNotRecTemp.reverse());
    } catch (err) {
      console.error("Failed to load tools page data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfileAndTools();
  }, []);

  const filteredTools = toolsList.filter((t) => {
    const nameMatch =
      (t.toolName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.productId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.projectName || "").toLowerCase().includes(searchTerm.toLowerCase());
    const typeMatch =
      typeFilter === "ALL" ||
      (t.type || "").toUpperCase().includes(typeFilter.toUpperCase());
    return nameMatch && typeMatch;
  });

  const filteredReturnsReceived = useMemo(() => {
    if (!searchTerm) return returnsReceivedList;
    const s = searchTerm.toLowerCase();
    return returnsReceivedList.filter(
      (r) =>
        (r.toolName || "").toLowerCase().includes(s) ||
        (r.productId || "").toLowerCase().includes(s) ||
        (r.projectName || "").toLowerCase().includes(s)
    );
  }, [returnsReceivedList, searchTerm]);

  const filteredReturnsNotReceived = useMemo(() => {
    if (!searchTerm) return returnsNotReceivedList;
    const s = searchTerm.toLowerCase();
    return returnsNotReceivedList.filter(
      (r) =>
        (r.toolName || "").toLowerCase().includes(s) ||
        (r.productId || "").toLowerCase().includes(s) ||
        (r.projectName || "").toLowerCase().includes(s)
    );
  }, [returnsNotReceivedList, searchTerm]);

  const electricalCount = toolsList.filter(
    (t) => (t.type || "").toLowerCase() === "electrical"
  ).length;
  const mechanicalCount = toolsList.filter(
    (t) => (t.type || "").toLowerCase() === "mechanical"
  ).length;
  const safetyCount = toolsList.filter((t) =>
    (t.type || "").toLowerCase().includes("safety")
  ).length;
  const foundCount = toolsList.filter((t) => t.isFound || t.status === "Product Found").length;

  const getTypeBadge = (type) => {
    const t = (type || "").toLowerCase();
    if (t.includes("elect")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold shadow-xs">
          <Zap className="h-3.5 w-3.5 shrink-0" />
          Electrical
        </span>
      );
    }
    if (t.includes("mech")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold shadow-xs">
          <Cog className="h-3.5 w-3.5 shrink-0" />
          Mechanical
        </span>
      );
    }
    if (t.includes("safe")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold shadow-xs">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          Safety
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-foreground border border-border text-xs font-semibold shadow-xs">
        <Wrench className="h-3.5 w-3.5 shrink-0" />
        {type || "General"}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Premium Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-amber-500/10 via-primary/5 to-purple-500/10 p-6 md:p-8 shadow-sm backdrop-blur-xs">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 -mb-20 h-48 w-48 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-500/30 flex items-center justify-center shrink-0 shadow-md">
              <Wrench className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  My Tools & Equipment
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-semibold border border-amber-500/30">
                  <Sparkles className="h-3 w-3" /> Employee Access
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-xl leading-relaxed">
                Track allocated tools, equipment items, and project instruments. Request taking or return of tools directly from inventory.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/employee/requests/tools-inventory"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md hover:bg-primary/90 transition-all"
            >
              <Plus className="h-4 w-4" />
              Request Tool / Equipment
            </Link>

            <button
              type="button"
              onClick={() => fetchProfileAndTools(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-border bg-background hover:bg-secondary text-sm font-semibold transition-all shadow-xs shrink-0"
              title="Refresh tools list"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-primary" : ""}`} />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/60">
          <div
            onClick={() => setActiveTab("ACTIVE")}
            className={`rounded-2xl border p-4 backdrop-blur-md transition-all cursor-pointer ${
              activeTab === "ACTIVE"
                ? "border-amber-500 bg-amber-500/10 shadow-sm ring-2 ring-amber-500/20"
                : "border-border/70 bg-background/80 hover:border-amber-500/30"
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Active Tools</div>
            <div className="text-2xl font-black text-foreground mt-1 font-mono">{toolsList.length}</div>
          </div>

          <div
            onClick={() => setActiveTab("NOT_RECEIVED")}
            className={`rounded-2xl border p-4 backdrop-blur-md transition-all cursor-pointer ${
              activeTab === "NOT_RECEIVED"
                ? "border-amber-500 bg-amber-500/15 shadow-sm ring-2 ring-amber-500/20"
                : "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40"
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Returns Not Received</div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">{returnsNotReceivedList.length}</div>
          </div>

          <div
            onClick={() => setActiveTab("RECEIVED")}
            className={`rounded-2xl border p-4 backdrop-blur-md transition-all cursor-pointer ${
              activeTab === "RECEIVED"
                ? "border-emerald-500 bg-emerald-500/15 shadow-sm ring-2 ring-emerald-500/20"
                : "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40"
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Returns Received</div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">{returnsReceivedList.length}</div>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 backdrop-blur-md">
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Found / Issued</div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 font-mono">{foundCount || toolsList.length}</div>
          </div>
        </div>
      </div>

      {/* Three Major Segmented Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("ACTIVE")}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "ACTIVE"
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
        >
          <Wrench className="h-4 w-4" />
          <span>Active Assigned Tools ({toolsList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("NOT_RECEIVED")}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "NOT_RECEIVED"
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Returns Not Received by Store ({returnsNotReceivedList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RECEIVED")}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "RECEIVED"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>Returns Received by Store ({returnsReceivedList.length})</span>
        </button>
      </div>

      {/* Awaiting Collection / Found Decision Section (only shown on active tools tab) */}
      {activeTab === "ACTIVE" && pendingTools.length > 0 && (
        <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-5 backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <PackageCheck className="h-5 w-5 text-primary" />
              <span>Approved Tools Awaiting Workshop Collection ({pendingTools.length})</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Check workshop/storage and decide if tool is found or not found
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {pendingTools.map((pt) => (
              <div key={pt.id} className="p-3.5 rounded-xl border border-border bg-background shadow-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{pt.toolName}</h4>
                    {pt.productId && (
                      <span className="inline-block font-mono text-[11px] font-semibold text-muted-foreground">
                        ID: {pt.productId}
                      </span>
                    )}
                  </div>
                  {pt.isItemNotFound ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                      Reported Not Found
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      Admin Approved ✓
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleMarkToolFound(pt.id)}
                    disabled={actingToolId === pt.id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-xs font-bold hover:from-emerald-700 hover:to-emerald-800 transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {actingToolId === pt.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Item Found
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMarkToolNotFound(pt.id)}
                    disabled={actingToolId === pt.id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-rose-300 bg-white dark:bg-background text-rose-700 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/20 transition cursor-pointer disabled:opacity-50"
                  >
                    {actingToolId === pt.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                    Item Not Found
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control Bar: Search, Category Filters, and View Switcher */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={
              activeTab === "ACTIVE"
                ? "Search tools by name or Product ID..."
                : activeTab === "NOT_RECEIVED"
                ? "Search unreceived returns by name or Product ID..."
                : "Search received returns by name or Product ID..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filters and View Switcher (only for active tools) */}
        {activeTab === "ACTIVE" && (
          <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
            <div className="flex items-center gap-1.5 bg-secondary/60 p-1 rounded-xl border border-border shrink-0">
              <Filter className="h-3.5 w-3.5 text-muted-foreground ml-2 mr-1 shrink-0" />
              {[
                { label: "All", value: "ALL", count: toolsList.length },
                { label: "Electrical", value: "Electrical", count: electricalCount },
                { label: "Mechanical", value: "Mechanical", count: mechanicalCount },
                { label: "Safety", value: "Safety", count: safetyCount },
              ].map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setTypeFilter(cat.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                    typeFilter === cat.value
                      ? "bg-background text-foreground shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat.label} ({cat.count})
                </button>
              ))}
            </div>

            {/* Grid vs Table View Mode Switcher */}
            <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-xl border border-border shrink-0">
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Table View"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Card View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: ACTIVE ASSIGNED TOOLS */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === "ACTIVE" && (
        <>
          {loading ? (
            <div className="rounded-2xl border-2 border-border bg-background p-16 flex flex-col items-center justify-center text-muted-foreground shadow-xs">
              <Loader2 className="h-9 w-9 animate-spin text-amber-600 mb-3" />
              <p className="text-sm font-medium">Fetching allocated tools and equipment...</p>
            </div>
          ) : filteredTools.length > 0 ? (
            viewMode === "grid" ? (
              /* Grid View Cards */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredTools.map((tool, idx) => (
                  <div
                    key={idx}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-background p-5 shadow-xs transition-all hover:shadow-md hover:border-amber-500/30 flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      {/* Top Bar */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div>
                            <h3 className="font-bold text-foreground leading-snug">
                              {tool.toolName}
                            </h3>
                            {tool.productId ? (
                              <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                                <Tag className="h-3 w-3" /> {tool.productId}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground font-mono">
                                Auto-Assigned Tool
                              </span>
                            )}
                          </div>
                        </div>

                        {getTypeBadge(tool.type)}
                      </div>

                      {/* Details Badges */}
                      <div className="space-y-2 pt-2 border-t border-border/60 text-xs">
                        <div className="flex items-center justify-between py-1">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <FolderKanban className="h-3.5 w-3.5" /> Project Name
                          </span>
                          <span className="font-semibold text-foreground max-w-[170px] truncate">
                            {tool.projectName || "AutoCard Assembly Line 1"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-1">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" /> Requested On
                          </span>
                          <span className="font-medium text-foreground">
                            {tool.createdDate || "—"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-1">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Approve Time
                          </span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {tool.approvedDate || "—"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-1">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Clock3 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Found Item Time
                          </span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {tool.foundDate || "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Info & Action */}
                    <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <UserCheck className="h-3.5 w-3.5 text-primary" />
                        <span className="truncate max-w-[110px]">{tool.approvedBy}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {tool.returnStep === 1 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            Step 1: Return Pending Approval
                          </span>
                        ) : tool.returnStep === 2 ? (
                          <button
                            type="button"
                            onClick={() => handlePhysicalReturn(tool)}
                            disabled={submittingId === tool.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                            title="Click to submit Item Return"
                          >
                            {submittingId === tool.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            Item Return
                          </button>
                        ) : tool.returnStep === 3 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                            Item Returned ✓ (Awaiting Found Item)
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReturnTool(tool)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-all shadow-xs cursor-pointer"
                            title="Request Product Return"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Return Product
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Table View */
              <div className="rounded-2xl border border-border bg-background shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="py-4 px-4 sm:px-6">#</th>
                        <th className="py-4 px-4 sm:px-6">Product ID</th>
                        <th className="py-4 px-4 sm:px-6">Tool Name</th>
                        <th className="py-4 px-4 sm:px-6">Project Name</th>
                        <th className="py-4 px-4 sm:px-6">Category Type</th>
                        <th className="py-4 px-4 sm:px-6">Request Date &amp; Time</th>
                        <th className="py-4 px-4 sm:px-6">Approve Date &amp; Time</th>
                        <th className="py-4 px-4 sm:px-6">Found Item Date &amp; Time</th>
                        <th className="py-4 px-4 sm:px-6">Request Approved By</th>
                        <th className="py-4 px-4 sm:px-6">Status</th>
                        <th className="py-4 px-4 sm:px-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-sm">
                      {filteredTools.map((tool, idx) => (
                        <tr key={idx} className="hover:bg-secondary/30 transition-colors">
                          <td className="py-4 px-4 sm:px-6 text-xs text-muted-foreground font-mono">
                            {idx + 1}
                          </td>

                          <td className="py-4 px-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
                                <Wrench className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                              </div>
                              <div>
                                <span className="font-bold text-foreground block">
                                  {tool.toolName}
                                </span>
                                {tool.productId && (
                                  <span className="text-xs text-amber-600 dark:text-amber-400 font-mono font-semibold block mt-0.5">
                                    ID: {tool.productId}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4 sm:px-6">
                            <span className="font-bold text-foreground">
                              {tool.toolName}
                            </span>
                          </td>

                          <td className="py-4 px-4 sm:px-6">
                            <span className="text-xs font-medium text-foreground px-2.5 py-1 rounded-lg bg-secondary border border-border inline-block">
                              {tool.projectName || "AutoCard Assembly Line 1"}
                            </span>
                          </td>

                          <td className="py-4 px-4 sm:px-6">
                            {getTypeBadge(tool.type)}
                          </td>

                          <td className="py-4 px-4 sm:px-6 text-muted-foreground">
                            <div className="flex items-center gap-1.5 text-xs font-medium whitespace-nowrap">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                              <span>{tool.createdDate || "—"}</span>
                            </div>
                          </td>

                          <td className="py-4 px-4 sm:px-6 text-muted-foreground">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              <span>{tool.approvedDate || "—"}</span>
                            </div>
                          </td>

                          <td className="py-4 px-4 sm:px-6 text-muted-foreground">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              <Clock3 className="h-3.5 w-3.5 shrink-0" />
                              <span>{tool.foundDate || "—"}</span>
                            </div>
                          </td>

                          <td className="py-4 px-4 sm:px-6">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                                <UserCheck className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-xs font-medium text-foreground">
                                {tool.approvedBy || "Admin / Operations"}
                              </span>
                            </div>
                          </td>

                          <td className="py-4 px-4 sm:px-6">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                tool.isFound || tool.status === "Product Found"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                              }`}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {tool.status || "Approved"}
                            </span>
                          </td>

                          <td className="py-4 px-4 sm:px-6 text-right">
                            {tool.returnStep === 1 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 whitespace-nowrap">
                                Step 1: Return Pending Approval
                              </span>
                            ) : tool.returnStep === 2 ? (
                              <button
                                type="button"
                                onClick={() => handlePhysicalReturn(tool)}
                                disabled={submittingId === tool.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
                                title="Click to submit Item Return"
                              >
                                {submittingId === tool.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3.5 w-3.5" />
                                )}
                                Item Return
                              </button>
                            ) : tool.returnStep === 3 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 whitespace-nowrap">
                                Item Returned ✓ (Awaiting Found Item)
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReturnTool(tool)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Return Product
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            /* Empty State */
            <div className="rounded-2xl border-2 border-dashed border-border bg-background py-16 text-center flex flex-col items-center justify-center p-6 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-600">
                <Box className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">
                No Equipment Found
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-5">
                {searchTerm || typeFilter !== "ALL"
                  ? "No tools match your current search or category filter."
                  : "No tools or equipment are currently allocated to your profile."}
              </p>
              <Link
                to="/employee/requests/tools-inventory"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-xs hover:bg-primary/90 transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> Request Tool from Inventory
              </Link>
            </div>
          )}
        </>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: RETURNS NOT RECEIVED BY STORE */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === "NOT_RECEIVED" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold text-foreground block">
                Returns Not Yet Received in Store ({returnsNotReceivedList.length})
              </span>
              <p className="text-muted-foreground mt-0.5">
                These are items you requested to return that have not yet been physically verified &amp; restocked into the store warehouse.
                If approved, please click <strong className="text-purple-600">"Item Return (Hand Over)"</strong> to hand the physical tool over to store operations.
              </p>
            </div>
          </div>

          {filteredReturnsNotReceived.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border bg-background py-16 text-center flex flex-col items-center justify-center p-6 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-600">
                <RotateCcw className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">
                No Unreceived Returns Pending
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {searchTerm
                  ? "No pending returns match your search term."
                  : "You have no active returns waiting to be received by the store."}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-background shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="py-4 px-4 sm:px-6">#</th>
                      <th className="py-4 px-4 sm:px-6">Product ID</th>
                      <th className="py-4 px-4 sm:px-6">Item / Tool Name</th>
                      <th className="py-4 px-4 sm:px-6">Project / Category</th>
                      <th className="py-4 px-4 sm:px-6">Return Requested On</th>
                      <th className="py-4 px-4 sm:px-6">Store Approval Date</th>
                      <th className="py-4 px-4 sm:px-6">Return Status</th>
                      <th className="py-4 px-4 sm:px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {filteredReturnsNotReceived.map((item, idx) => {
                      const isPending = item.step === 1 || item.status === "PENDING";
                      const isApproved = item.step === 2 || item.status === "APPROVED";
                      const isHandedOver = item.step === 3;

                      return (
                        <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="py-4 px-4 sm:px-6 text-xs text-muted-foreground font-mono">
                            {idx + 1}
                          </td>

                          <td className="py-4 px-4 sm:px-6 font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                            {item.productId || "—"}
                          </td>

                          <td className="py-4 px-4 sm:px-6">
                            <span className="font-bold text-foreground block">
                              {item.toolName}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              Category: {item.category}
                            </span>
                          </td>

                          <td className="py-4 px-4 sm:px-6">
                            <span className="text-xs font-medium text-foreground px-2.5 py-1 rounded-lg bg-secondary border border-border inline-block">
                              {item.projectName}
                            </span>
                          </td>

                          <td className="py-4 px-4 sm:px-6 text-muted-foreground text-xs">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                              <span>{item.createdDate}</span>
                            </div>
                          </td>

                          <td className="py-4 px-4 sm:px-6 text-xs">
                            {item.approvedDate ? (
                              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                <span>{item.approvedDate}</span>
                              </div>
                            ) : (
                              <span className="text-amber-600 italic">Pending Approval</span>
                            )}
                          </td>

                          <td className="py-4 px-4 sm:px-6">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                                isHandedOver
                                  ? "bg-purple-100 text-purple-800 border-purple-500/30 dark:bg-purple-950/40 dark:text-purple-300"
                                  : isApproved
                                  ? "bg-blue-100 text-blue-700 border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300"
                                  : "bg-amber-100 text-amber-700 border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300"
                              }`}
                            >
                              {isHandedOver ? (
                                <>
                                  <RotateCcw className="h-3 w-3" />
                                  <span>Handed Over (Awaiting Store Restock)</span>
                                </>
                              ) : isApproved ? (
                                <>
                                  <ShieldCheck className="h-3 w-3" />
                                  <span>Approved (Ready for Handover)</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="h-3 w-3" />
                                  <span>Pending Store Approval</span>
                                </>
                              )}
                            </span>
                          </td>

                          <td className="py-4 px-4 sm:px-6 text-right">
                            {isApproved ? (
                              <button
                                type="button"
                                onClick={() => handlePhysicalReturn(item)}
                                disabled={submittingId === item.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                                title="Click to hand over item to store operations"
                              >
                                {submittingId === item.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3.5 w-3.5" />
                                )}
                                Item Return (Hand Over)
                              </button>
                            ) : isHandedOver ? (
                              <span className="inline-flex items-center gap-1 text-xs text-purple-600 font-semibold bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20">
                                <Clock className="h-3.5 w-3.5" /> Awaiting Store Confirmation
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                Pending Approval
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: RETURNS RECEIVED BY STORE */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === "RECEIVED" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold text-foreground block">
                Returns Successfully Received in Store ({returnsReceivedList.length})
              </span>
              <p className="text-muted-foreground mt-0.5">
                These returned items have been physically received, verified, and restocked into warehouse inventory by store operations.
              </p>
            </div>
          </div>

          {filteredReturnsReceived.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border bg-background py-16 text-center flex flex-col items-center justify-center p-6 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">
                No Returns Received Yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {searchTerm
                  ? "No received returns match your search term."
                  : "You have no returns recorded as physically received in store yet."}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-background shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="py-4 px-4 sm:px-6">#</th>
                      <th className="py-4 px-4 sm:px-6">Product ID</th>
                      <th className="py-4 px-4 sm:px-6">Item / Tool Name</th>
                      <th className="py-4 px-4 sm:px-6">Project / Category</th>
                      <th className="py-4 px-4 sm:px-6">Return Requested On</th>
                      <th className="py-4 px-4 sm:px-6">Received &amp; Restocked Date</th>
                      <th className="py-4 px-4 sm:px-6">Verified / Received By</th>
                      <th className="py-4 px-4 sm:px-6 text-right">Store Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {filteredReturnsReceived.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="py-4 px-4 sm:px-6 text-xs text-muted-foreground font-mono">
                          {idx + 1}
                        </td>

                        <td className="py-4 px-4 sm:px-6 font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                          {item.productId || "—"}
                        </td>

                        <td className="py-4 px-4 sm:px-6">
                          <span className="font-bold text-foreground block">
                            {item.toolName}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Category: {item.category}
                          </span>
                        </td>

                        <td className="py-4 px-4 sm:px-6">
                          <span className="text-xs font-medium text-foreground px-2.5 py-1 rounded-lg bg-secondary border border-border inline-block">
                            {item.projectName}
                          </span>
                        </td>

                        <td className="py-4 px-4 sm:px-6 text-muted-foreground text-xs">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                            <span>{item.createdDate}</span>
                          </div>
                        </td>

                        <td className="py-4 px-4 sm:px-6 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span>{item.receivedDate || item.approvedDate || "Received"}</span>
                          </div>
                        </td>

                        <td className="py-4 px-4 sm:px-6 text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{item.approvedBy}</span>
                          </div>
                        </td>

                        <td className="py-4 px-4 sm:px-6 text-right">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Received &amp; Restocked ✓</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
