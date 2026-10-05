import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  Send,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";

const today = () => new Date().toISOString().slice(0, 10);

const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow";

const EmployeeApplyLeave = () => {
  const navigate = useNavigate();
  const [balances, setBalances] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    leaveTypeId: "",
    startDate: today(),
    endDate: today(),
    comment: "",
  });

  const loadData = async () => {
    try {
      const [balRes, typesRes] = await Promise.all([
        apiGet("/leave/balances"),
        apiGet("/leave/types"),
      ]);
      setBalances(balRes.balances || []);
      setLeaveTypes(typesRes.leaveTypes || []);
    } catch (err) {
      toast.error(err.message || "Failed to load leave data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApply = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.leaveTypeId) {
      toast.error("Please select a leave type.");
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error("End date must be on or after start date.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPost("/leave/apply", {
        ...form,
        reason: form.comment,
      });
      if (res.autoApproved) {
        toast.success("Emergency leave applied and automatically approved!");
      } else {
        toast.success("Leave application submitted! Awaiting admin approval.");
      }
      navigate(-1);
    } catch (err) {
      toast.error(err.message || "Failed to apply for leave.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading leave options…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <CalendarDays className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Apply for Leave</h1>
          <p className="text-sm text-muted-foreground">
            Submit your leave application for approval.
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="rounded-2xl border border-border bg-background p-6 card-shadow">
        <form onSubmit={handleApply} className="space-y-4">
          {/* Leave type */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Leave Type <span className="text-destructive">*</span>
            </label>
            <select
              className={inputClass}
              value={form.leaveTypeId}
              onChange={(e) => setForm((p) => ({ ...p, leaveTypeId: e.target.value }))}
              required
            >
              <option value="">Select leave type...</option>
              {leaveTypes.map((lt) => {
                const bal = balances.find((b) => b.leaveTypeId === lt.id);
                return (
                  <option key={lt.id} value={lt.id}>
                    {lt.name} ({bal ? bal.remaining : lt.daysPerYear} days remaining)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Start Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                className={inputClass}
                value={form.startDate}
                min={today()}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    startDate: e.target.value,
                    endDate: e.target.value > p.endDate ? e.target.value : p.endDate,
                  }))
                }
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                End Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                className={inputClass}
                value={form.endDate}
                min={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Comment</label>
            <textarea
              className={inputClass + " resize-none"}
              rows={3}
              value={form.comment}
              onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
              maxLength={500}
              placeholder="Optional — add a comment for your leave request"
            />
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={submitting}
              className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="cta-gradient text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {submitting ? "Submitting…" : "Submit Application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeApplyLeave;
