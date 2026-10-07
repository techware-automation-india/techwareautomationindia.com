import { useEffect, useState } from "react";
import {
  Wrench,
  Plus,
  Trash2,
  Save,
  Loader2,
  Settings,
  Cog,
  FolderKanban,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPut } from "../../lib/api.js";

export default function ToolsSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [newProductType, setNewProductType] = useState("");
  const [newProject, setNewProject] = useState("");

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await apiGet("/tools-settings");
      if (data) {
        setCategories(data.categories || ["Tools", "Project"]);
        setProductTypes(data.productTypes || ["Mechanical", "Electrical", "Other"]);
        setProjects(data.projects || ["AutoCard Assembly Line 1", "AutoCard Assembly Line 2", "Project Titan", "Other / Custom Project"]);
      }
    } catch (err) {
      toast.error(err.message || "Failed to load tools settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleAddCategory = () => {
    const val = newCategory.trim();
    if (!val) return;
    if (categories.some((c) => c.toLowerCase() === val.toLowerCase())) {
      toast.error("Category already exists.");
      return;
    }
    setCategories([...categories, val]);
    setNewCategory("");
  };

  const handleRemoveCategory = (index) => {
    if (categories.length <= 1) {
      toast.error("At least one request category is required.");
      return;
    }
    setCategories(categories.filter((_, i) => i !== index));
  };

  const handleAddProductType = () => {
    const val = newProductType.trim();
    if (!val) return;
    if (productTypes.some((p) => p.toLowerCase() === val.toLowerCase())) {
      toast.error("Product type already exists.");
      return;
    }
    setProductTypes([...productTypes, val]);
    setNewProductType("");
  };

  const handleRemoveProductType = (index) => {
    if (productTypes.length <= 1) {
      toast.error("At least one product type is required.");
      return;
    }
    setProductTypes(productTypes.filter((_, i) => i !== index));
  };

  const handleAddProject = () => {
    const val = newProject.trim();
    if (!val) return;
    if (projects.some((p) => p.toLowerCase() === val.toLowerCase())) {
      toast.error("Project already exists.");
      return;
    }
    setProjects([...projects, val]);
    setNewProject("");
  };

  const handleRemoveProject = (index) => {
    if (projects.length <= 1) {
      toast.error("At least one project is required.");
      return;
    }
    setProjects(projects.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiPut("/tools-settings", { categories, productTypes, projects });
      toast.success("Tool Categories, Product Types & Projects updated successfully!");
    } catch (err) {
      toast.error(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl pb-12">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-border bg-gradient-to-br from-amber-500/10 via-primary/5 to-purple-500/10 p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border-2 border-amber-500/30 flex items-center justify-center shrink-0">
              <Settings className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                Tools & Inventory Request Settings
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage editable Request Categories, Product Types, and Project dropdown options.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadSettings}
              className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-secondary text-sm font-semibold transition-all inline-flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity shadow-md disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600 mb-3" />
          <p className="text-sm">Loading tools settings...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Request Categories Card */}
          <div className="rounded-2xl border-2 border-border bg-background p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <FolderKanban className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div>
                <h3 className="font-semibold text-foreground">Request Categories</h3>
                <p className="text-xs text-muted-foreground">Categories shown in form</p>
              </div>
            </div>

            {/* Add Category */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Tools, Project..."
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCategory())}
                className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 inline-flex items-center gap-1 shrink-0"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>

            {/* Category List */}
            <div className="space-y-2 pt-2 max-h-80 overflow-y-auto pr-1">
              {categories.map((cat, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <span className="text-sm font-semibold text-foreground">{cat}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(idx)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                    title="Delete Category"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Product Types Card */}
          <div className="rounded-2xl border-2 border-border bg-background p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <Cog className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="font-semibold text-foreground">Product Types</h3>
                <p className="text-xs text-muted-foreground">Product types (Mechanical, etc.)</p>
              </div>
            </div>

            {/* Add Product Type */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Mechanical, Electrical..."
                value={newProductType}
                onChange={(e) => setNewProductType(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddProductType())}
                className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
              />
              <button
                type="button"
                onClick={handleAddProductType}
                className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 inline-flex items-center gap-1 shrink-0"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>

            {/* Product Type List */}
            <div className="space-y-2 pt-2 max-h-80 overflow-y-auto pr-1">
              {productTypes.map((pt, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <span className="text-sm font-semibold text-foreground">{pt}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveProductType(idx)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                    title="Delete Product Type"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Project List Card */}
          <div className="rounded-2xl border-2 border-border bg-background p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <Wrench className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h3 className="font-semibold text-foreground">Project Names</h3>
                <p className="text-xs text-muted-foreground">Dropdown options for Project request</p>
              </div>
            </div>

            {/* Add Project */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Line 3, Project Alpha..."
                value={newProject}
                onChange={(e) => setNewProject(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddProject())}
                className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
              />
              <button
                type="button"
                onClick={handleAddProject}
                className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 inline-flex items-center gap-1 shrink-0"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>

            {/* Project List */}
            <div className="space-y-2 pt-2 max-h-80 overflow-y-auto pr-1">
              {projects.map((proj, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <span className="text-sm font-semibold text-foreground">{proj}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveProject(idx)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                    title="Delete Project"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
