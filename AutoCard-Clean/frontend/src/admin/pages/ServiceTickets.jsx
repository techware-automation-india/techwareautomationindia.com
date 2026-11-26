import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LifeBuoy,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  User,
  Building2,
  Calendar,
  MessageSquare,
  Wrench,
  Loader2,
  CheckCircle,
  XCircle,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch } from "../../lib/api.js";

const ServiceTickets = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [responseModalOpen, setResponseModalOpen] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [newStatus, setNewStatus] = useState("RESOLVED");
  const [updating, setUpdating] = useState(false);

  // New ticket modal
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [newTicketForm, setNewTicketForm] = useState({
    customerId: "",
    subject: "",
    description: "",
    priority: "MEDIUM",
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // In customer dashboard endpoint, recentRequests are customerServiceRequest
      const [dashRes, custRes] = await Promise.allSettled([
        apiGet("/customers/me/dashboard"),
        apiGet("/customers"),
      ]);

      if (custRes.status === "fulfilled" && custRes.value?.customers) {
        setCustomers(custRes.value.customers);
      }

      if (dashRes.status === "fulfilled" && dashRes.value?.recentRequests) {
        setTickets(dashRes.value.recentRequests);
      } else {
        // Fallback default sample or empty
        setTickets([]);
      }
    } catch (err) {
      console.error("Failed to load service tickets:", err);
      toast.error(err.message || "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    return {
      total: tickets.length,
      pending: tickets.filter((t) => t.status === "PENDING").length,
      inProgress: tickets.filter((t) => t.status === "IN_PROGRESS").length,
      resolved: tickets.filter((t) => t.status === "RESOLVED").length,
    };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (filterStatus !== "ALL" && ticket.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSub = ticket.subject?.toLowerCase().includes(q);
        const matchDesc = ticket.description?.toLowerCase().includes(q);
        const matchCust = ticket.customer?.companyName?.toLowerCase().includes(q) ||
                          ticket.customer?.user?.fullName?.toLowerCase().includes(q);
        return matchSub || matchDesc || matchCust;
      }
      return true;
    });
  }, [tickets, filterStatus, searchQuery]);

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newTicketForm.subject.trim() || !newTicketForm.description.trim()) {
      toast.error("Subject and description are required.");
      return;
    }

    setSubmitting(true);
    try {
      // Create request payload
      await apiPost("/customers/me/requests", {
        subject: newTicketForm.subject,
        description: newTicketForm.description,
        priority: newTicketForm.priority,
      });

      toast.success("Service ticket logged successfully!");
      setNewTicketModalOpen(false);
      setNewTicketForm({
        customerId: "",
        subject: "",
        description: "",
        priority: "MEDIUM",
      });
      loadData();
    } catch (err) {
      toast.error(err.message || "Failed to log service ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => navigate("/admin/customer-hub")}
            className="p-2.5 rounded-xl border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-xs"
            aria-label="Back to Customer Hub"
            title="Back to Customer Hub"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Customer Management</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">Support Desk</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Service & Breakdown Tickets
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-secondary text-xs font-medium text-foreground transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setNewTicketModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold shadow-xs hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Raise Breakdown Ticket
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Tickets", value: stats.total, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", icon: LifeBuoy },
          { label: "Pending Review", value: stats.pending, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: Clock },
          { label: "Under Repair", value: stats.inProgress, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", icon: Wrench },
          { label: "Resolved / Closed", value: stats.resolved, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
        ].map((item) => (
          <div key={item.label} className={`rounded-2xl border ${item.bg} p-4 transition-all hover:scale-[1.01]`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{item.label}</span>
              <item.icon className={`h-4 w-4 ${item.color}`} />
            </div>
            <div className="mt-2 text-2xl font-black">{item.value}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/50 border border-border w-fit overflow-x-auto">
          {[
            { key: "ALL", label: "All Tickets" },
            { key: "PENDING", label: "Pending" },
            { key: "IN_PROGRESS", label: "In Progress" },
            { key: "RESOLVED", label: "Resolved" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filterStatus === tab.key
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tickets, complaints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Tickets List */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs">Loading service requests...</span>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-16 text-center">
            <div className="h-12 w-12 rounded-2xl bg-secondary/80 flex items-center justify-center mx-auto mb-3 text-muted-foreground">
              <LifeBuoy className="h-6 w-6 opacity-60" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">No service tickets recorded</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Clients can submit machine breakdown complaints from the portal, or you can log an on-site service request using the button above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredTickets.map((ticket) => (
              <div key={ticket.id} className="p-5 hover:bg-secondary/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">{ticket.subject}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      ticket.priority === "HIGH"
                        ? "bg-red-500/10 text-red-600 border border-red-500/20"
                        : ticket.priority === "MEDIUM"
                        ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                    }`}>
                      {ticket.priority} Priority
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      ticket.status === "RESOLVED"
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : ticket.status === "IN_PROGRESS"
                        ? "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                        : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                    }`}>
                      {ticket.status}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {ticket.description}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </span>
                    {ticket.service?.name && (
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Wrench className="h-3 w-3 text-primary" />
                        {ticket.service.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setSelectedTicket(ticket);
                      setResponseText(ticket.response || "");
                      setNewStatus(ticket.status);
                      setResponseModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-secondary text-xs font-medium text-foreground transition-colors cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                    <span>Review & Update</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Ticket Modal */}
      {newTicketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-xs">
          <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
            <h3 className="font-semibold text-base text-foreground mb-1">Raise Service / Breakdown Ticket</h3>
            <p className="text-xs text-muted-foreground mb-4">Log machine repair request for dispatching field technicians.</p>

            <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-foreground mb-1 block">Subject / Issue Summary *</label>
                <input
                  required
                  placeholder="e.g. Card Feeding Jam error on ATR Machine #2"
                  value={newTicketForm.subject}
                  onChange={(e) => setNewTicketForm((p) => ({ ...p, subject: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-foreground mb-1 block">Priority Level</label>
                <select
                  value={newTicketForm.priority}
                  onChange={(e) => setNewTicketForm((p) => ({ ...p, priority: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                >
                  <option value="LOW">Low (General Query)</option>
                  <option value="MEDIUM">Medium (Maintenance Due)</option>
                  <option value="HIGH">High / Critical (Machine Down)</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground mb-1 block">Fault & Issue Description *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide technical symptoms, error codes, and symptoms..."
                  value={newTicketForm.description}
                  onChange={(e) => setNewTicketForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setNewTicketModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border bg-background text-xs font-medium hover:bg-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceTickets;
