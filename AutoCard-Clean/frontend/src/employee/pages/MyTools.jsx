import { useEffect, useState } from "react";
import {
  Wrench,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  UserCheck,
  ShieldCheck,
  Zap,
  Cog,
  Loader2,
  Box,
  RefreshCw,
} from "lucide-react";
import { apiGet } from "../../lib/api.js";

const fmtDate = (val) => {
  if (!val) return "—";
  const date = new Date(val);
  if (Number.isNaN(date.getTime())) return String(val);
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

export default function MyTools() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [toolsList, setToolsList] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfileAndTools = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const data = await apiGet("/onboarding/me");
      const prof = data?.profile || null;
      setProfile(prof);

      const raw = prof?.assignedTools || "";
      let parsed = [];

      // Try parsing as JSON first
      if (raw.trim().startsWith("[") && raw.trim().endsWith("]")) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = [];
        }
      }

      // Fallback: parse comma or newline separated string
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const items = raw
          .split(/,\s*|\n+/)
          .map((t) => t.trim())
          .filter(Boolean);

        const createDate = prof?.createdAt ? fmtDate(prof.createdAt) : "01/10/2026";
        const approveDate = prof?.updatedAt ? fmtDate(prof.updatedAt) : "02/10/2026";

        parsed = items.map((item, index) => {
          const lower = item.toLowerCase();
          let toolType = "Mechanical";
          if (
            lower.includes("multi") ||
            lower.includes("meter") ||
            lower.includes("volt") ||
            lower.includes("amp") ||
            lower.includes("wire") ||
            lower.includes("cable") ||
            lower.includes("electric") ||
            lower.includes("test")
          ) {
            toolType = "Electrical";
          } else if (
            lower.includes("helmet") ||
            lower.includes("glove") ||
            lower.includes("goggle") ||
            lower.includes("safety") ||
            lower.includes("jacket")
          ) {
            toolType = "Safety";
          }

          return {
            id: index + 1,
            toolName: item,
            type: toolType,
            createdDate: createDate,
            approvedDate: approveDate,
            approvedBy: "Admin / Operations Manager",
            status: "Approved",
          };
        });
      }

      setToolsList(parsed);
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
    const nameMatch = (t.toolName || "").toLowerCase().includes(searchTerm.toLowerCase());
    const typeMatch =
      typeFilter === "ALL" ||
      (t.type || "").toUpperCase().includes(typeFilter.toUpperCase());
    return nameMatch && typeMatch;
  });

  const electricalCount = toolsList.filter(
    (t) => (t.type || "").toLowerCase() === "electrical"
  ).length;
  const mechanicalCount = toolsList.filter(
    (t) => (t.type || "").toLowerCase() === "mechanical"
  ).length;
  const safetyCount = toolsList.filter((t) =>
    (t.type || "").toLowerCase().includes("safety")
  ).length;

  const getTypeBadge = (type) => {
    const t = (type || "").toLowerCase();
    if (t.includes("elect")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold">
          <Zap className="h-3 w-3 shrink-0" />
          Electrical
        </span>
      );
    }
    if (t.includes("mech")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold">
          <Cog className="h-3 w-3 shrink-0" />
          Mechanical
        </span>
      );
    }
    if (t.includes("safe")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
          <ShieldCheck className="h-3 w-3 shrink-0" />
          Safety
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-foreground border border-border text-xs font-semibold">
        <Wrench className="h-3 w-3 shrink-0" />
        {type || "General"}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Card */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-border bg-gradient-to-br from-amber-500/10 via-primary/5 to-purple-500/10 p-6 md:p-8 shadow-sm">
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-500/30 flex items-center justify-center shrink-0 shadow-md">
              <Wrench className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                My Tools & Equipment
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                View company tools, instruments, and equipment allocated to your profile for electrical & mechanical site work.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchProfileAndTools(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-secondary text-sm font-semibold transition-all shadow-sm shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/60">
          <div className="rounded-xl border border-border bg-background/80 p-3.5 backdrop-blur-sm">
            <div className="text-xs font-medium uppercase text-muted-foreground">Total Tools</div>
            <div className="text-2xl font-bold text-foreground mt-0.5">{toolsList.length}</div>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 backdrop-blur-sm">
            <div className="text-xs font-medium uppercase text-blue-600 dark:text-blue-400">Electrical</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">{electricalCount}</div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 backdrop-blur-sm">
            <div className="text-xs font-medium uppercase text-amber-600 dark:text-amber-400">Mechanical</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{mechanicalCount}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 backdrop-blur-sm">
            <div className="text-xs font-medium uppercase text-emerald-600 dark:text-emerald-400">Safety Gear</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{safetyCount}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tools by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
          {["ALL", "Electrical", "Mechanical", "Safety"].map((cat) => (
            <button
              key={cat}
              onClick={() => setTypeFilter(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                typeFilter === cat
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border-2 border-border bg-background shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600 mb-3" />
            <p className="text-sm">Loading tools and equipment...</p>
          </div>
        ) : filteredTools.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3.5 px-4 sm:px-6">#</th>
                  <th className="py-3.5 px-4 sm:px-6">Tools Name</th>
                  <th className="py-3.5 px-4 sm:px-6">Project Name</th>
                  <th className="py-3.5 px-4 sm:px-6">Type</th>
                  <th className="py-3.5 px-4 sm:px-6">Request Create Date</th>
                  <th className="py-3.5 px-4 sm:px-6">Request Approve Date</th>
                  <th className="py-3.5 px-4 sm:px-6">Request Approved Emp Name</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Status</th>
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
                        <span className="font-semibold text-foreground">
                          {tool.toolName}
                        </span>
                      </div>
                    </td>

                    <td className="py-4 px-4 sm:px-6">
                      <span className="text-xs font-medium text-foreground px-2.5 py-1 rounded-md bg-secondary/60 border border-border">
                        {tool.projectName || "AutoCard Assembly Line 1"}
                      </span>
                    </td>

                    <td className="py-4 px-4 sm:px-6">
                      {getTypeBadge(tool.type)}
                    </td>

                    <td className="py-4 px-4 sm:px-6 text-muted-foreground">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                        {tool.createdDate || "—"}
                      </div>
                    </td>

                    <td className="py-4 px-4 sm:px-6 text-muted-foreground">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        {tool.approvedDate || "—"}
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

                    <td className="py-4 px-4 sm:px-6 text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        Approved
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center flex flex-col items-center justify-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4 text-muted-foreground">
              <Box className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">
              No Tools Found
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {searchTerm || typeFilter !== "ALL"
                ? "No equipment matches your current search filters."
                : "No tools or equipment are currently assigned to your employee profile."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
