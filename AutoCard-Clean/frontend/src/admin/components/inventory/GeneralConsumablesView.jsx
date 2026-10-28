import { useState, useEffect, useMemo } from "react";
import {
  Wrench,
  Layers,
  Folder,
  Search,
  RefreshCw,
  ArrowLeft,
  PackagePlus,
  PackageMinus,
  History,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Loader2,
  Check,
  Ban,
  Tag,
  Eye,
  X,
  Calendar,
  RotateCcw,
  Sparkles,
  ChevronRight,
  PackageCheck,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPut, apiPost } from "../../../lib/api.js";
import { canPerformAction } from "../../../lib/permissions.js";

const formatDate = (val) => {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const formatTime = (val) => {
  if (!val) return "";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const resolveImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
};

// Helper function to parse employee request descriptions into structured data
const parseTakingRequest = (req) => {
  const desc = req.description || "";
  const lines = desc.split("\n");
  const data = {};

  lines.forEach((l) => {
    const idx = l.indexOf(":");
    if (idx !== -1) {
      const k = l.slice(0, idx).trim().toLowerCase();
      const v = l.slice(idx + 1).trim();
      data[k] = v;
    }
  });

  const category = data["category"] || "";
  const productType = data["product type"] || "";
  const itemName = data["item name"] || req.subject || "Unnamed Item";
  const productId = data["product id"] || data["part code"] || "—";
  const quantity = data["quantity"] || "1";
  const unitPrice = data["unit price"] || data["price"] || "0";
  const actionType = (
    data["action type"] ||
    (req.subject?.toLowerCase().includes("return") ? "RETURN" : "TAKING")
  ).toUpperCase();
  const purpose =
    data["purpose / work details / remarks"] || data["purpose"] || req.description || "—";
  const date = data["date"] || req.createdAt;

  const catLower = category.toLowerCase().trim();
  const typeLower = productType.toLowerCase().trim();
  const nameLower = itemName.toLowerCase().trim();
  const subjLower = (req.subject || "").toLowerCase().trim();

  const isConsumable =
    catLower === "general / consumables" ||
    catLower === "general" ||
    catLower === "consumable" ||
    catLower === "consumables" ||
    catLower.includes("general") ||
    catLower.includes("consumable") ||
    typeLower.includes("consumable") ||
    typeLower.includes("general");

  const isTool =
    !isConsumable && (
      catLower === "tools" ||
      catLower.includes("tool") ||
      subjLower.includes("tool")
    );

  const folderType = isTool ? "tools" : "general";

  const isReturnRequest =
    actionType === "RETURN" ||
    (req.subject || "").toLowerCase().includes("return") ||
    desc.toLowerCase().includes("action type: return");

  const isReturnReceived =
    isReturnRequest &&
    (req.status === "COMPLETED" ||
      req.status === "RETURNED" ||
      Boolean(req.reviewNote && req.reviewNote.includes("[PRODUCT_FOUND]")));

  const isReturnHandedOver =
    isReturnRequest &&
    !isReturnReceived &&
    Boolean(req.reviewNote && req.reviewNote.includes("[ITEM_RETURNED]"));

  const isCompletedOrFound =
    req.status === "COMPLETED" ||
    req.status === "FOUND" ||
    req.status === "ISSUED" ||
    desc.toLowerCase().includes("product found") ||
    desc.toLowerCase().includes("collected by employee");

  let effectiveStatus = req.status || "PENDING";
  if (isReturnRequest) {
    if (isReturnReceived) effectiveStatus = "RETURNED";
    else if (isReturnHandedOver) effectiveStatus = "HANDED_OVER";
    else if (req.status === "APPROVED") effectiveStatus = "APPROVED";
    else if (req.status === "REJECTED") effectiveStatus = "REJECTED";
    else effectiveStatus = "PENDING";
  } else {
    if (isCompletedOrFound) effectiveStatus = "ISSUED";
    else effectiveStatus = req.status || "PENDING";
  }

  const creationDate = req.createdAt;
  const approvalDate = req.reviewedAt || (req.status !== "PENDING" ? req.updatedAt : null);
  const productFoundDate = (isReturnRequest ? isReturnReceived : isCompletedOrFound)
    ? req.updatedAt || req.reviewedAt || req.createdAt
    : null;

  return {
    id: req.id,
    employeeName: req.employee?.fullName || req.employee?.user?.fullName || "Employee",
    employeeCode: req.employee?.employeeCode || req.employee?.id || "EMP",
    employeeAvatar: req.employee?.user?.avatar || req.employee?.user?.profilePicture || null,
    itemName,
    productId,
    category: category || (isTool ? "Tools" : "General / Consumables"),
    productType: productType || (isTool ? "Tools" : "General / Consumables"),
    quantityRequested: Number(quantity) || 1,
    quantityApproved: req.status !== "PENDING" && req.status !== "REJECTED" ? Number(quantity) || 1 : 0,
    unitPrice: Number(unitPrice) || 0,
    actionType,
    purpose,
    date,
    status: effectiveStatus,
    isReturn: isReturnRequest,
    isReceived: isReturnReceived,
    isHandedOver: isReturnHandedOver,
    createdAt: creationDate,
    reviewedAt: approvalDate,
    foundAt: productFoundDate,
    reviewedBy: req.reviewedBy,
    reviewNote: req.reviewNote,
    folderType,
    isTool,
    rawRequest: req,
  };
};

export default function GeneralConsumablesView({ defaultFolder = null, onBackToHub }) {
  const canEdit = canPerformAction("general-consumables", "edit");
  // Folder State: null (Folder Selection Hub) | "tools" (Tools Page) | "general" (Consumables Page)
  const [selectedFolder, setSelectedFolder] = useState(defaultFolder);

  const [allEmployees, setAllEmployees] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter Controls
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [returnFilterTab, setReturnFilterTab] = useState("ALL"); // "ALL" | "RECEIVED" | "NOT_RECEIVED"
  const [empModalTab, setEmpModalTab] = useState("ALL"); // "ALL" | "ACTIVE" | "NOT_RECEIVED" | "RECEIVED"

  // Modal State for "View Tools"
  const [selectedEmpTools, setSelectedEmpTools] = useState(null);

  useEffect(() => {
    if (defaultFolder !== undefined) {
      setSelectedFolder(defaultFolder);
    }
  }, [defaultFolder]);

  // Load All System Employees & Requests History
  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, reqsRes] = await Promise.all([
        apiGet("/employees").catch(() => ({ employees: [] })),
        apiGet("/requests").catch(() => ({ requests: [] })),
      ]);

      // Parse System Employees
      const rawEmps = Array.isArray(empRes) ? empRes : empRes?.employees || [];
      const parsedEmps = rawEmps.map((e) => ({
        id: e.id || e.userId,
        fullName: e.fullName || e.name || "Employee",
        employeeCode: e.employeeCode || e.employeeProfile?.employeeCode || `EMP-${String(e.id || 1).padStart(3, "0")}`,
        jobTitle: e.jobTitle || e.roleName || e.employeeProfile?.jobTitle || "Team Member",
        avatar: resolveImageUrl(e.employeeProfile?.profileImage || e.avatar || e.profilePicture),
      }));

      setAllEmployees(parsedEmps);

      // Parse Requests
      const rawRequests = Array.isArray(reqsRes) ? reqsRes : reqsRes?.requests || [];
      const parsedReqs = rawRequests
        .filter((r) => r.type === "EQUIPMENT" || (r.description && r.description.includes("Action Type")))
        .map(parseTakingRequest);

      setHistoryList(parsedReqs);
    } catch (err) {
      toast.error(err.message || "Failed to load employees & requests data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Request Review (Approve / Reject / Issue / Return)
  const handleUpdateStatus = async (reqId, newStatus, confirmMsg) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;

    try {
      if (newStatus === "APPROVED" || newStatus === "REJECTED") {
        await apiPut(`/requests/${reqId}/review`, {
          status: newStatus,
          note: `Reviewed by Admin in Tools/Consumables Management: ${newStatus}`,
        });
      } else {
        await apiPut(`/requests/${reqId}/found`, {
          status: newStatus,
          note: `Updated status to ${newStatus}`,
        }).catch(async () => {
          await apiPut(`/requests/${reqId}/review`, {
            status: newStatus,
            note: `Updated status to ${newStatus}`,
          });
        });
      }

      toast.success(`Request status updated to ${newStatus} successfully.`);
      loadData();
      if (selectedEmpTools) {
        const updatedReqsRes = await apiGet("/requests").catch(() => ({ requests: [] }));
        const raw = Array.isArray(updatedReqsRes) ? updatedReqsRes : updatedReqsRes?.requests || [];
        const parsed = raw.map(parseTakingRequest);
        const empCode = selectedEmpTools.employeeCode;
        const empTools = parsed.filter(
          (t) => (t.employeeCode === empCode || t.employeeName === selectedEmpTools.employeeName)
        );
        setSelectedEmpTools((prev) => (prev ? { ...prev, tools: empTools } : null));
      }
    } catch (err) {
      toast.error(err.message || `Failed to update request status to ${newStatus}.`);
    }
  };

  // Handle Confirm Return Received & Restock
  const handleConfirmReturnReceived = async (reqId, itemName) => {
    if (
      !window.confirm(
        `Are you sure you have physically received "${itemName || 'Product'}" in store and want to restock it into inventory?`
      )
    ) {
      return;
    }

    try {
      // First ensure request is approved if it was pending
      const targetReq = historyList.find((r) => r.id === reqId);
      if (targetReq && targetReq.rawRequest?.status === "PENDING") {
        await apiPut(`/requests/${reqId}/review`, {
          status: "APPROVED",
          note: "Return approved upon store physical handover.",
        }).catch(() => {});
      }

      await apiPost(`/requests/${reqId}/found`, {}).catch(async () => {
        await apiPut(`/requests/${reqId}/found`, {});
      });

      toast.success(`Return received successfully! "${itemName || 'Item'}" has been restocked into warehouse inventory.`);
      await loadData();
      if (selectedEmpTools) {
        const updatedReqsRes = await apiGet("/requests").catch(() => ({ requests: [] }));
        const raw = Array.isArray(updatedReqsRes) ? updatedReqsRes : updatedReqsRes?.requests || [];
        const parsed = raw.map(parseTakingRequest);
        const empCode = selectedEmpTools.employeeCode;
        const empTools = parsed.filter(
          (t) => (t.employeeCode === empCode || t.employeeName === selectedEmpTools.employeeName)
        );
        setSelectedEmpTools((prev) => (prev ? { ...prev, tools: empTools } : null));
      }
    } catch (err) {
      toast.error(err.message || "Failed to confirm return received.");
    }
  };

  // Tools Requests Items
  const toolsItems = useMemo(() => {
    return historyList.filter((item) => item.folderType === "tools");
  }, [historyList]);

  // Consumables Requests Items
  const generalItems = useMemo(() => {
    return historyList.filter((item) => item.folderType === "general");
  }, [historyList]);

  // All EMP Return Requests Items
  const allReturnItems = useMemo(() => {
    return historyList.filter((item) => item.isReturn);
  }, [historyList]);

  // EMP Returns Received by Store (Confirmed Found & Restocked)
  const receivedReturns = useMemo(() => {
    return allReturnItems.filter((item) => item.isReceived);
  }, [allReturnItems]);

  // EMP Returns Not Received Yet (Pending Approval / Awaiting Handover or Confirmation)
  const notReceivedReturns = useMemo(() => {
    return allReturnItems.filter((item) => !item.isReceived);
  }, [allReturnItems]);

  // Filtered EMP Returns list for EMP Returns page
  const filteredReturnList = useMemo(() => {
    let list = allReturnItems;
    if (returnFilterTab === "RECEIVED") list = receivedReturns;
    else if (returnFilterTab === "NOT_RECEIVED") list = notReceivedReturns;

    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter(
      (item) =>
        (item.employeeName && item.employeeName.toLowerCase().includes(s)) ||
        (item.employeeCode && item.employeeCode.toLowerCase().includes(s)) ||
        (item.itemName && item.itemName.toLowerCase().includes(s)) ||
        (item.productId && item.productId.toLowerCase().includes(s)) ||
        (item.category && item.category.toLowerCase().includes(s))
    );
  }, [allReturnItems, receivedReturns, notReceivedReturns, returnFilterTab, search]);

  // All Employees list merged with their assigned tools & returns records
  const fullEmployeeToolsList = useMemo(() => {
    const itemsByEmp = {};
    historyList.forEach((t) => {
      const codeKey = (t.employeeCode || "").toLowerCase().trim();
      const nameKey = (t.employeeName || "").toLowerCase().trim();
      if (codeKey) {
        if (!itemsByEmp[codeKey]) itemsByEmp[codeKey] = [];
        itemsByEmp[codeKey].push(t);
      }
      if (nameKey && nameKey !== codeKey) {
        if (!itemsByEmp[nameKey]) itemsByEmp[nameKey] = [];
        itemsByEmp[nameKey].push(t);
      }
    });

    // Merge system employees with their items
    const combinedMap = new Map();

    allEmployees.forEach((emp) => {
      const codeKey = (emp.employeeCode || "").toLowerCase().trim();
      const nameKey = (emp.fullName || "").toLowerCase().trim();
      const empTools = itemsByEmp[codeKey] || itemsByEmp[nameKey] || [];

      combinedMap.set(emp.id || codeKey, {
        employeeName: emp.fullName,
        employeeCode: emp.employeeCode,
        employeeAvatar: emp.avatar,
        jobTitle: emp.jobTitle,
        tools: empTools,
      });
    });

    // Also include any employees from requests not in allEmployees list
    historyList.forEach((t) => {
      const codeKey = (t.employeeCode || "").toLowerCase().trim();
      const nameKey = (t.employeeName || "").toLowerCase().trim();
      const existingKey = Array.from(combinedMap.keys()).find(
        (k) =>
          k === t.employeeCode ||
          combinedMap.get(k)?.employeeCode === t.employeeCode ||
          combinedMap.get(k)?.employeeName === t.employeeName
      );

      if (!existingKey) {
        combinedMap.set(t.employeeCode || t.id, {
          employeeName: t.employeeName,
          employeeCode: t.employeeCode,
          employeeAvatar: t.employeeAvatar,
          jobTitle: "Team Member",
          tools: itemsByEmp[codeKey] || itemsByEmp[nameKey] || [t],
        });
      }
    });

    const list = Array.from(combinedMap.values());

    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter(
      (emp) =>
        emp.employeeName.toLowerCase().includes(s) ||
        emp.employeeCode.toLowerCase().includes(s) ||
        (emp.jobTitle && emp.jobTitle.toLowerCase().includes(s)) ||
        emp.tools.some(
          (t) =>
            t.itemName.toLowerCase().includes(s) ||
            t.productId.toLowerCase().includes(s)
        )
    );
  }, [allEmployees, toolsItems, search]);

  // Filtered Consumables List for Consumables Management page
  const filteredGeneralList = useMemo(() => {
    return generalItems.filter((item) => {
      const emp = (item.employeeName || "").toLowerCase();
      const empCode = (item.employeeCode || "").toLowerCase();
      const itemName = (item.itemName || "").toLowerCase();
      const prodId = (item.productId || "").toLowerCase();
      const searchLower = search.toLowerCase();

      const matchesSearch =
        !search ||
        emp.includes(searchLower) ||
        empCode.includes(searchLower) ||
        itemName.includes(searchLower) ||
        prodId.includes(searchLower);

      let matchesStatus = true;
      if (statusFilter !== "ALL") {
        matchesStatus = item.status === statusFilter;
      }

      return matchesSearch && matchesStatus;
    });
  }, [generalItems, search, statusFilter]);

  // ═════════════════════════════════════════════════════════════════════
  // 1. INITIAL HUB SCREEN: 2 FOLDER CARDS (Click Folder to Open New Page)
  // ═════════════════════════════════════════════════════════════════════
  if (selectedFolder === null) {
    return (
      <div className="space-y-8">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={onBackToHub}
              className="p-2 sm:p-2.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer shrink-0"
              title="Back to Inventory Submodules"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-xs shrink-0">
              <Wrench className="h-5 w-5 sm:h-7 sm:w-7" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground truncate">
                  Tools & Consumables Management
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/20 shrink-0">
                  Select Folder
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Select a folder below to open the dedicated page for Tools, Consumables, or Employee Returns management.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="self-end sm:self-auto p-2.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2 text-xs font-semibold shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Submodule</span>
          </button>
        </div>

        {/* THE 2 FOLDERS CARDS GRID */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" />
            <span>Management Folders</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* FOLDER CARD 1: TOOLS MANAGEMENT */}
            <div
              onClick={() => {
                setSearch("");
                setSelectedFolder("tools");
              }}
              className="group relative rounded-3xl border-2 border-primary/30 bg-background p-7 card-shadow hover:border-primary hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between space-y-6 bg-gradient-to-br from-primary/[0.03] to-transparent"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md transition-transform group-hover:scale-105">
                    <Wrench className="h-7 w-7" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                    {fullEmployeeToolsList.length} Employees
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Folder className="h-5 w-5 text-primary" />
                    <h3 className="font-display text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                      1. Tools Folder
                    </h3>
                  </div>
                  <p className="text-xs font-semibold text-primary/80 mt-1">
                    Employee List &amp; View Tools Page
                  </p>
                  <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
                    View all system employees, profile images, names, codes, and individual employee assigned tool records.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between">
                <span className="text-xs font-bold text-primary group-hover:underline flex items-center gap-1.5">
                  <span>Open Tools Page</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
                <span className="flex h-3 w-3 rounded-full bg-primary ring-4 ring-primary/20" />
              </div>
            </div>

            {/* FOLDER CARD 2: CONSUMABLES MANAGEMENT */}
            <div
              onClick={() => {
                setSearch("");
                setSelectedFolder("general");
              }}
              className="group relative rounded-3xl border-2 border-emerald-500/30 bg-background p-7 card-shadow hover:border-emerald-600 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between space-y-6 bg-gradient-to-br from-emerald-500/[0.03] to-transparent"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md transition-transform group-hover:scale-105">
                    <Layers className="h-7 w-7" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    {generalItems.length} Consumable Requests
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Folder className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-display text-xl font-bold text-foreground group-hover:text-emerald-600 transition-colors">
                      2. Consumables Folder
                    </h3>
                  </div>
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                    Consumable Taking &amp; Found Dates Log
                  </p>
                  <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
                    View consumable product taking history, quantities, request dates, approval dates, found dates, and stock actions.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline flex items-center gap-1.5">
                  <span>Open Consumables Page</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
                <span className="flex h-3 w-3 rounded-full bg-emerald-600 ring-4 ring-emerald-600/20" />
              </div>
            </div>

            {/* FOLDER CARD 3: EMP RETURNS MANAGEMENT */}
            <div
              onClick={() => {
                setSearch("");
                setReturnFilterTab("ALL");
                setSelectedFolder("returns");
              }}
              className="group relative rounded-3xl border-2 border-purple-500/30 bg-background p-7 card-shadow hover:border-purple-600 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between space-y-6 bg-gradient-to-br from-purple-500/[0.04] to-transparent"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md transition-transform group-hover:scale-105">
                    <RotateCcw className="h-7 w-7" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                    {allReturnItems.length} Total Returns
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Folder className="h-5 w-5 text-purple-600" />
                    <h3 className="font-display text-xl font-bold text-foreground group-hover:text-purple-600 transition-colors">
                      3. EMP Returns Folder
                    </h3>
                  </div>
                  <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mt-1">
                    Returns Received &amp; Not Received Log
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    Complete audit trail of employee product &amp; tool returns. Track returns received into store vs pending returns not yet received.
                  </p>

                  {/* Summary Badges */}
                  <div className="flex items-center gap-2 pt-3 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {receivedReturns.length} Received
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                      <Clock className="h-3.5 w-3.5" />
                      {notReceivedReturns.length} Not Received
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:underline flex items-center gap-1.5">
                  <span>Open EMP Returns Page</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
                <span className="flex h-3 w-3 rounded-full bg-purple-600 ring-4 ring-purple-600/20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation Banner with Back to Folders button */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedFolder(null)}
            className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-background text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1 text-primary" />
            <span>Back to Submodule Folders</span>
          </button>

          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white ${
              selectedFolder === "tools"
                ? "bg-primary"
                : selectedFolder === "general"
                ? "bg-emerald-600"
                : "bg-purple-600"
            }`}
          >
            {selectedFolder === "tools" ? (
              <Wrench className="h-5 w-5" />
            ) : selectedFolder === "general" ? (
              <Layers className="h-5 w-5" />
            ) : (
              <RotateCcw className="h-5 w-5" />
            )}
          </div>

          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {selectedFolder === "tools"
                ? "Tools Management Page"
                : selectedFolder === "general"
                ? "Consumables Management Page"
                : "EMP Returns Management Page"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {selectedFolder === "tools"
                ? "All System Employees List · View Assigned Tools"
                : selectedFolder === "general"
                ? "Consumable Product Requests · Quantities & Dates Log"
                : "Employee Product & Tool Returns · Returns Received in Store vs Not Received"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Folder Switchers */}
          <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedFolder("tools");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedFolder === "tools"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>Tools</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedFolder("general");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedFolder === "general"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Consumables</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setReturnFilterTab("ALL");
                setSelectedFolder("returns");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedFolder === "returns"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>EMP Returns ({allReturnItems.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className="bg-background p-4 rounded-2xl border border-border card-shadow flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={
              selectedFolder === "tools"
                ? "Search employee name, code, job title, tool name, product ID..."
                : selectedFolder === "general"
                ? "Search consumable product name, code, employee name..."
                : "Search employee name, code, product name, ID, category..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-secondary/30 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {selectedFolder === "general" && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-secondary/40 border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Request Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="ISSUED">Issued / Completed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        )}

        {selectedFolder === "returns" && (
          <div className="flex items-center gap-1.5 bg-secondary/40 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setReturnFilterTab("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                returnFilterTab === "ALL"
                  ? "bg-background text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({allReturnItems.length})
            </button>
            <button
              type="button"
              onClick={() => setReturnFilterTab("RECEIVED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                returnFilterTab === "RECEIVED"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>Received ({receivedReturns.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setReturnFilterTab("NOT_RECEIVED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                returnFilterTab === "NOT_RECEIVED"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
              }`}
            >
              <Clock className="h-3 w-3" />
              <span>Not Received ({notReceivedReturns.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* PAGE 1: TOOLS FOLDER PAGE (All Employee List & "View Tools" Button) */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {selectedFolder === "tools" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <span>All System Employees List ({fullEmployeeToolsList.length})</span>
            </h2>
            <span className="text-xs text-muted-foreground">
              Click "View Tools" to view tools assigned to any employee
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground font-medium">
                  Loading all employees list...
                </p>
              </div>
            </div>
          ) : fullEmployeeToolsList.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-border rounded-2xl bg-background space-y-3">
              <Wrench className="h-10 w-10 text-muted-foreground mx-auto" />
              <h3 className="font-bold text-foreground">No Employees Found</h3>
              <p className="text-xs text-muted-foreground">
                No system employees match your search query.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {fullEmployeeToolsList.map((emp) => {
                const pendingCount = emp.tools.filter((t) => t.status === "PENDING").length;
                const activeToolsCount = emp.tools.length;

                return (
                  <div
                    key={emp.employeeCode || emp.employeeName}
                    className="rounded-2xl border border-border bg-background p-5 card-shadow hover:border-primary/40 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="flex items-start gap-4">
                      {emp.employeeAvatar ? (
                        <img
                          src={emp.employeeAvatar}
                          alt={emp.employeeName}
                          className="w-14 h-14 rounded-2xl object-cover border-2 border-primary/20 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 border-2 border-primary/20 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                          {emp.employeeName?.slice(0, 2)?.toUpperCase() || "EP"}
                        </div>
                      )}

                      <div className="space-y-1 min-w-0 flex-1">
                        <h3 className="font-bold text-base text-foreground truncate">
                          {emp.employeeName}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                          <Tag className="h-3 w-3" />
                          <span>Code: {emp.employeeCode}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {emp.jobTitle || "Team Member"}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20">
                            {activeToolsCount} Tools
                          </span>
                          {pendingCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/20">
                              {pendingCount} Pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* View Tools Button */}
                    <div className="pt-3 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setSelectedEmpTools(emp)}
                        className="w-full py-2.5 px-4 rounded-xl cta-gradient text-white text-xs font-bold hover:opacity-95 transition-opacity flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View Tools</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* PAGE 2: CONSUMABLES FOLDER PAGE (Product Name, Code, Emp Name, Quantities & Dates) */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {selectedFolder === "general" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-600" />
              <span>Consumables Management Page ({filteredGeneralList.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
                <p className="text-sm text-muted-foreground font-medium">
                  Loading consumable product requests...
                </p>
              </div>
            </div>
          ) : filteredGeneralList.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-border rounded-2xl bg-background space-y-3">
              <Layers className="h-10 w-10 text-muted-foreground mx-auto" />
              <h3 className="font-bold text-foreground">No Consumable Requests Found</h3>
              <p className="text-xs text-muted-foreground">
                No consumable product requests match your current search and status filter criteria.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-background card-shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-secondary/40 border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-bold">
                    <tr>
                      <th className="px-5 py-3.5">Product ID</th>
                      <th className="px-5 py-3.5">Product Name</th>
                      <th className="px-5 py-3.5">Emp Name</th>
                      <th className="px-5 py-3.5">Emp Code</th>
                      <th className="px-5 py-3.5">Request Create Date</th>
                      <th className="px-5 py-3.5">Request Approve Date</th>
                      <th className="px-5 py-3.5">Found Item Date</th>
                      <th className="px-5 py-3.5">Request Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {filteredGeneralList.map((row) => {
                      const isPending = row.status === "PENDING";
                      const isApproved = row.status === "APPROVED";
                      const isIssued = row.status === "ISSUED" || row.status === "COMPLETED" || row.status === "FOUND";
                      const isRejected = row.status === "REJECTED";

                      return (
                        <tr key={row.id} className="hover:bg-secondary/20 transition-colors">
                          {/* 1. Product ID */}
                          <td className="px-5 py-4 font-mono text-xs text-primary font-bold">
                            {row.productId}
                          </td>

                          {/* 2. Product Name */}
                          <td className="px-5 py-4 font-bold text-foreground">
                            <div>
                              <span className="block text-sm">{row.itemName}</span>
                              <span className="text-[11px] text-muted-foreground font-normal">
                                Qty: {row.quantityRequested} Nos
                              </span>
                            </div>
                          </td>

                          {/* 3. Emp Name */}
                          <td className="px-5 py-4 font-bold text-foreground text-sm">
                            {row.employeeName}
                          </td>

                          {/* 4. Emp Code */}
                          <td className="px-5 py-4 font-mono text-xs text-muted-foreground font-bold">
                            {row.employeeCode}
                          </td>

                          {/* 5. Request Create Date */}
                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                              <div>
                                <span className="font-semibold text-foreground">{formatDate(row.createdAt)}</span>
                                <span className="block text-[11px] text-muted-foreground/70">{formatTime(row.createdAt)}</span>
                              </div>
                            </div>
                          </td>

                          {/* 6. Request Approve Date */}
                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            {row.reviewedAt ? (
                              <div className="flex items-center gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <div>
                                  <span className="font-semibold text-foreground">{formatDate(row.reviewedAt)}</span>
                                  <span className="block text-[11px] text-muted-foreground/70">{formatTime(row.reviewedAt)}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-amber-600 font-semibold text-xs italic">
                                Pending Approval
                              </span>
                            )}
                          </td>

                          {/* 7. Found Item Date */}
                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            {row.foundAt ? (
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <div>
                                  <span className="font-bold text-emerald-700 dark:text-emerald-300">{formatDate(row.foundAt)}</span>
                                  <span className="block text-[11px] text-muted-foreground/70">{formatTime(row.foundAt)}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">
                                {isApproved ? "Awaiting Issuance" : "Not Found / Issued Yet"}
                              </span>
                            )}
                          </td>

                          {/* 8. Request Status */}
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                                isPending
                                  ? "bg-amber-100 text-amber-700 border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300"
                                  : isApproved
                                  ? "bg-blue-100 text-blue-700 border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300"
                                  : isIssued
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-700 border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300"
                              }`}
                            >
                              {isPending && <Clock className="h-3.5 w-3.5" />}
                              {isApproved && <ShieldCheck className="h-3.5 w-3.5" />}
                              {isIssued && <CheckCircle2 className="h-3.5 w-3.5" />}
                              {isRejected && <XCircle className="h-3.5 w-3.5" />}
                              {isIssued ? "FOUND / ISSUED" : row.status}
                            </span>
                          </td>

                          {/* 9. Actions */}
                          <td className="px-5 py-4 text-right">
                            {canEdit ? (
                              isPending ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(row.id, "APPROVED", `Are you sure you want to approve request for ${row.itemName}?`)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Approve Request"
                                  >
                                    <Check className="h-3.5 w-3.5" /> Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(row.id, "REJECTED", `Are you sure you want to reject request for ${row.itemName}?`)}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Reject Request"
                                  >
                                    <Ban className="h-3.5 w-3.5" /> Reject
                                  </button>
                                </div>
                              ) : isApproved ? (
                                row.actionType === "RETURN" ? (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(row.id, "ISSUED", `Mark ${row.itemName} as found / returned?`)}
                                    className="px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <PackageCheck className="h-3.5 w-3.5" /> Found Item
                                  </button>
                                ) : (
                                  <span className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 font-medium">
                                    Awaiting Employee Found
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-muted-foreground italic">
                                  Reviewed {row.reviewedBy ? `by ${row.reviewedBy}` : ""}
                                </span>
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                View Only
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
      {/* PAGE 3: EMP RETURNS FOLDER PAGE (Returns Received vs Not Received) */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {selectedFolder === "returns" && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5 card-shadow flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                  Total EMP Returns
                </span>
                <div className="text-3xl font-extrabold text-foreground mt-1 font-mono">
                  {allReturnItems.length}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  All submitted return requests
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md">
                <RotateCcw className="h-6 w-6" />
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 card-shadow flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Returns Received in Store
                </span>
                <div className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
                  {receivedReturns.length}
                </div>
                <p className="text-[11px] text-emerald-600/80 mt-1">
                  Physically received &amp; restocked into inventory
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 card-shadow flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Returns Not Received
                </span>
                <div className="text-3xl font-extrabold text-amber-700 dark:text-amber-300 mt-1 font-mono">
                  {notReceivedReturns.length}
                </div>
                <p className="text-[11px] text-amber-600/80 mt-1">
                  Pending review or awaiting store receipt
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-md">
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Sub Header & Segmented Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-purple-600" />
              <span>
                {returnFilterTab === "RECEIVED"
                  ? "List of EMP Returns Received by Store"
                  : returnFilterTab === "NOT_RECEIVED"
                  ? "List of EMP Returns Not Received by Store"
                  : "All EMP Returns"}{" "}
                ({filteredReturnList.length})
              </span>
            </h2>

            <div className="flex items-center gap-1.5 bg-secondary/60 p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setReturnFilterTab("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  returnFilterTab === "ALL"
                    ? "bg-background text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All Returns ({allReturnItems.length})
              </button>

              <button
                type="button"
                onClick={() => setReturnFilterTab("RECEIVED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  returnFilterTab === "RECEIVED"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Returns Received ({receivedReturns.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setReturnFilterTab("NOT_RECEIVED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  returnFilterTab === "NOT_RECEIVED"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Returns Not Received ({notReceivedReturns.length})</span>
              </button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto" />
                <p className="text-sm text-muted-foreground font-medium">
                  Loading employee returns records...
                </p>
              </div>
            </div>
          ) : filteredReturnList.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-border rounded-2xl bg-background space-y-3">
              <RotateCcw className="h-10 w-10 text-muted-foreground mx-auto" />
              <h3 className="font-bold text-foreground">No Returns Found</h3>
              <p className="text-xs text-muted-foreground">
                {returnFilterTab === "RECEIVED"
                  ? "No employee returns have been received and restocked yet."
                  : returnFilterTab === "NOT_RECEIVED"
                  ? "No unreceived returns pending. All returns have been processed!"
                  : "No employee returns recorded in the system."}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-background card-shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-secondary/40 border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-bold">
                    <tr>
                      <th className="px-5 py-3.5">Product ID</th>
                      <th className="px-5 py-3.5">Product Name &amp; Category</th>
                      <th className="px-5 py-3.5">Emp Name</th>
                      <th className="px-5 py-3.5">Emp Code</th>
                      <th className="px-5 py-3.5">Return Request Date</th>
                      <th className="px-5 py-3.5">Store Approve Date</th>
                      <th className="px-5 py-3.5">Store Received / Restocked Date</th>
                      <th className="px-5 py-3.5">Return Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {filteredReturnList.map((row) => {
                      const isPending = row.status === "PENDING";
                      const isApproved = row.status === "APPROVED";
                      const isReceived = row.isReceived;
                      const isHandedOver = row.isHandedOver;
                      const isRejected = row.status === "REJECTED";

                      return (
                        <tr key={row.id} className="hover:bg-secondary/20 transition-colors">
                          {/* 1. Product ID */}
                          <td className="px-5 py-4 font-mono text-xs text-purple-600 dark:text-purple-400 font-bold">
                            {row.productId}
                          </td>

                          {/* 2. Product Name & Category */}
                          <td className="px-5 py-4 font-bold text-foreground">
                            <div>
                              <span className="block text-sm">{row.itemName}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-muted-foreground font-normal">
                                  Qty: {row.quantityRequested} Nos
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-semibold border border-border">
                                  {row.category}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 3. Emp Name */}
                          <td className="px-5 py-4 font-bold text-foreground text-sm">
                            {row.employeeName}
                          </td>

                          {/* 4. Emp Code */}
                          <td className="px-5 py-4 font-mono text-xs text-muted-foreground font-bold">
                            {row.employeeCode}
                          </td>

                          {/* 5. Return Request Date */}
                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                              <div>
                                <span className="font-semibold text-foreground">{formatDate(row.createdAt)}</span>
                                <span className="block text-[11px] text-muted-foreground/70">{formatTime(row.createdAt)}</span>
                              </div>
                            </div>
                          </td>

                          {/* 6. Store Approve Date */}
                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            {row.reviewedAt ? (
                              <div className="flex items-center gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                <div>
                                  <span className="font-semibold text-foreground">{formatDate(row.reviewedAt)}</span>
                                  <span className="block text-[11px] text-muted-foreground/70">{formatTime(row.reviewedAt)}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-amber-600 font-semibold text-xs italic">
                                Pending Approval
                              </span>
                            )}
                          </td>

                          {/* 7. Store Received / Restocked Date */}
                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            {isReceived && row.foundAt ? (
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <div>
                                  <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                    {formatDate(row.foundAt)}
                                  </span>
                                  <span className="block text-[11px] text-muted-foreground/70">
                                    {formatTime(row.foundAt)}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 text-xs font-semibold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                <Clock className="h-3 w-3" />
                                <span>Not Received Yet</span>
                              </span>
                            )}
                          </td>

                          {/* 8. Return Status */}
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                                isReceived
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : isHandedOver
                                  ? "bg-purple-100 text-purple-800 border-purple-500/30 dark:bg-purple-950/40 dark:text-purple-300"
                                  : isApproved
                                  ? "bg-blue-100 text-blue-700 border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300"
                                  : isPending
                                  ? "bg-amber-100 text-amber-700 border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300"
                                  : "bg-rose-100 text-rose-700 border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300"
                              }`}
                            >
                              {isReceived && <CheckCircle2 className="h-3.5 w-3.5" />}
                              {isHandedOver && <RotateCcw className="h-3.5 w-3.5" />}
                              {isApproved && !isHandedOver && !isReceived && <ShieldCheck className="h-3.5 w-3.5" />}
                              {isPending && <Clock className="h-3.5 w-3.5" />}
                              {isRejected && <XCircle className="h-3.5 w-3.5" />}
                              <span>
                                {isReceived
                                  ? "RECEIVED & RESTOCKED"
                                  : isHandedOver
                                  ? "HANDED OVER (Awaiting Restock)"
                                  : isApproved
                                  ? "APPROVED (Awaiting Handover)"
                                  : isPending
                                  ? "PENDING APPROVAL"
                                  : row.status}
                              </span>
                            </span>
                          </td>

                          {/* 9. Actions */}
                          <td className="px-5 py-4 text-right">
                            {isReceived ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Received in Store
                              </span>
                            ) : canEdit ? (
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {isPending && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateStatus(
                                          row.id,
                                          "APPROVED",
                                          `Approve return request for ${row.itemName}?`
                                        )
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                      title="Approve Return Request"
                                    >
                                      <Check className="h-3.5 w-3.5" /> Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateStatus(
                                          row.id,
                                          "REJECTED",
                                          `Reject return request for ${row.itemName}?`
                                        )
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                      title="Reject Return Request"
                                    >
                                      <Ban className="h-3.5 w-3.5" /> Reject
                                    </button>
                                  </>
                                )}

                                {/* Confirm Received & Restock button */}
                                <button
                                  type="button"
                                  onClick={() => handleConfirmReturnReceived(row.id, row.itemName)}
                                  className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                                  title="Confirm item physically received and restocked into warehouse inventory"
                                >
                                  <PackageCheck className="h-3.5 w-3.5" /> Confirm Received &amp; Restock
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Read-only</span>
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
      {/* MODAL: VIEW EMPLOYEE ASSIGNED TOOLS & RETURNS PAGE */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {selectedEmpTools && (() => {
        const empAll = selectedEmpTools.tools || [];
        const empActive = empAll.filter(
          (t) => !t.isReturn && (t.status === "ISSUED" || t.status === "APPROVED" || t.status === "PENDING")
        );
        const empNotReceived = empAll.filter((t) => t.isReturn && !t.isReceived);
        const empReceived = empAll.filter((t) => t.isReturn && t.isReceived);

        let modalDisplayed = empAll;
        if (empModalTab === "ACTIVE") modalDisplayed = empActive;
        else if (empModalTab === "NOT_RECEIVED") modalDisplayed = empNotReceived;
        else if (empModalTab === "RECEIVED") modalDisplayed = empReceived;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-background rounded-3xl border border-border card-shadow max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/30">
                <div className="flex items-center gap-4">
                  {selectedEmpTools.employeeAvatar ? (
                    <img
                      src={selectedEmpTools.employeeAvatar}
                      alt={selectedEmpTools.employeeName}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-primary/20 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 border-2 border-primary/20 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                      {selectedEmpTools.employeeName?.slice(0, 2)?.toUpperCase() || "EP"}
                    </div>
                  )}
                  <div>
                    <h3 className="font-display text-xl font-bold text-foreground">
                      Employee Tools &amp; Returns: {selectedEmpTools.employeeName}
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      Code: {selectedEmpTools.employeeCode} · {empAll.length} Total Records
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEmpModalTab("ALL");
                    setSelectedEmpTools(null);
                  }}
                  className="p-2 rounded-xl border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Subtabs Toolbar */}
              <div className="px-6 py-3 border-b border-border bg-secondary/15 flex items-center gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setEmpModalTab("ALL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    empModalTab === "ALL"
                      ? "bg-primary text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  All Items ({empAll.length})
                </button>

                <button
                  type="button"
                  onClick={() => setEmpModalTab("ACTIVE")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    empModalTab === "ACTIVE"
                      ? "bg-primary text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  Active Tools ({empActive.length})
                </button>

                <button
                  type="button"
                  onClick={() => setEmpModalTab("NOT_RECEIVED")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    empModalTab === "NOT_RECEIVED"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  <span>Returns Not Received ({empNotReceived.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEmpModalTab("RECEIVED")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    empModalTab === "RECEIVED"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Returns Received ({empReceived.length})</span>
                </button>
              </div>

              {/* Modal Body: Employee Tools Table */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                <div className="rounded-2xl border border-border bg-background overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-secondary/40 border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-bold">
                        <tr>
                          <th className="px-4 py-3.5">Product ID</th>
                          <th className="px-4 py-3.5">Product Name</th>
                          <th className="px-4 py-3.5">Type</th>
                          <th className="px-4 py-3.5">Request Date</th>
                          <th className="px-4 py-3.5">Approve Date</th>
                          <th className="px-4 py-3.5">Issued / Restocked Date</th>
                          <th className="px-4 py-3.5">Status</th>
                          <th className="px-4 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-medium text-xs">
                        {modalDisplayed.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-muted-foreground">
                              No records found for this tab.
                            </td>
                          </tr>
                        ) : (
                          modalDisplayed.map((tool) => {
                            const isReturn = tool.isReturn;
                            const isReceived = tool.isReceived;
                            const isIssued =
                              tool.status === "ISSUED" || tool.status === "FOUND" || tool.status === "COMPLETED";
                            const isApproved = tool.status === "APPROVED";
                            const isPending = tool.status === "PENDING";

                            return (
                              <tr key={tool.id} className="hover:bg-secondary/20 transition-colors">
                                {/* Product ID */}
                                <td className="px-4 py-3.5 font-mono font-bold text-primary">
                                  {tool.productId}
                                </td>

                                {/* Product Name */}
                                <td className="px-4 py-3.5 font-bold text-foreground">
                                  {tool.itemName}
                                </td>

                                {/* Type */}
                                <td className="px-4 py-3.5">
                                  {isReturn ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                                      <RotateCcw className="h-2.5 w-2.5" /> Return
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                      <PackagePlus className="h-2.5 w-2.5" /> Taking
                                    </span>
                                  )}
                                </td>

                                {/* Request Date */}
                                <td className="px-4 py-3.5 text-muted-foreground">
                                  <div>
                                    <span className="font-semibold text-foreground">{formatDate(tool.createdAt)}</span>
                                    <span className="block text-[10px] text-muted-foreground/70">{formatTime(tool.createdAt)}</span>
                                  </div>
                                </td>

                                {/* Approve Date */}
                                <td className="px-4 py-3.5 text-muted-foreground">
                                  {tool.reviewedAt ? (
                                    <div>
                                      <span className="font-semibold text-foreground">{formatDate(tool.reviewedAt)}</span>
                                      <span className="block text-[10px] text-muted-foreground/70">{formatTime(tool.reviewedAt)}</span>
                                    </div>
                                  ) : (
                                    <span className="text-amber-600 font-semibold italic text-[11px]">
                                      Pending Approval
                                    </span>
                                  )}
                                </td>

                                {/* Issued / Restocked Date */}
                                <td className="px-4 py-3.5 text-muted-foreground">
                                  {tool.foundAt ? (
                                    <div>
                                      <span className="font-bold text-emerald-700 dark:text-emerald-300">{formatDate(tool.foundAt)}</span>
                                      <span className="block text-[10px] text-muted-foreground/70">{formatTime(tool.foundAt)}</span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground italic text-[11px]">
                                      {isReturn ? "Not Received Yet" : isApproved ? "Awaiting Issuance" : "Not Issued Yet"}
                                    </span>
                                  )}
                                </td>

                                {/* Status */}
                                <td className="px-4 py-3.5">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                      isReceived
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-500/30"
                                        : isReturn && !isReceived
                                        ? "bg-amber-100 text-amber-800 border-amber-500/30"
                                        : isIssued
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-500/30"
                                        : isApproved
                                        ? "bg-blue-100 text-blue-700 border-blue-500/30"
                                        : isPending
                                        ? "bg-amber-100 text-amber-700 border-amber-500/30"
                                        : "bg-rose-100 text-rose-700 border-rose-500/30"
                                    }`}
                                  >
                                    {isReturn
                                      ? isReceived
                                        ? "RETURN RECEIVED"
                                        : "RETURN NOT RECEIVED"
                                      : isIssued
                                      ? "ISSUED"
                                      : tool.status}
                                  </span>
                                </td>

                                {/* Actions */}
                                <td className="px-4 py-3.5 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {isReturn ? (
                                      isReceived ? (
                                        <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3" /> Restocked
                                        </span>
                                      ) : canEdit ? (
                                        <button
                                          type="button"
                                          onClick={() => handleConfirmReturnReceived(tool.id, tool.itemName)}
                                          className="px-2.5 py-1 rounded-lg bg-purple-600 text-white hover:bg-purple-700 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                                        >
                                          <PackageCheck className="h-3 w-3" /> Confirm Restock
                                        </button>
                                      ) : (
                                        <span className="text-[11px] text-muted-foreground italic">Pending Restock</span>
                                      )
                                    ) : canEdit ? (
                                      <>
                                        {isPending && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleUpdateStatus(
                                                  tool.id,
                                                  "APPROVED",
                                                  `Approve tool request for ${tool.itemName}?`
                                                )
                                              }
                                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-semibold transition-colors cursor-pointer"
                                            >
                                              Approve
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleUpdateStatus(
                                                  tool.id,
                                                  "REJECTED",
                                                  `Reject tool request for ${tool.itemName}?`
                                                )
                                              }
                                              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-[11px] font-semibold transition-colors cursor-pointer"
                                            >
                                              Reject
                                            </button>
                                          </>
                                        )}

                                        {isApproved && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleUpdateStatus(
                                                tool.id,
                                                "ISSUED",
                                                `Issue tool ${tool.itemName} to employee ${selectedEmpTools.employeeName}?`
                                              )
                                            }
                                            className="px-2.5 py-1 rounded-lg bg-primary text-white hover:bg-primary/90 text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                                          >
                                            <PackagePlus className="h-3 w-3" /> Issue Tool
                                          </button>
                                        )}

                                        {isIssued && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleUpdateStatus(
                                                tool.id,
                                                "RETURNED",
                                                `Mark tool ${tool.itemName} as returned by ${selectedEmpTools.employeeName}?`
                                              )
                                            }
                                            className="px-2.5 py-1 rounded-lg bg-secondary border border-border text-foreground hover:bg-secondary/80 text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                                          >
                                            <RotateCcw className="h-3 w-3" /> Mark Returned
                                          </button>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-[11px] text-muted-foreground italic">Read-only</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-border bg-secondary/20 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEmpModalTab("ALL");
                    setSelectedEmpTools(null);
                  }}
                  className="px-5 py-2 rounded-xl border border-border bg-background hover:bg-secondary text-xs font-semibold text-foreground transition-colors cursor-pointer"
                >
                  Close View Tools Page
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
