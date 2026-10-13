import { useState, useEffect, useRef } from "react";
import {
  Package, X, UploadCloud, Loader2, Plus, Image as ImageIcon, Trash2, Check,
  IndianRupee, Calculator, Hash, ShieldAlert, Tag, Barcode, Building2, MapPin,
  Sparkles, Layers, Info, CheckCircle2, Camera, User
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut, apiUpload } from "../../../lib/api.js";
import { getAuthUser } from "../../../lib/auth.js";
import UnitModal from "./UnitModal.jsx";
import CameraCaptureModal from "./CameraCaptureModal.jsx";

const resolveImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4001";
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

const SPEC_PRESETS = ["Size", "Material", "Color", "Length", "Rating", "Voltage", "Type"];

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
  ]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [minStock, setMinStock] = useState(5);
  const [maxStock, setMaxStock] = useState(100);
  const [costPrice, setCostPrice] = useState(0);
  const [unit, setUnit] = useState("Nos");
  const [warehouse, setWarehouse] = useState("Main Warehouse");
  const [location, setLocation] = useState("");
  const [unitsList, setUnitsList] = useState([]);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
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
      setMinStock(item.minStock ?? 5);
      setMaxStock(item.maxStock ?? 100);
      setCostPrice(item.costPrice ?? 0);
      setUnit(item.unit || "Nos");
      setWarehouse(item.warehouse || "Main Warehouse");
      setLocation(item.location || "");

      // Handle specifications: can be Array or Object (Unlimited)
      let initialSpecs = [];
      if (Array.isArray(item.specifications) && item.specifications.length > 0) {
        initialSpecs = item.specifications.map((spec) => ({
          key: spec?.key || "",
          value: spec?.value || "",
        }));
      } else if (item.specifications && typeof item.specifications === "object" && Object.keys(item.specifications).length > 0) {
        initialSpecs = Object.entries(item.specifications).map(([k, v]) => ({
          key: k,
          value: String(v),
        }));
      }

      if (initialSpecs.length === 0) {
        initialSpecs = [
          { key: "", value: "" },
          { key: "", value: "" },
        ];
      }
      setSpecs(initialSpecs);
    } else {
      // Reset for new item
      setName("");
      setCode("");
      setPhotoUrl("");
      setQuantity(1);
      setMinStock(5);
      setMaxStock(100);
      setCostPrice(0);
      setUnit("Nos");
      setWarehouse("Main Warehouse");
      setLocation("");
      setSpecs([
        { key: "", value: "" },
        { key: "", value: "" },
      ]);
    }
  }, [item, isOpen]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSpecChange = (index, field, val) => {
    setSpecs((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleApplyPreset = (presetKey) => {
    // If there is an empty key slot, fill it
    const firstEmptyIndex = specs.findIndex((s) => !s.key.trim());
    if (firstEmptyIndex !== -1) {
      handleSpecChange(firstEmptyIndex, "key", presetKey);
    } else {
      // Otherwise append a new row with this preset key
      setSpecs((prev) => [...prev, { key: presetKey, value: "" }]);
    }
  };

  const handleAddSpecRow = () => {
    setSpecs((prev) => [...prev, { key: "", value: "" }]);
  };

  const handleDeleteSpecRow = (index) => {
    if (specs.length <= 1) {
      setSpecs([{ key: "", value: "" }]);
      return;
    }
    setSpecs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearSpecRow = (index) => {
    setSpecs((prev) => {
      const copy = [...prev];
      copy[index] = { key: "", value: "" };
      return copy;
    });
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png|jpg|webp)$/i)) {
      toast.error("Please upload a valid image file (JPG, PNG or WEBP).");
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

    if (/[_\-]/.test(code.trim())) {
      toast.error("Item Code / SKU cannot contain hyphen (-) or underscore (_) characters.");
      return;
    }

    // Filter out completely empty spec rows
    const validSpecs = specs.filter((s) => s.key.trim() || s.value.trim());

    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      toast.error("Quantity must be a valid number greater than or equal to zero.");
      return;
    }

    const currentUser = getAuthUser();
    const authorName = item?.createdByName || currentUser?.fullName || currentUser?.email || "Admin";

    const payload = {
      name: name.trim(),
      code: code.trim(),
      categoryId: categoryId || item?.categoryId || null,
      photoUrl: photoUrl || null,
      specifications: validSpecs,
      quantity: parsedQuantity,
      minStock: Number(minStock) >= 0 ? Number(minStock) : 5,
      maxStock: Number(maxStock) >= 0 ? Number(maxStock) : 100,
      costPrice: Number(costPrice) >= 0 ? Number(costPrice) : 0,
      unit: unit || "Nos",
      warehouse: warehouse ? warehouse.trim() : null,
      location: location ? location.trim() : null,
      createdByName: authorName,
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

  const totalValuation = Number(quantity || 0) * Number(costPrice || 0);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/65 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-3xl bg-card border border-border/80 shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* ─── Premium Header Bar ───────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-[#142848] via-[#1e3a5f] to-[#254673] px-6 py-5 text-white flex items-center justify-between shadow-sm relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute right-0 top-0 w-96 h-full bg-white/5 blur-2xl pointer-events-none" />

          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shadow-inner">
              <Package className="h-6 w-6 stroke-[1.8]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight text-white font-display">
                  {item ? "Edit Product" : "Add New Product"}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/15 text-white/90 border border-white/20">
                  {item ? "Editing SKU" : "Inward Catalog"}
                </span>
              </div>
              <p className="text-xs text-white/75 mt-0.5 flex items-center gap-1.5">
                {categoryName ? (
                  <>
                    <span className="opacity-80">Category:</span>
                    <span className="font-semibold text-white bg-white/10 px-2 py-0.5 rounded-md">
                      {categoryName}
                    </span>
                  </>
                ) : (
                  <span>Configure product details, specifications, media, stock and valuation</span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-all cursor-pointer relative z-10 shrink-0"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ─── Modal Form Body ─────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top Notice Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-secondary/30 border border-border/70 rounded-2xl p-3 px-4 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground font-medium">
              <Info className="h-4 w-4 text-primary shrink-0" />
              <span>
                Enter product identification, technical specifications, storage rack, and initial stock.
              </span>
            </div>
            <div className="text-xs font-semibold text-muted-foreground shrink-0 flex items-center gap-1.5">
              <span>Required:</span>
              <span className="text-rose-500 font-bold">* Name, Code, Quantity</span>
            </div>
          </div>

          {/* ─── Creator Banner (Created By Print Name) ──────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-primary/5 border border-primary/20 rounded-2xl p-3 px-4 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-muted-foreground font-medium">Created by:</span>
                <span className="font-bold text-foreground bg-primary/15 text-primary px-2.5 py-0.5 rounded-full border border-primary/25">
                  {item?.createdByName || getAuthUser()?.fullName || getAuthUser()?.email || "Admin"}
                </span>
                {!item?.createdByName && item && (
                  <span className="text-[10px] text-muted-foreground italic">(Saved originally without author)</span>
                )}
              </div>
            </div>
            {lastUpdatedDisplay && (
              <div className="text-[11px] text-muted-foreground font-medium">
                Last modified: <span className="font-semibold text-foreground">{lastUpdatedDisplay}</span>
              </div>
            )}
          </div>

          {/* ─── Section 1: Basic Information ────────────────────────── */}
          <div className="bg-background rounded-2xl border border-border/80 p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border/60 pb-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Tag className="h-4 w-4" />
              </div>
              <h3 className="font-display text-sm font-bold text-foreground">
                Basic Identification
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. Heavy Duty Cable Ties 200mm"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Product Code / SKU */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-foreground">
                    Item Code / SKU <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    No <code className="font-bold text-rose-500 bg-rose-500/10 px-1 py-0.5 rounded">-</code> or <code className="font-bold text-rose-500 bg-rose-500/10 px-1 py-0.5 rounded">_</code> allowed
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                    <Barcode className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. CABTIE200"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
                    value={code}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "_") {
                        e.preventDefault();
                        toast.error("Hyphen (-) and underscore (_) characters are not allowed in Item Code.");
                      }
                    }}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (/[_\-]/.test(raw)) {
                        toast.error("Hyphen (-) and underscore (_) characters are not allowed in Item Code.");
                      }
                      setCode(raw.replace(/[_\-]/g, ""));
                    }}
                    required
                  />
                </div>
                {/[_\-]/.test(code) && (
                  <p className="text-[11px] text-rose-500 font-medium">
                    Item Code cannot contain hyphen (-) or underscore (_).
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ─── Section 2: Specifications (Left) & Photo (Right) ─────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left: 5 Specifications Builder (7 cols) */}
            <div className="lg:col-span-7 rounded-2xl border border-border/80 bg-background p-5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-bold text-foreground">
                        Technical Specifications
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Define custom technical parameters & specifications (No limit)
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {specs.length} {specs.length === 1 ? "Parameter" : "Parameters"}
                  </span>
                </div>

                {/* Quick Presets Chips */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
                    Presets:
                  </span>
                  {SPEC_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="px-2 py-0.5 rounded-md bg-secondary/80 hover:bg-primary/10 hover:text-primary text-[11px] font-medium text-muted-foreground border border-border/70 transition-colors cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>

                {/* Specification Rows */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {specs.map((spec, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-1.5 rounded-xl bg-secondary/25 hover:bg-secondary/50 border border-border/60 transition-colors"
                    >
                      {/* Row Badge */}
                      <span className="w-6 h-6 rounded-lg bg-background border border-border/80 text-[11px] font-bold text-muted-foreground flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>

                      {/* Key */}
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          placeholder={`Key ${index + 1} (e.g. Length)`}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-border/80 bg-background text-foreground placeholder:text-muted-foreground/60 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                          value={spec.key}
                          onChange={(e) =>
                            handleSpecChange(index, "key", e.target.value)
                          }
                        />
                      </div>

                      {/* Value */}
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          placeholder={`Value ${index + 1} (e.g. 200mm)`}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-border/80 bg-background text-foreground placeholder:text-muted-foreground/60 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                          value={spec.value}
                          onChange={(e) =>
                            handleSpecChange(index, "value", e.target.value)
                          }
                        />
                      </div>

                      {/* Delete / Clear Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteSpecRow(index)}
                        className="p-1 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                        title={specs.length > 1 ? "Remove this specification" : "Clear fields"}
                      >
                        {specs.length > 1 ? (
                          <Trash2 className="h-3.5 w-3.5" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Another Specification Button */}
                <button
                  type="button"
                  onClick={handleAddSpecRow}
                  className="mt-2.5 w-full py-2 px-3 rounded-xl border border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Another Specification</span>
                </button>
              </div>
            </div>

            {/* Right: Modern Photo Upload Box (5 cols) */}
            <div className="lg:col-span-5 rounded-2xl border border-border/80 bg-background p-5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-bold text-foreground">
                        Product Photo
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Select method to fetch product picture
                      </p>
                    </div>
                  </div>
                  {photoUrl && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <CheckCircle2 className="h-3 w-3" /> Attached
                    </span>
                  )}
                </div>

                {/* 2 Clear Options Selector */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {/* Option 1: Photo Upload */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-secondary/40 hover:bg-primary/10 hover:border-primary/40 text-foreground hover:text-primary text-xs font-semibold transition-all cursor-pointer shadow-2xs group"
                    title="Upload photo from device files"
                  >
                    <UploadCloud className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                    <span>1. Photo Upload</span>
                  </button>

                  {/* Option 2: Click by Camera */}
                  <button
                    type="button"
                    onClick={() => setIsCameraModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-secondary/40 hover:bg-emerald-500/10 hover:border-emerald-500/40 text-foreground hover:text-emerald-600 text-xs font-semibold transition-all cursor-pointer shadow-2xs group"
                    title="Click photo using webcam or mobile camera"
                  >
                    <Camera className="h-4 w-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                    <span>2. Click by Camera</span>
                  </button>
                </div>

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className={`group relative border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center min-h-[195px] transition-all ${
                    photoUrl
                      ? "border-emerald-500/40 bg-emerald-500/[0.02]"
                      : "border-border/80 hover:border-primary/60 hover:bg-secondary/40 bg-secondary/10"
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
                    <div className="flex flex-col items-center gap-2.5 py-6 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="text-xs font-semibold">Uploading high-res image...</span>
                    </div>
                  ) : photoUrl ? (
                    <div className="w-full h-full flex flex-col items-center">
                      <div className="w-full h-32 rounded-xl bg-secondary/30 border border-border/60 overflow-hidden flex items-center justify-center p-2 mb-3">
                        <img
                          src={resolveImageUrl(photoUrl)}
                          alt="Product preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-center">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition-colors cursor-pointer flex items-center gap-1"
                          title="Upload another photo file"
                        >
                          <UploadCloud className="h-3.5 w-3.5" /> Re-upload
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCameraModalOpen(true)}
                          className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition-colors cursor-pointer flex items-center gap-1"
                          title="Click new photo via camera"
                        >
                          <Camera className="h-3.5 w-3.5" /> Retake
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoUrl("");
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 text-xs font-semibold cursor-pointer flex items-center gap-1 border border-rose-500/20 transition-colors"
                          title="Remove attached photo"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-3 space-y-2 text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all cursor-pointer shadow-xs"
                          title="Option 1: Upload Photo from Device"
                        >
                          <UploadCloud className="h-6 w-6" />
                        </button>
                        <span className="text-xs font-bold text-muted-foreground/60">OR</span>
                        <button
                          type="button"
                          onClick={() => setIsCameraModalOpen(true)}
                          className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:border-emerald-500 transition-all cursor-pointer shadow-xs"
                          title="Option 2: Click Photo using Camera"
                        >
                          <Camera className="h-6 w-6" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-foreground">
                        Upload Photo or Click by Camera
                      </span>
                      <span className="text-xs text-muted-foreground max-w-[220px] leading-tight">
                        Drag & drop a file here, or use buttons above to choose source
                      </span>
                      <span className="text-[10px] text-muted-foreground/70 font-mono pt-0.5">
                        JPG, PNG, WEBP (Max 5MB)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ─── Section 3: Storage & Warehouse Location ─────────────── */}
          <div className="bg-background rounded-2xl border border-border/80 p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border/60 pb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
              <h3 className="font-display text-sm font-bold text-foreground">
                Warehouse & Storage Location
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Warehouse */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground">
                  Product Warehouse
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Main Warehouse, Store Room A"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
                    value={warehouse}
                    onChange={(e) => setWarehouse(e.target.value)}
                  />
                </div>
              </div>

              {/* Rack / Shelf / Bin Location */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground">
                  Rack / Shelf / Location
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Shelf B-4, Rack 12, Bin 03"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ─── Section 4: Stock Quantity, Min Box & Valuation Card ──── */}
          <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-secondary/40 via-background to-secondary/20 p-5 space-y-4 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Calculator className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground font-display">
                    Stock Quantity, Min Box & Valuation
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Manage inventory count, min box threshold, unit cost, and valuation
                  </p>
                </div>
              </div>
              {lastUpdatedDisplay && (
                <span className="text-[11px] text-muted-foreground bg-secondary/80 px-2.5 py-1 rounded-full font-medium border border-border">
                  Updated: {lastUpdatedDisplay}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
              {/* 1. Quantity & Unit Selection (3 cols) */}
              <div className="lg:col-span-3 space-y-1.5">
                <label className="block text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-primary" />
                  Quantity & Unit <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*[.]?[0-9]*"
                      placeholder="0"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs"
                      value={quantity}
                      onChange={(e) => {
                        const nextQuantity = e.target.value;
                        if (/^\d*\.?\d*$/.test(nextQuantity)) {
                          setQuantity(nextQuantity);
                        }
                      }}
                      aria-label="Product quantity"
                      required
                    />
                  </div>

                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer shadow-2xs shrink-0"
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

                  <button
                    type="button"
                    onClick={() => setIsUnitModalOpen(true)}
                    className="p-2.5 rounded-xl border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs"
                    title="Add custom unit"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 2. Min Box / Alert Stock Input (2 cols) */}
              <div className="lg:col-span-2 space-y-1.5">
                <label
                  className="block text-xs font-bold text-foreground flex items-center gap-1.5"
                  title="Minimum Stock Level / Box Threshold for Low Stock Alerts"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                  Min Alert Qty
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="5"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-500/30 bg-background text-foreground font-bold text-sm text-amber-700 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 shadow-2xs"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                  />
                </div>
              </div>

              {/* 2b. Max Item / Capacity Stock Input (2 cols) */}
              <div className="lg:col-span-2 space-y-1.5">
                <label
                  className="block text-xs font-bold text-foreground flex items-center gap-1.5"
                  title="Maximum Item Stock Level / Box Capacity"
                >
                  <Layers className="h-3.5 w-3.5 text-blue-500" />
                  Max Item Qty
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="100"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-blue-500/30 bg-background text-foreground font-bold text-sm text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 shadow-2xs"
                    value={maxStock}
                    onChange={(e) => setMaxStock(e.target.value)}
                  />
                </div>
              </div>

              {/* 3. Unit Price Input (2 cols) */}
              <div className="lg:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold text-foreground flex items-center gap-1.5">
                  <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />
                  Price per Item (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400 font-bold text-xs pointer-events-none">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-emerald-500/30 bg-background text-foreground font-bold text-sm text-emerald-700 dark:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-2xs"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                </div>
              </div>

              {/* 4. Live Calculated Total Price Card (3 cols) */}
              <div className="lg:col-span-3 space-y-1.5">
                <label className="block text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5 text-emerald-600" />
                  Total Valuation
                </label>
                <div className="px-3.5 py-2 rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-teal-500/15 flex items-center justify-between text-emerald-800 dark:text-emerald-300 shadow-2xs min-h-[42px]">
                  <div>
                    <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 block leading-tight font-display">
                      ₹{totalValuation.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium block truncate">
                      ₹{Number(costPrice || 0).toLocaleString("en-IN")} / {unit} • {quantity || 0} {unit}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-[9px] font-bold uppercase tracking-wider">
                    Total
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Modal Footer Actions ─────────────────────────────────── */}
          <div className="flex items-center justify-between pt-4 border-t border-border flex-wrap gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline-block">
              Press <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] font-mono">Esc</kbd> anytime to discard changes.
            </span>

            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-6 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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

      {/* Camera Live Viewfinder & Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={(capturedFile) => {
          handleFileUpload(capturedFile);
        }}
      />
    </div>
  );
};

export default ItemCardModal;
