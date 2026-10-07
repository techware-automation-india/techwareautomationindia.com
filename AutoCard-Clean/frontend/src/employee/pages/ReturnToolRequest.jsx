import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  RotateCcw,
  ArrowLeft,
  Loader2,
  Send,
  Wrench,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";

export default function ReturnToolRequest() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assignedToolsList, setAssignedToolsList] = useState([]);

  const [form, setForm] = useState({
    selectedTool: "",
    customToolName: "",
    productId: "",
    returnDate: new Date().toISOString().slice(0, 10),
    condition: "Good Condition",
    remarks: "",
  });

  useEffect(() => {
    let isMounted = true;
    const fetchTools = async () => {
      try {
        setLoading(true);
        const data = await apiGet("/onboarding/me");
        const raw = data?.profile?.assignedTools || "";
        const tools = raw
          .split(/,\s*|\n+/)
          .map((t) => t.trim())
          .filter(Boolean);

        if (isMounted) {
          setAssignedToolsList(tools);
          if (tools.length > 0) {
            setForm((prev) => ({ ...prev, selectedTool: tools[0] }));
          } else {
            setForm((prev) => ({ ...prev, selectedTool: "Other / Custom Item" }));
          }
        }
      } catch (err) {
        console.warn("Failed to load assigned tools:", err);
      } fontFinally: {
        if (isMounted) setLoading(false);
      }
    };

    fetchTools();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const toolName =
      form.selectedTool === "Other / Custom Item"
        ? form.customToolName.trim()
        : form.selectedTool;

    if (!toolName) {
      toast.error("Please enter or select the Tool / Item Name to return.");
      return;
    }

    if (!form.remarks.trim()) {
      toast.error("Please provide remarks or reason for returning this item.");
      return;
    }

    try {
      setSubmitting(true);

      const subject = `[Return Tool/Product Request] ${toolName}${
        form.productId ? ` (ID: ${form.productId.trim()})` : ""
      }`;

      const descriptionLines = [
        `Request Type: RETURN_EQUIPMENT`,
        `Tool / Item Name: ${toolName}`,
        form.productId ? `Product ID / Part Code: ${form.productId.trim()}` : null,
        `Return Date: ${form.returnDate}`,
        `Item Condition: ${form.condition}`,
        `\nReturn Remarks / Work Details:\n${form.remarks.trim()}`,
      ]
        .filter(Boolean)
        .join("\n");

      await apiPost("/requests", {
        type: "EQUIPMENT",
        subject,
        description: descriptionLines,
      });

      toast.success("Return Tool / Product request submitted successfully!");
      navigate("/employee/requests/track");
    } catch (err) {
      toast.error(err.message || "Failed to submit return request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6 pb-12">
      {/* Back button */}
      <Link
        to="/employee/requests"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Requests
      </Link>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-border bg-gradient-to-br from-rose-500/10 via-primary/5 to-amber-500/10 p-6 md:p-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border-2 border-rose-500/30 flex items-center justify-center shrink-0">
            <RotateCcw className="h-6 w-6 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Return Tool / Product
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Submit a return request for assigned company tools, equipment, or project items.
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="rounded-2xl border-2 border-border bg-background p-6 md:p-8 shadow-sm space-y-6">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-rose-600 mb-3" />
            <p className="text-sm">Loading assigned equipment...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Select Tool / Product to Return */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Select Assigned Tool / Equipment <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.selectedTool}
                onChange={(e) => handleChange("selectedTool", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-semibold"
              >
                {assignedToolsList.map((tool, idx) => (
                  <option key={idx} value={tool}>
                    {tool}
                  </option>
                ))}
                <option value="Other / Custom Item">Other / Custom Item Not Listed</option>
              </select>
            </div>

            {/* Custom Tool Name input if "Other" is selected */}
            {form.selectedTool === "Other / Custom Item" && (
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Custom Tool / Item Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fluke Multimeter, Bosch Drill, Safety Helmet"
                  value={form.customToolName}
                  onChange={(e) => handleChange("customToolName", e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                />
              </div>
            )}

            {/* Product ID / Part Code */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Product ID / Part Code <span className="text-muted-foreground text-[10px] font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. TOOL-ELE-001 or PRD-MECH-8802"
                value={form.productId}
                onChange={(e) => handleChange("productId", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
              />
            </div>

            {/* Return Date */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Return Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.returnDate}
                onChange={(e) => handleChange("returnDate", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
              />
            </div>

            {/* Item Condition */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Item Condition Upon Return <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.condition}
                onChange={(e) => handleChange("condition", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-medium"
              >
                <option value="Good Condition">Good Condition (Clean & Fully Functional)</option>
                <option value="Minor Wear">Minor Wear & Tear (Normal Usage)</option>
                <option value="Damaged / Needs Repair">Damaged / Needs Maintenance or Repair</option>
                <option value="Defective / Missing Parts">Defective / Missing Accessories</option>
              </select>
            </div>

            {/* Return Remarks */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Return Remarks / Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                required
                placeholder="Provide remarks about why this tool/product is being returned (e.g. Site B project completed. Returning equipment to central inventory)."
                value={form.remarks}
                onChange={(e) => handleChange("remarks", e.target.value)}
                className="w-full rounded-xl border border-border bg-background p-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm resize-y"
              />
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/employee/requests")}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl border border-border bg-secondary text-foreground text-sm font-semibold hover:bg-secondary/80 transition-all"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting || loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors shadow-md disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Submit Return Request
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
