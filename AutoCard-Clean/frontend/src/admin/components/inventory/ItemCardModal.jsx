import { useState, useEffect, useRef } from "react";
import {
  Package, X, UploadCloud, Loader2, Plus, Image as ImageIcon, Trash2, Check
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut, apiUpload } from "../../../lib/api.js";
import UnitModal from "./UnitModal.jsx";

const resolveImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
};

const formatTimestamp = (d) => {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const mins = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${mins}`;
};

const ItemCardModal = ({
  isOpen,
  onClose,
  item = null,
  categoryId = null,
  categoryName = null,
  onSuccess,
}) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [specs, setSpecs] = useState([
    { key: "", value: "" },
    { key: "", value: "" },
    { key: "", value: "" },
    { key: "", value: "" },
    { key: "", value: "" },
  ]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("Nos");
  const [unitsList, setUnitsList] = useState([]);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // Load units list
  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const res = await apiGet("/inventory/units");
        if (res?.units && Array.isArray(res.units)) {
          const names = res.units
            .map((u) => (typeof u === "string" ? u : u?.name))
            .filter(Boolean);
          if (names.length > 0) {
            setUnitsList(names);
            return;
          }
        }
        setUnitsList(["Nos", "Pcs", "Kg", "Grams", "Liters", "Meters", "Boxes", "Sets", "Rolls", "Packets"]);
      } catch {
        // Fallback default units if API fails
        setUnitsList(["Nos", "Pcs", "Kg", "Grams", "Liters", "Meters", "Boxes", "Sets", "Rolls", "Packets"]);
      }
    };
    if (isOpen) {
      fetchUnits();
    }
  }, [isOpen]);

  // Populate form if editing
  useEffect(() => {
    if (item) {
      setName(item.name || "");
      setCode(item.code || item.sku || "");
      setPhotoUrl(item.photoUrl || "");
      setQuantity(item.quantity ?? 1);
      setUnit(item.unit || "Nos");

      // Handle specifications: can be Array or Object
      const initialSpecs = [
        { key: "", value: "" },
        { key: "", value: "" },
        { key: "", value: "" },
        { key: "", value: "" },
        { key: "", value: "" },
      ];

      if (Array.isArray(item.specifications)) {
        item.specifications.forEach((spec, idx) => {
          if (idx < 5) {
            initialSpecs[idx] = {
              key: spec?.key || "",
              value: spec?.value || "",
            };
          }
        });
      } else if (item.specifications && typeof item.specifications === "object") {
        const entries = Object.entries(item.specifications);
        entries.forEach(([k, v], idx) => {
          if (idx < 5) {
            initialSpecs[idx] = { key: k, value: String(v) };
          }
        });
      }
      setSpecs(initialSpecs);
    } else {
      // Reset for new item
      setName("");
      setCode("");
      setPhotoUrl("");
      setQuantity(1);
      setUnit("Nos");
      setSpecs([
        { key: "", value: "" },
        { key: "", value: "" },
        { key: "", value: "" },
        { key: "", value: "" },
        { key: "", value: "" },
      ]);
    }
  }, [item, isOpen]);

  if (!isOpen) return null;

  const handleSpecChange = (index, field, val) => {
    setSpecs((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png|jpg|webp)$/i)) {
      toast.error("Please upload a valid image file (JPG or PNG).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB.");
      return;
    }

    const formData = new FormData();
    formData.append("photo", file);

    setUploadingPhoto(true);
    try {
      const res = await apiUpload("/inventory/upload", formData);
      const uploaded = res?.photoUrl || res?.url;
      if (uploaded) {
        setPhotoUrl(uploaded);
        toast.success("Photo uploaded successfully.");
      } else {
        toast.error("Upload succeeded but no photo URL was returned.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to upload photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!name.trim()) {
      toast.error("Item Name is mandatory and must be filled.");
      return;
    }

    if (!code.trim()) {
      toast.error("Item Code is mandatory and must be filled.");
      return;
    }

    // Filter out completely empty spec rows
    const validSpecs = specs.filter((s) => s.key.trim() || s.value.trim());

    const payload = {
      name: name.trim(),
      code: code.trim(),
      categoryId: categoryId || item?.categoryId || null,
      photoUrl: photoUrl || null,
      specifications: validSpecs,
      quantity: Number(quantity) >= 0 ? Number(quantity) : 0,
      unit: unit || "Nos",
    };

    setSubmitting(true);
    try {
      if (item?.id) {
        await apiPut(`/inventory/items/${item.id}`, payload);
        toast.success("Item updated successfully!");
      } else {
        await apiPost("/inventory/items", payload);
        toast.success("Item added successfully!");
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to save item.");
    } finally {
      setSubmitting(false);
    }
  };

  const lastUpdatedDisplay = item?.updatedAt
    ? formatTimestamp(item.updatedAt)
    : item?.createdAt
    ? formatTimestamp(item.createdAt)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden my-6">
        {/* Header Bar matching Reference Mockup */}
        <div className="bg-[#1e3a5f] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Item</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Target Category Notice & Mandatory Legend */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {categoryName ? (
              <div className="px-3.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-medium flex items-center gap-2">
                <span>Category Destination:</span>
                <span className="font-semibold">{categoryName}</span>
              </div>
            ) : <div />}
            <div className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
              Fields marked with <span className="text-rose-500 font-bold text-sm leading-none">*</span> are mandatory
            </div>
          </div>

          {/* Row 1: Name and Code */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-foreground mb-1.5">
                Name <span className="text-rose-500 font-bold ml-0.5 text-base leading-none" title="Mandatory field">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter item name"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/40"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-foreground mb-1.5">
                Code <span className="text-rose-500 font-bold ml-0.5 text-base leading-none" title="Mandatory field">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter item code"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/40 font-mono"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Row 2: Specifications (Left) & Photo (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: 5 Key-Value Specifications */}
            <div className="lg:col-span-7 space-y-2">
              <label className="block text-sm font-bold text-foreground">
                Specification (5 Key Values)
              </label>
              <div className="border border-border/80 rounded-xl overflow-hidden bg-background">
                {/* Table Header */}
                <div className="grid grid-cols-12 bg-secondary/70 border-b border-border/70 py-2 px-3 text-xs font-bold text-foreground text-center">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-5 text-left pl-2">Key</div>
                  <div className="col-span-6 text-left pl-2">Value</div>
                </div>

                {/* 5 Rows */}
                <div className="divide-y divide-border/60">
                  {specs.map((spec, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 items-center px-3 py-1.5 gap-2 hover:bg-secondary/20"
                    >
                      <div className="col-span-1 text-xs font-semibold text-muted-foreground text-center">
                        {index + 1}
                      </div>
                      <div className="col-span-5">
                        <input
                          type="text"
                          placeholder={`Enter key ${index + 1}`}
                          className="w-full px-2.5 py-1.5 rounded-md border border-border/70 bg-background text-foreground placeholder:text-muted-foreground/70 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          value={spec.key}
                          onChange={(e) =>
                            handleSpecChange(index, "key", e.target.value)
                          }
                        />
                      </div>
                      <div className="col-span-6">
                        <input
                          type="text"
                          placeholder={`Enter value ${index + 1}`}
                          className="w-full px-2.5 py-1.5 rounded-md border border-border/70 bg-background text-foreground placeholder:text-muted-foreground/70 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          value={spec.value}
                          onChange={(e) =>
                            handleSpecChange(index, "value", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Photo Upload Box */}
            <div className="lg:col-span-5 space-y-2">
              <label className="block text-sm font-bold text-foreground">
                Photo
              </label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer min-h-[225px] transition-colors ${
                  photoUrl
                    ? "border-primary/40 bg-primary/[0.02]"
                    : "border-border hover:border-primary/60 hover:bg-secondary/40"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />

                {uploadingPhoto ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-xs font-medium">Uploading image...</span>
                  </div>
                ) : photoUrl ? (
                  <div className="w-full h-full flex flex-col items-center group relative">
                    <img
                      src={resolveImageUrl(photoUrl)}
                      alt="Item preview"
                      className="max-h-36 max-w-full object-contain rounded-lg shadow-xs"
                    />
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-primary font-semibold flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Uploaded
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotoUrl("");
                        }}
                        className="p-1 rounded bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 text-xs cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-4 space-y-2 text-muted-foreground">
                    <div className="w-16 h-12 rounded-lg bg-secondary/70 flex items-center justify-center text-muted-foreground/70 mb-1">
                      <ImageIcon className="h-8 w-8 stroke-[1.5]" />
                    </div>
                    <span className="text-sm font-bold text-foreground">
                      Upload Item Photo
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Click to upload or drag and drop
                    </span>
                    <span className="text-[11px] text-muted-foreground/80 font-mono">
                      JPG, PNG (Max 5MB)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Quantity Section */}
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-foreground">
              Quantity
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-44">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Enter quantity"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/40 font-semibold"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>

              <div className="w-36">
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/40 cursor-pointer"
                >
                  {unitsList.map((u, idx) => {
                    const unitName = typeof u === "string" ? u : u?.name || String(u);
                    return (
                      <option key={unitName || idx} value={unitName}>
                        {unitName}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Inline button to add custom unit */}
              <button
                type="button"
                onClick={() => setIsUnitModalOpen(true)}
                className="w-10 h-10 rounded-lg border border-primary/50 text-primary hover:bg-primary/10 flex items-center justify-center transition-colors cursor-pointer"
                title="Add custom unit"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            {/* Last Updated Display */}
            <div className="text-xs text-muted-foreground italic pt-1">
              {lastUpdatedDisplay ? `(Last Updated: ${lastUpdatedDisplay})` : `(Last Updated)`}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
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
              className="bg-[#1e3a5f] hover:bg-[#162b45] text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : item ? (
                "Update Item"
              ) : (
                "Save Item"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Unit Creation Sub-modal */}
      <UnitModal
        isOpen={isUnitModalOpen}
        onClose={() => setIsUnitModalOpen(false)}
        onUnitCreated={(newUnit) => {
          setUnitsList((prev) => (prev.includes(newUnit) ? prev : [...prev, newUnit]));
          setUnit(newUnit);
        }}
      />
    </div>
  );
};

export default ItemCardModal;

