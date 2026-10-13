import { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  ArrowLeft,
  User,
  Building2,
  AlertTriangle,
  FileText,
  Wrench,
  RotateCcw,
  PackagePlus,
  X,
  MessageSquare,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../../lib/api.js";

export default function InventoryApprovalView({ onBackToHub }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("ALL");

  const [actingId, setActingId] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/requests");
      const allReqs = res.requests || [];
      // Filter strictly for EQUIPMENT (Inventory / Tools Requisitions)
      const equipmentReqs = allReqs.filter(
        (r) => r.type === "EQUIPMENT" || (r.subject && r.subject.includes("[TOOLS_INVENTORY]"))
      );
      setRequests(equipmentReqs);
    } catch (err) {
      toast.error(err.message || "Failed to load inventory requisitions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const parseRequestDetails = (reqItem) => {
    let details = {};
    try {
      if (reqItem.description && reqItem.description.includes("{")) {
        const jsonMatch = reqItem.description.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          details = JSON.parse(jsonMatch[0]);
        }
      }
    } catch {
      // Ignore parse failure
    }
    return details;
  };

  const handleApprove = async (id, note = "") => {
    setActingId(id);
    try {
      await apiPost(`/requests/${id}/approve`, { note });
      toast.success("Inventory requisition approved successfully.");
      await loadRequests();
    } catch (err) {
      toast.error(err.message || "Failed to approve requisition.");
    } finally {
      setActingId(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModal) return;
    setActingId(rejectModal.id);
    try {
      await apiPost(`/requests/${rejectModal.id}/reject`, {
        reason: rejectReason || "Rejected by inventory manager.",
        note: rejectReason || "Rejected by inventory manager.",
      });
      toast.success("Inventory requisition rejected.");
      setRejectModal(null);
      setRejectReason("");
      await loadRequests();
    } catch (err) {
      toast.error(err.message || "Failed to reject requisition.");
    } finally {
      setActingId(null);
    }
  };

  const filteredRequests = requests.filter((req) => {
    const matchesStatus = statusFilter === "ALL" || req.status === statusFilter;

    const empName = req.employee?.user?.fullName || req.employee?.fullName || "";
    const empCode = req.employee?.employeeCode || "";
    const subj = req.subject || "";
    const desc = req.description || "";

    const matchesSearch =
      empName.toLowerCase().includes(search.toLowerCase()) ||
      empCode.toLowerCase().includes(search.toLowerCase()) ||
      subj.toLowerCase().includes(search.toLowerCase()) ||
      desc.toLowerCase().includes(search.toLowerCase());

    const details = parseRequestDetails(req);
    const matchesUrgency =
      urgencyFilter === "ALL" || (details.urgency && details.urgency.toUpperCase() === urgencyFilter.toUpperCase());

    return matchesStatus && matchesSearch && matchesUrgency;
  });

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = requests.filter((r) => r.status === "REJECTED").length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="p-2 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Back to Inventory Submodules"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Sub-module 3: Inventory Approval
            </h1>
            <p className="text-sm text-muted-foreground">
              Review and sign-off on material requisitions, tool issues, and return requests.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadRequests}
          disabled={loading}
          className="p-2.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stats Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Pending Approval
            </span>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Approved Requisitions
            </span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{approvedCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Rejected Requisitions
            </span>
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">{rejectedCount}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-background p-4 rounded-2xl border border-border card-shadow">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search requisition by employee, item, or project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-secondary/30 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {["PENDING", "APPROVED", "REJECTED", "ALL"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === st
                  ? "bg-primary text-white shadow-xs"
                  : "bg-secondary/40 border border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Requisitions List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground bg-background rounded-2xl border border-border">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
            <p className="text-sm">Loading inventory requisitions...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground bg-background rounded-2xl border border-border">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground/60" />
            <h3 className="font-bold text-base text-foreground mb-1">No Requisitions Found</h3>
            <p className="text-xs text-muted-foreground">
              No material requisitions match the selected filters.
            </p>
          </div>
        ) : (
          filteredRequests.map((reqItem) => {
            const details = parseRequestDetails(reqItem);
            const employeeName = reqItem.employee?.user?.fullName || reqItem.employee?.fullName || "Employee";
            const employeeCode = reqItem.employee?.employeeCode || "";
            const isTaking = details.actionType === "Taking";
            const isPending = reqItem.status === "PENDING";
            const isApproved = reqItem.status === "APPROVED";
            const isRejected = reqItem.status === "REJECTED";

            return (
              <div
                key={reqItem.id}
                className={`rounded-2xl border bg-background p-6 card-shadow transition-all space-y-4 ${
                  isPending
                    ? "border-amber-500/40 bg-amber-500/[0.02]"
                    : isApproved
                    ? "border-emerald-500/30 bg-emerald-500/[0.01]"
                    : "border-border"
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isTaking
                          ? "bg-blue-500/10 text-blue-600"
                          : "bg-emerald-500/10 text-emerald-600"
                      }`}
                    >
                      {isTaking ? <PackagePlus className="h-5 w-5" /> : <RotateCcw className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-foreground">
                          {details.itemName || reqItem.subject}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isTaking
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          }`}
                        >
                          {details.actionType || "Requisition"}
                        </span>
                        {details.urgency && (
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                              details.urgency === "Emergency"
                                ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                                : details.urgency === "Urgent"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {details.urgency}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Requested by <strong className="text-foreground">{employeeName}</strong> ({employeeCode || "EMP"})
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      isPending
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-500/30"
                        : isApproved
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {isPending && <Clock className="h-3.5 w-3.5" />}
                    {isApproved && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {isRejected && <XCircle className="h-3.5 w-3.5" />}
                    <span>{reqItem.status}</span>
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-secondary/30 text-xs">
                  <div>
                    <span className="text-muted-foreground block font-medium">Quantity</span>
                    <span className="font-bold text-foreground text-sm">{details.quantity || 1} Nos</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-medium">Category / Type</span>
                    <span className="font-semibold text-foreground">
                      {details.category || "Tools"} ({details.productType || "Mechanical"})
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-medium">Project Name</span>
                    <span className="font-semibold text-foreground">{details.projectName || "General"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-medium">Submitted Date</span>
                    <span className="font-semibold text-foreground">
                      {new Date(reqItem.createdAt).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Reason / Notes */}
                {(details.reason || reqItem.description) && (
                  <div className="text-xs text-muted-foreground bg-background p-3 rounded-xl border border-border">
                    <span className="font-semibold text-foreground block mb-0.5">Reason / Note:</span>
                    <span>{details.reason || reqItem.description}</span>
                  </div>
                )}

                {/* Reviewer Note if already reviewed */}
                {reqItem.reviewNote && (
                  <div className="text-xs p-3 rounded-xl bg-secondary/50 border border-border text-muted-foreground">
                    <span className="font-semibold text-foreground block mb-0.5">
                      Reviewer Note ({reqItem.reviewedBy?.fullName || "Admin"}):
                    </span>
                    <span>{reqItem.reviewNote}</span>
                  </div>
                )}

                {/* Action Footer */}
                {isPending && (
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                    <button
                      type="button"
                      disabled={actingId === reqItem.id}
                      onClick={() => setRejectModal(reqItem)}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject Requisition
                    </button>
                    <button
                      type="button"
                      disabled={actingId === reqItem.id}
                      onClick={() => handleApprove(reqItem.id)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve Requisition
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Rejection Note Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-bold text-base text-foreground">Reject Inventory Requisition</h3>
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Please provide a rejection note for <strong>{rejectModal.employee?.user?.fullName || "Employee"}</strong>.
              </p>
              <textarea
                rows="3"
                placeholder="Reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModal(null)}
                  className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-secondary text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRejectSubmit}
                  disabled={actingId === rejectModal.id}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
