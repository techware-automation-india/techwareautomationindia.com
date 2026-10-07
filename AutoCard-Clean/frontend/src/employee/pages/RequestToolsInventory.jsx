import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Wrench,
  ArrowLeft,
  Loader2,
  Send,
  FolderKanban,
  RotateCcw,
  PackagePlus,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";

export default function RequestToolsInventory() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [loadingTools, setLoadingTools] = useState(false);
  const [assignedToolsList, setAssignedToolsList] = useState([]);

  const [categories, setCategories] = useState(["Tools", "Project"]);
  const [productTypes, setProductTypes] = useState(["Mechanical", "Electrical", "Other"]);
  const [projects, setProjects] = useState(["AutoCard Assembly Line 1", "AutoCard Assembly Line 2", "Project Titan", "Other / Custom Project"]);
  const [customProjectName, setCustomProjectName] = useState("");

  // Form State - Unified Schema for Taking and Return
  const [form, setForm] = useState({
    actionType: "Taking", // "Taking" | "Return"
    category: "Tools", // "Tools" | "Project"
    productType: "Mechanical", // "Mechanical" | "Electrical" | "Other"
    projectName: "",
    productId: "",
    itemName: "",
    selectedAssignedTool: "",
    quantity: 1,
    urgency: "Normal",
    itemCondition: "Good Condition",
    returnDate: new Date().toISOString().slice(0, 10),
    reason: "",
  });

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoadingTools(true);

        // Load dynamic settings from backend
        const settings = await apiGet("/tools-settings");
        let loadedProjects = ["AutoCard Assembly Line 1", "AutoCard Assembly Line 2", "Project Titan", "Other / Custom Project"];

        if (isMounted && settings) {
          if (Array.isArray(settings.categories) && settings.categories.length > 0) {
            setCategories(settings.categories);
            setForm((prev) => ({ ...prev, category: settings.categories[0] }));
          }
          if (Array.isArray(settings.productTypes) && settings.productTypes.length > 0) {
            setProductTypes(settings.productTypes);
            setForm((prev) => ({ ...prev, productType: settings.productTypes[0] }));
          }
          if (Array.isArray(settings.projects) && settings.projects.length > 0) {
            loadedProjects = settings.projects;
          }
        }

        // Try fetching active projects from system API
        try {
          const sysProjects = await apiGet("/projects");
          if (Array.isArray(sysProjects)) {
            const sysNames = sysProjects.map((p) => p.name || p.title).filter(Boolean);
            if (sysNames.length > 0) {
              const combined = Array.from(new Set([...sysNames, ...loadedProjects]));
              loadedProjects = combined;
            }
          } else if (Array.isArray(sysProjects?.projects)) {
            const sysNames = sysProjects.projects.map((p) => p.name || p.title).filter(Boolean);
            if (sysNames.length > 0) {
              const combined = Array.from(new Set([...sysNames, ...loadedProjects]));
              loadedProjects = combined;
            }
          }
        } catch {
          // ignore if /projects fetch fails or requires different permissions
        }

        if (isMounted) {
          setProjects(loadedProjects);
          if (loadedProjects.length > 0) {
            setForm((prev) => ({ ...prev, projectName: loadedProjects[0] }));
          }
        }

        // Load assigned employee tools for Return option
        const profileRes = await apiGet("/onboarding/me");
        const rawTools = profileRes?.profile?.assignedTools || "";
        const toolsArr = rawTools
          .split(/,\s*|\n+/)
          .map((t) => t.trim())
          .filter(Boolean);

        if (isMounted) {
          setAssignedToolsList(toolsArr);
          if (toolsArr.length > 0) {
            setForm((prev) => ({ ...prev, selectedAssignedTool: toolsArr[0], itemName: toolsArr[0] }));
          } else {
            setForm((prev) => ({ ...prev, selectedAssignedTool: "Other / Custom Item" }));
          }
        }
      } catch (err) {
        console.warn("Failed to load initial tools form settings:", err);
      } finally {
        if (isMounted) setLoadingTools(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleToolSelectChange = (value) => {
    if (value === "Other / Custom Item") {
      setForm((prev) => ({ ...prev, selectedAssignedTool: value, itemName: "" }));
    } else {
      setForm((prev) => ({ ...prev, selectedAssignedTool: value, itemName: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const effectiveProjectName =
      form.category === "Project"
        ? form.projectName === "Other / Custom Project"
          ? customProjectName.trim()
          : form.projectName.trim()
        : "";

    if (form.category === "Project" && !effectiveProjectName) {
      toast.error("Please select or enter the Project Name.");
      return;
    }

    if (!form.productId.trim()) {
      toast.error("Please enter the Product ID / Part Code.");
      return;
    }

    const effectiveItemName =
      form.actionType === "Return" && form.selectedAssignedTool !== "Other / Custom Item"
        ? form.selectedAssignedTool
        : form.itemName.trim();

    if (!effectiveItemName) {
      toast.error("Please enter or select the Tool or Item Name.");
      return;
    }

    if (!form.reason.trim()) {
      toast.error("Please provide purpose / work details / remarks.");
      return;
    }

    try {
      setSubmitting(true);

      const actionTag = form.actionType === "Return" ? "Inventory Return" : "Inventory Taking";
      const subject =
        form.category === "Project"
          ? `[${actionTag}: ${effectiveProjectName}] ${effectiveItemName} (${form.productType} - ID: ${form.productId.trim()})`
          : `[${actionTag}: ${form.productId.trim()}] ${effectiveItemName} (${form.productType})`;

      const descriptionLines = [
        `Action Type: ${form.actionType.toUpperCase()}`,
        `Category: ${form.category}`,
        `Product Type: ${form.productType}`,
        `Product ID: ${form.productId.trim()}`,
        form.category === "Project" ? `Project Name: ${effectiveProjectName}` : null,
        `Item Name: ${effectiveItemName}`,
        `Quantity: ${form.quantity}`,
        `Urgency Level: ${form.urgency}`,
        form.actionType === "Return" ? `Item Condition: ${form.itemCondition}` : null,
        `Date: ${form.returnDate}`,
        `\nPurpose / Work Details / Remarks:\n${form.reason.trim()}`,
      ]
        .filter(Boolean)
        .join("\n");

      await apiPost("/requests", {
        type: "EQUIPMENT",
        subject,
        description: descriptionLines,
      });

      toast.success(
        `Tool / Inventory request (${form.actionType}) submitted successfully!`
      );
      navigate("/employee/requests/track");
    } catch (err) {
      toast.error(err.message || "Failed to submit request.");
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
      <div className="relative overflow-hidden rounded-2xl border-2 border-border bg-gradient-to-br from-amber-500/10 via-primary/5 to-purple-500/10 p-6 md:p-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border-2 border-amber-500/30 flex items-center justify-center shrink-0">
            {form.actionType === "Return" ? (
              <RotateCcw className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            ) : (
              <PackagePlus className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Request Tools & Inventory
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Submit a request for Taking (Issue) or Return of tools, mechanical & electrical equipment, or project items.
            </p>
          </div>
        </div>
      </div>

      {/* Form Card - Unified Schema */}
      <form onSubmit={handleSubmit} className="rounded-2xl border-2 border-border bg-background p-6 md:p-8 shadow-sm space-y-6">
        {/* Action Type Toggle (1. Taking | 2. Return) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Action Type <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3 p-1.5 rounded-xl border border-border bg-secondary/30">
            <button
              type="button"
              onClick={() => handleChange("actionType", "Taking")}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                form.actionType === "Taking"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              }`}
            >
              <PackagePlus className="h-4 w-4" />
              1. Taking (Issue Item)
            </button>

            <button
              type="button"
              onClick={() => handleChange("actionType", "Return")}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                form.actionType === "Return"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              }`}
            >
              <RotateCcw className="h-4 w-4" />
              2. Return (Return Item)
            </button>
          </div>
        </div>

        {/* Unified Form Grid (Same Schema for Taking & Return) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Row 1: Request Category & Project Name (if Category == "Project") */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Request Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.category}
              onChange={(e) => handleChange("category", e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-semibold"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {form.category === "Project" ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Project Name <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.projectName}
                onChange={(e) => handleChange("projectName", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-medium"
              >
                {projects.map((proj) => (
                  <option key={proj} value={proj}>
                    {proj}
                  </option>
                ))}
              </select>

              {form.projectName === "Other / Custom Project" && (
                <input
                  type="text"
                  required
                  placeholder="Enter custom project name..."
                  value={customProjectName}
                  onChange={(e) => setCustomProjectName(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                />
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Product Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.productType}
                onChange={(e) => handleChange("productType", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-medium"
              >
                {productTypes.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Row 2: Product Type (if Category == "Project") & Product ID / Part Code */}
          {form.category === "Project" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Product Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.productType}
                onChange={(e) => handleChange("productType", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-medium"
              >
                {productTypes.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Product ID / Part Code <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={form.category === "Project" ? "e.g. PRD-MECH-8802" : "e.g. TOOL-ELE-001"}
              value={form.productId}
              onChange={(e) => handleChange("productId", e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
          </div>

          {/* Row 3: Tool / Item Name */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {form.category === "Project" ? "Item / Component Name" : "Tool / Item Name"} <span className="text-rose-500">*</span>
            </label>
            {form.actionType === "Return" && assignedToolsList.length > 0 ? (
              <div className="space-y-3">
                <select
                  value={form.selectedAssignedTool}
                  onChange={(e) => handleToolSelectChange(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-semibold"
                >
                  {assignedToolsList.map((tool, idx) => (
                    <option key={idx} value={tool}>
                      {tool}
                    </option>
                  ))}
                  <option value="Other / Custom Item">Other / Custom Item Not Listed</option>
                </select>

                {form.selectedAssignedTool === "Other / Custom Item" && (
                  <input
                    type="text"
                    required
                    placeholder="Enter custom tool or item name to return"
                    value={form.itemName}
                    onChange={(e) => handleChange("itemName", e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                  />
                )}
              </div>
            ) : (
              <input
                type="text"
                required
                placeholder={
                  form.category === "Project"
                    ? "e.g. Conveyor Motor Assembly, PLC Controller Module"
                    : "e.g. Fluke 87V Digital Multimeter, Bosch Hammer Drill 26mm"
                }
                value={form.itemName}
                onChange={(e) => handleChange("itemName", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
              />
            )}
          </div>

          {/* Row 4: Quantity & Urgency Level */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Quantity <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="500"
              required
              value={form.quantity}
              onChange={(e) => handleChange("quantity", Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Urgency Level <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.urgency}
              onChange={(e) => handleChange("urgency", e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
            >
              <option value="Normal">Normal (Standard Processing)</option>
              <option value="Urgent">Urgent (Needed within 24 Hours)</option>
              <option value="Emergency">Emergency / Immediate Site Work</option>
            </select>
          </div>

          {/* Row 5: Item Condition (if Return) & Date */}
          {form.actionType === "Return" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Item Condition Upon Return <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.itemCondition}
                onChange={(e) => handleChange("itemCondition", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-medium"
              >
                <option value="Good Condition">Good Condition (Clean & Fully Functional)</option>
                <option value="Minor Wear">Minor Wear & Tear (Normal Usage)</option>
                <option value="Damaged / Needs Repair">Damaged / Needs Maintenance or Repair</option>
                <option value="Defective / Missing Parts">Defective / Missing Accessories</option>
              </select>
            </div>
          )}

          <div className={form.actionType === "Return" ? "" : "md:col-span-2"}>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {form.actionType === "Return" ? "Return Date" : "Date"} <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={form.returnDate}
              onChange={(e) => handleChange("returnDate", e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
          </div>

          {/* Row 6: Purpose / Work Details / Remarks */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Purpose / Work Details / Remarks <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              required
              placeholder={
                form.actionType === "Return"
                  ? "Provide return remarks or work details (e.g. Project completed at Site B. Returning multimeter and drill to store)."
                  : "Provide details about why this item is needed and where it will be used."
              }
              value={form.reason}
              onChange={(e) => handleChange("reason", e.target.value)}
              className="w-full rounded-xl border border-border bg-background p-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm resize-y"
            />
          </div>
        </div>

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
            disabled={submitting || loadingTools}
            className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md disabled:opacity-60 ${
              form.actionType === "Return"
                ? "bg-rose-600 text-white hover:bg-rose-700"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Submit {form.actionType === "Return" ? "Return" : "Taking"} Request
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
