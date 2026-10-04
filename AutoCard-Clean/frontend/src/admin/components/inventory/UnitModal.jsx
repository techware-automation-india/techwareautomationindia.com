import { useState, useEffect } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "../../../lib/api.js";

const UnitModal = ({ isOpen, onClose, onUnitCreated }) => {
  const [unitName, setUnitName] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = unitName.trim();
    if (!trimmed) {
      toast.error("Please enter a unit name.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiPost("/inventory/units", { name: trimmed });
      toast.success(`Unit "${res.unit.name}" added successfully.`);
      if (onUnitCreated) {
        onUnitCreated(res.unit.name);
      }
      setUnitName("");
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to add unit.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-background border border-border p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-display text-base font-bold text-foreground">Add Custom Unit</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-secondary cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Unit Name / Symbol <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. Coil, Roll, Drum, Packet"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-secondary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="cta-gradient text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" /> Save Unit
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UnitModal;

