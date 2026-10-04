import { useState, useEffect } from "react";
import { FolderPlus, Edit3, X, Loader2, Layers } from "lucide-react";
import { toast } from "sonner";
import { apiPost, apiPut } from "../../../lib/api.js";

const CategoryModal = ({
  isOpen,
  onClose,
  parentCategory = null,
  categoryToEdit = null,
  onSuccess,
}) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const targetLevel = categoryToEdit
    ? categoryToEdit.level
    : parentCategory
    ? (parentCategory.level || 1) + 1
    : 1;

  useEffect(() => {
    if (categoryToEdit) {
      setName(categoryToEdit.name || "");
      setCode(categoryToEdit.code || "");
      setDescription(categoryToEdit.description || "");
    } else {
      setName("");
      setCode("");
      setDescription("");
    }
  }, [categoryToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Category name is required.");
      return;
    }

    if (targetLevel > 4) {
      toast.error("Maximum 4 category levels allowed.");
      return;
    }

    setSubmitting(true);
    try {
      if (categoryToEdit) {
        await apiPut(`/inventory/categories/${categoryToEdit.id}`, {
          name: trimmedName,
          code: code.trim() || null,
          description: description.trim() || null,
        });
        toast.success("Category updated successfully!");
      } else {
        await apiPost("/inventory/categories", {
          name: trimmedName,
          code: code.trim() || null,
          description: description.trim() || null,
          parentId: parentCategory?.id || null,
        });
        toast.success(
          targetLevel === 1
            ? "Category created successfully!"
            : `Subcategory (Level ${targetLevel}) created successfully!`
        );
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to save category.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              {categoryToEdit ? <Edit3 className="h-5 w-5" /> : <FolderPlus className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">
                {categoryToEdit
                  ? "Edit Category"
                  : targetLevel === 1
                  ? "Add New Category"
                  : `Add Subcategory (Level ${targetLevel})`}
              </h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                <span>
                  Hierarchy Depth: Level {targetLevel} of 4
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-secondary cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Parent Category Info */}
        {!categoryToEdit && parentCategory && (
          <div className="p-3 rounded-xl bg-secondary/50 border border-border text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Parent Category:</span>{" "}
            {parentCategory.name} <span className="opacity-70">(Level {parentCategory.level || 1})</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Category Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder={
                targetLevel === 1
                  ? "e.g. Mechanical Equipment, Tools, Electrical"
                  : "e.g. Milling Cutters, Fasteners, Cables"
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Category Code
            </label>
            <input
              type="text"
              placeholder="e.g. CAT-MECH, SUB-MILL-01"
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Optional notes or details about this category..."
              className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-xl border border-border hover:bg-secondary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="cta-gradient text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : categoryToEdit ? (
                "Update Category"
              ) : (
                "Create Category"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CategoryModal;

