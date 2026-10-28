import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Package, X, UploadCloud, Loader2, Plus, Image as ImageIcon, Trash2, Check,
  IndianRupee, Calculator, Hash, ShieldAlert, Tag, Barcode, Building2, MapPin,
  Sparkles, Layers, Info, CheckCircle2, Camera, User, Eye
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
  const baseUrl = import.meta.env.VITE_API_URL || (window.location.hostname === "localhost" ? "http://localhost:4000" : "https://api.techwareautomation.in");
  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
};

const formatTimestamp = (d) => {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const timeStr = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${day}/${month}/${year} ${timeStr}`;
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
  const [sellingPrice, setSellingPrice] = useState("");
  const [unit, setUnit] = useState("Nos");
  const [warehouse, setWarehouse] = useState("Main Warehouse");
  const [location, setLocation] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [unitsList, setUnitsList] = useState([]);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isImageViewOpen, setIsImageViewOpen] = useState(false);
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

  const [isRestoredDraft, setIsRestoredDraft] = useState(false);
  const currentUser = getAuthUser();
  const currentUserId = currentUser?.id || "anon";
  const DRAFT_STORAGE_KEY = `autocard_item_draft_${currentUserId}_${categoryId || "root"}`;

  // Helper to clear draft from localStorage
  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      localStorage.removeItem(`autocard_item_draft_${currentUserId}_root`);
      localStorage.removeItem(`autocard_item_draft_${categoryId || "root"}`);
      localStorage.removeItem("autocard_item_draft_root");
    } catch {}
    setIsRestoredDraft(false);
  };

  // Populate form if editing, or restore auto-saved draft if adding new
  useEffect(() => {
    if (!isOpen) return;

    if (item) {
      // Editing existing item - always use item data
      setName(item.name || "");
      setCode(item.code || item.sku || "");
      setPhotoUrl(item.photoUrl || item.img || "");
      setQuantity(item.quantity ?? 1);
      setMinStock(item.minStock ?? 5);
      setMaxStock(item.maxStock ?? 100);
      setCostPrice(item.costPrice ?? 0);
      setSellingPrice(item.sellingPrice ?? "");
      setUnit(item.unit || "Nos");
      setWarehouse(item.warehouse || "Main Warehouse");
      setLocation(item.location || "");
      setCompanyName(item.companyName || "");
      setVendorName(item.vendorName || "");

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
      setIsRestoredDraft(false);
    } else {
      // Adding new item - check for previously auto-saved draft
      let draftData = null;
      try {
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY) || localStorage.getItem("autocard_item_draft_root");
        if (raw) {
          draftData = JSON.parse(raw);
        }
      } catch {}

      if (draftData && (draftData.name || draftData.code || draftData.companyName || draftData.vendorName || draftData.location || draftData.photoUrl)) {
        setName(draftData.name || "");
        setCode(draftData.code || "");
        setPhotoUrl(draftData.photoUrl || "");
        setQuantity(draftData.quantity ?? 1);
        setMinStock(draftData.minStock ?? 5);
        setMaxStock(draftData.maxStock ?? 100);
        setCostPrice(draftData.costPrice ?? 0);
        setSellingPrice(draftData.sellingPrice ?? "");
        setUnit(draftData.unit || "Nos");
        setWarehouse(draftData.warehouse || "Main Warehouse");
        setLocation(draftData.location || "");
        setCompanyName(draftData.companyName || "");
        setVendorName(draftData.vendorName || "");
        setSpecs(Array.isArray(draftData.specs) && draftData.specs.length > 0 ? draftData.specs : [
          { key: "", value: "" },
          { key: "", value: "" },
        ]);
        setIsRestoredDraft(true);
      } else {
        // Fresh blank form
        setName("");
        setCode("");
        setPhotoUrl("");
        setQuantity(1);
        setMinStock(5);
        setMaxStock(100);
        setCostPrice(0);
        setSellingPrice("");
        setUnit("Nos");
        setWarehouse("Main Warehouse");
        setLocation("");
        setCompanyName("");
        setVendorName("");
        setSpecs([
          { key: "", value: "" },
          { key: "", value: "" },
        ]);
        setIsRestoredDraft(false);
      }
    }
  }, [item, isOpen, categoryId]);

  // Auto-save draft whenever user changes fields (only for new item creations)
  useEffect(() => {
    if (!isOpen || item) return;

    // Check if there is any user-entered content
    const hasContent = Boolean(
      name.trim() ||
      code.trim() ||
      photoUrl ||
      companyName.trim() ||
      vendorName.trim() ||
      location.trim() ||
      specs.some((s) => s.key.trim() || s.value.trim())
    );

    if (!hasContent) {
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}
      return;
    }

    const draft = {
      name,
      code,
      photoUrl,
      quantity,
      minStock,
      maxStock,
      costPrice,
      sellingPrice,
      unit,
      warehouse,
      location,
      companyName,
      vendorName,
      specs,
      savedAt: Date.now(),
    };

    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {}
  }, [isOpen, item, name, code, photoUrl, quantity, minStock, maxStock, costPrice, sellingPrice, unit, warehouse, location, companyName, vendorName, specs, DRAFT_STORAGE_KEY]);

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

  // Compress an image file or Base64 string to a lightweight Base64 Data URI
  const compressImageToBase64 = (imageInput, maxWidth = 900, maxHeight = 900, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Unable to create canvas rendering context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress as JPEG
        const base64Data = canvas.toDataURL("image/jpeg", quality);
        resolve(base64Data);
      };

      img.onerror = (err) => reject(err);

      if (typeof imageInput === "string") {
        img.src = imageInput;
      } else if (imageInput instanceof Blob || imageInput instanceof File) {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(imageInput);
      } else {
        reject(new Error("Unsupported image format"));
      }
    });
  };

  const handleFileUpload = async (fileOrDataUrl) => {
    if (!fileOrDataUrl) return;

    setUploadingPhoto(true);
    try {
      let fileToUpload = fileOrDataUrl;

      // If it's a data URL (e.g. from camera), convert it to a File object
      if (typeof fileOrDataUrl === "string" && fileOrDataUrl.startsWith("data:")) {
        const res = await fetch(fileOrDataUrl);
        const blob = await res.blob();
        fileToUpload = new File([blob], `camera_snap_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
      }

      if (fileToUpload.type && !fileToUpload.type.match(/^image\/(jpeg|png|jpg|webp)$/i)) {
        toast.error("Please upload a valid image file (JPG, PNG or WEBP).");
        return;
      }

      if (fileToUpload.size > 10 * 1024 * 1024) {
        toast.error("Image file size should be less than 10MB.");
        return;
      }

      const formData = new FormData();
      formData.append("photo", fileToUpload);

      const res = await apiUpload("/inventory/upload", formData);
      const uploaded = res?.photoUrl || res?.url || res?.img;
      if (uploaded) {
        setPhotoUrl(uploaded);
        toast.success("Photo uploaded to Hostinger server successfully!");
      } else {
        toast.error("Upload succeeded but no photo URL was returned.");
      }
    } catch (err) {
      console.error("Photo upload error:", err);
      toast.error(err.message || "Failed to upload photo to server.");
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

    // Disallow special characters like . , - @ # ! $ % ^ & * ( ) + = [ ] { } ; : ' " < > ? / \ | ` ~
    if (/[^a-zA-Z0-9\s]/.test(name.trim())) {
      toast.error("Special characters (.-,@# etc.) are not allowed in Item / Product Name. Only letters, numbers and spaces are permitted.");
      return;
    }

    if (!code.trim()) {
      toast.error("Item Code is mandatory and must be filled.");
      return;
    }

    if (/[^a-zA-Z0-9\s]/.test(code.trim())) {
      toast.error("Item Code / SKU cannot contain special characters (.-,@# etc.). Only letters and numbers are allowed.");
      return;
    }

    // Filter out completely empty spec rows
    const validSpecs = specs.filter((s) => s.key.trim() || s.value.trim());

    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      toast.error("Quantity must be a valid number greater than or equal to zero.");
      return;
    }

    const authorName = item?.createdByName || currentUser?.fullName || currentUser?.email || "";
    const authorId = currentUser?.id || null;

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
      sellingPrice: sellingPrice !== "" && Number(sellingPrice) >= 0 ? Number(sellingPrice) : null,
      unit: unit || "Nos",
      warehouse: warehouse ? warehouse.trim() : null,
      location: location ? location.trim() : null,
      companyName: companyName ? companyName.trim() : null,
      vendorName: vendorName ? vendorName.trim() : null,
      createdByName: authorName,
      createdById: authorId,
    };

    setSubmitting(true);
    try {
      if (item?.id) {
        const updateRes = await apiPut(`/inventory/items/${item.id}`, payload);
        toast.success("Item updated successfully!");
        if (onSuccess) {
          onSuccess(updateRes?.item);
        }
      } else {
        const createRes = await apiPost("/inventory/items", payload);
        toast.success("Item added successfully!");
        clearDraft();
        if (onSuccess) {
          onSuccess(createRes?.item);
        }
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

  if (!isOpen) return null;

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[99999] flex justify-end bg-black/65 backdrop-blur-xs transition-opacity duration-300"
      style={{ isolation: "isolate" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl h-full bg-card border-l border-border/80 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 ease-out relative z-[100000]"
      >
        {/* ─── Premium Header Bar ───────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-[#142848] via-[#1e3a5f] to-[#254673] px-4 sm:px-6 py-3.5 sm:py-4 text-white flex items-center justify-between shadow-sm relative overflow-hidden shrink-0">
          {/* Subtle background glow */}
          <div className="absolute right-0 top-0 w-96 h-full bg-white/5 blur-2xl pointer-events-none" />

          <div className="flex items-center gap-3 relative z-10 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shadow-inner shrink-0">
              <Package className="h-5 w-5 stroke-[1.8]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white font-display truncate">
                  {item ? "Edit Product" : "Add New Product"}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-white/15 text-white/90 border border-white/20">
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
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 min-h-0">
            {/* Top Notice Bar with Auto-Save Indicator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-secondary/30 border border-border/70 rounded-2xl p-2.5 sm:p-3 px-3.5 sm:px-4 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground font-medium flex-wrap">
                <Info className="h-4 w-4 text-primary shrink-0" />
                <span className="leading-tight">
                  Enter product identification, technical specifications, storage rack, and initial stock.
                </span>
                {!item && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" /> Auto-Save Active
                  </span>
                )}
                {isRestoredDraft && !item && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    <span>Draft Restored</span>
                    <button
                      type="button"
                      onClick={() => {
                        clearDraft();
                        setName("");
                        setCode("");
                        setPhotoUrl("");
                        setQuantity(1);
                        setMinStock(5);
                        setMaxStock(100);
                        setCostPrice(0);
                        setSellingPrice("");
                        setUnit("Nos");
                        setWarehouse("Main Warehouse");
                        setLocation("");
                        setCompanyName("");
                        setVendorName("");
                        setSpecs([
                          { key: "", value: "" },
                          { key: "", value: "" },
                        ]);
                        toast.info("Draft discarded.");
                      }}
                      className="underline text-amber-700 dark:text-amber-300 hover:text-foreground cursor-pointer font-normal"
                    >
                      Clear
                    </button>
                  </span>
                )}
              </div>
              <div className="text-xs font-semibold text-muted-foreground shrink-0 flex items-center gap-1.5">
                <span>Required:</span>
                <span className="text-rose-500 font-bold">* Name, Code, Quantity</span>
              </div>
            </div>

            {/* ─── Creator Banner (Created By Print Name) ──────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-primary/5 border border-primary/20 rounded-2xl p-2.5 sm:p-3 px-3.5 sm:px-4 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-muted-foreground font-medium">Created by:</span>
                  <span className="font-bold text-foreground bg-primary/15 text-primary px-2.5 py-0.5 rounded-full border border-primary/25">
                    {item?.createdByName || getAuthUser()?.fullName || getAuthUser()?.email || "Admin"}
                  </span>
                  {item?.updatedByName && (
                    <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/25 ml-1">
                      ✏️ Edited by: {item.updatedByName}
                    </span>
                  )}
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
            <div className="bg-background rounded-2xl border border-border/80 p-4 sm:p-5 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 border-b border-border/60 pb-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Tag className="h-4 w-4" />
                </div>
                <h3 className="font-display text-sm font-bold text-foreground">
                  Basic Identification
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                {/* Product Name */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-foreground">
                      Product Name <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      No special characters <code className="font-bold text-rose-500 bg-rose-500/10 px-1 py-0.5 rounded">.-,@#</code>
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. Heavy Duty Cable Ties 200mm"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
                      value={name}
                      onKeyDown={(e) => {
                        if (e.key.length === 1 && /[^a-zA-Z0-9\s]/.test(e.key)) {
                          e.preventDefault();
                          toast.error(`Special character "${e.key}" is not allowed in Product Name.`);
                        }
                      }}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (/[^a-zA-Z0-9\s]/.test(raw)) {
                          toast.error("Special characters (.-,@# etc.) are not allowed in Product Name.");
                        }
                        setName(raw.replace(/[^a-zA-Z0-9\s]/g, ""));
                      }}
                      required
                    />
                  </div>
                  {/[^a-zA-Z0-9\s]/.test(name) && (
                    <p className="text-[11px] text-rose-500 font-medium">
                      Special characters are not allowed in Product Name.
                    </p>
                  )}
                </div>

                {/* Product Code / SKU */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-foreground">
                      Item Code / SKU <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Only letters & numbers
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
                        if (e.key.length === 1 && /[^a-zA-Z0-9.,]/.test(e.key)) {
                          e.preventDefault();
                          toast.error(`Special character "${e.key}" is not allowed in Item Code (only dot and comma are allowed).`);
                        }
                      }}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (/[^a-zA-Z0-9.,]/.test(raw)) {
                          toast.error("Special characters are not allowed in Item Code (only dot and comma are allowed).");
                        }
                        setCode(raw.replace(/[^a-zA-Z0-9.,]/g, ""));
                      }}
                      required
                    />
                  </div>
                  {/[^a-zA-Z0-9.,]/.test(code) && (
                    <p className="text-[11px] text-rose-500 font-medium">
                      Item Code can only contain letters, numbers, dots (.) and commas (,).
                    </p>
                  )}
                </div>

              {/* Company Name / Brand Name */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-foreground">
                    Company Name / Brand Name
                  </label>
                  <span className="text-[10px] text-muted-foreground/70 font-medium">
                    (Optional)
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Bosch / Siemens / Techware Automation (Optional)"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
              </div>

              {/* Vendor / Supplier Name */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-foreground">
                    Vendor Name
                  </label>
                  <span className="text-[10px] text-muted-foreground/70 font-medium">
                    (Optional)
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. ABC Electricals / Fastener Supplier (Optional)"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ─── Section 2: Specifications (Left) & Photo (Right) ─────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
            {/* Left: Specifications Builder (7 cols) */}
            <div className="lg:col-span-7 rounded-2xl border border-border/80 bg-background p-4 sm:p-5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5 mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
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
            <div className="lg:col-span-5 rounded-2xl border border-border/80 bg-background p-4 sm:p-5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5 mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
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
                  {/* Generic File Input */}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsImageViewOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold border border-primary/20 transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                          title="View image full size"
                        >
                          <Eye className="h-3.5 w-3.5" /> View Img
                        </button>
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
          <div className="bg-background rounded-2xl border border-border/80 p-4 sm:p-5 space-y-3.5 sm:space-y-4 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4" />
              </div>
              <h3 className="font-display text-sm font-bold text-foreground">
                Warehouse & Storage Location
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
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
          <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-secondary/40 via-background to-secondary/20 p-4 sm:p-5 space-y-3.5 sm:space-y-4 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-3.5 sm:gap-4 items-end">
              {/* 1. Quantity & Unit Selection */}
              <div className="sm:col-span-2 md:col-span-3 lg:col-span-3 space-y-1.5">
                <label className="block text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-primary" />
                  Quantity & Unit <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*[.]?[0-9]*"
                      placeholder="0"
                      className="w-full px-3 py-2 sm:py-2.5 rounded-xl border border-border bg-background text-foreground font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs"
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
                    className="px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl border border-border bg-background text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer shadow-2xs shrink-0 max-w-[90px]"
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
                    className="p-2 sm:p-2.5 rounded-xl border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs"
                    title="Add custom unit"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 2. Min Box / Alert Stock Input */}
              <div className="sm:col-span-1 md:col-span-3 lg:col-span-2 space-y-1.5">
                <label
                  className="block text-xs font-bold text-foreground flex items-center gap-1.5 truncate"
                  title="Minimum Stock Level / Box Threshold for Low Stock Alerts"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  Min Alert Qty
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="5"
                    className="w-full px-3 py-2 sm:py-2.5 rounded-xl border border-amber-500/30 bg-background text-foreground font-bold text-sm text-amber-700 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 shadow-2xs"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                  />
                </div>
              </div>

              {/* 2b. Max Item / Capacity Stock Input */}
              <div className="sm:col-span-1 md:col-span-3 lg:col-span-2 space-y-1.5">
                <label
                  className="block text-xs font-bold text-foreground flex items-center gap-1.5 truncate"
                  title="Maximum Item Stock Level / Box Capacity"
                >
                  <Layers className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  Max Item Qty
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="100"
                    className="w-full px-3 py-2 sm:py-2.5 rounded-xl border border-blue-500/30 bg-background text-foreground font-bold text-sm text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 shadow-2xs"
                    value={maxStock}
                    onChange={(e) => setMaxStock(e.target.value)}
                  />
                </div>
              </div>

              {/* 3. Cost Price Input */}
              <div className="sm:col-span-1 md:col-span-3 lg:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-foreground flex items-center gap-1 truncate">
                    <IndianRupee className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    Price (₹)
                  </label>
                  <span className="text-[10px] text-muted-foreground/70 font-medium">
                    (Cost)
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400 font-bold text-xs pointer-events-none">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 sm:py-2.5 rounded-xl border border-emerald-500/30 bg-background text-foreground font-bold text-sm text-emerald-700 dark:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-2xs"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                </div>
              </div>

              {/* 4. Selling Price Input (Optional) */}
              <div className="sm:col-span-1 md:col-span-3 lg:col-span-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-foreground flex items-center gap-1 truncate">
                    <IndianRupee className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                    Selling Price (₹)
                  </label>
                  <span className="text-[10px] text-muted-foreground/70 font-medium">
                    (Optional)
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-600 dark:text-teal-400 font-bold text-xs pointer-events-none">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00 (Optional)"
                    className="w-full pl-7 pr-3 py-2 sm:py-2.5 rounded-xl border border-teal-500/30 bg-background text-foreground font-bold text-sm text-teal-700 dark:text-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 shadow-2xs"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Total Valuation Card Banner */}
            <div className="mt-4 p-3 sm:p-3.5 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Calculator className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>Total Stock Valuation:</span>
                    <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-display">
                      ₹{totalValuation.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Based on ₹{Number(costPrice || 0).toLocaleString("en-IN")} per {unit} × {quantity || 0} {unit}
                    {sellingPrice !== "" && Number(sellingPrice) > 0 && (
                      <span className="ml-2 text-teal-600 dark:text-teal-400 font-medium">
                        • Selling Value: ₹{(Number(quantity || 0) * Number(sellingPrice)).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                Live Calculation
              </span>
            </div>
          </div>
        </div>

          {/* ─── Sticky Modal Footer Actions ───────────────────────────── */}
          <div className="bg-card/95 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-3.5 border-t border-border flex items-center justify-between gap-3 shrink-0 shadow-lg">
            <span className="text-xs text-muted-foreground hidden sm:inline-block">
              Press <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] font-mono">Esc</kbd> anytime to discard changes.
            </span>

            <div className="flex items-center gap-2.5 sm:gap-3 ml-auto w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-xl border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-semibold px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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

      {/* Full Image View Modal */}
      {isImageViewOpen && photoUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
            style={{ isolation: "isolate" }}
            onClick={() => setIsImageViewOpen(false)}
          >
            <div
              className="relative max-w-4xl max-h-[90vh] w-full bg-card border border-border/80 rounded-3xl shadow-2xl p-4 sm:p-6 overflow-hidden flex flex-col items-center z-[10000000]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full flex items-center justify-between pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  <span className="text-sm sm:text-base font-bold text-foreground">
                    {name ? `${name} - Item Photo` : "Item Photo Preview"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsImageViewOpen(false)}
                  className="w-8 h-8 rounded-full bg-secondary/80 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 max-h-[72vh] w-full overflow-auto flex items-center justify-center bg-black/10 rounded-2xl p-2 border border-border/40">
                <img
                  src={resolveImageUrl(photoUrl)}
                  alt={name || "Product image"}
                  className="max-h-[68vh] w-auto max-w-full object-contain rounded-xl shadow-md"
                />
              </div>
              <div className="w-full mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsImageViewOpen(false)}
                  className="px-5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Camera Live Viewfinder & Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={(capturedFile) => {
          handleFileUpload(capturedFile);
        }}
      />
    </div>,
    document.body
  );
};

export default ItemCardModal;
