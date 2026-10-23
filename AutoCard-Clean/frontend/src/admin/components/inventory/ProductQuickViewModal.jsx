import { useState } from "react";
import {
  X, Package, Tag, Layers, MapPin, IndianRupee, ShieldAlert,
  Calendar, Clock, ZoomIn, ZoomOut, RotateCw, User, ExternalLink,
  Edit3, Boxes
} from "lucide-react";

export const resolveImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const baseUrl = import.meta.env.VITE_API_URL || (window.location.hostname === "localhost" ? "http://localhost:4000" : "https://api.techwareautomation.in");
  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
};

const fmtDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const mins = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${mins}`;
};

export default function ProductQuickViewModal({
  isOpen,
  onClose,
  item,
  onEdit,
}) {
  const [imageError, setImageError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  if (!isOpen || !item) return null;

  const specsArr = Array.isArray(item.specifications)
    ? item.specifications
    : item.specifications && typeof item.specifications === "object"
    ? Object.entries(item.specifications).map(([k, v]) => ({ key: k, value: v }))
    : [];

  const qty = Number(item.quantity || 0);
  const minStock = Number(item.minStock || 5);
  const cost = Number(item.costPrice || 0);
  const totalValuation = qty * cost;
  const isLowStock = qty <= minStock;
  const photoSrc = resolveImageUrl(item.photoUrl || item.img);

  // Resolve category hierarchy chain
  const categoryChain = [];
  let currCat = item.categoryRef;
  let catDepth = 0;
  while (currCat && catDepth < 6) {
    categoryChain.unshift({
      id: currCat.id,
      name: currCat.name,
      level: currCat.level || 1,
    });
    currCat = currCat.parent;
    catDepth++;
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-3xl bg-card border border-border/80 shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-[#142848] via-[#1e3a5f] to-[#254673] px-6 py-4 text-white flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-white">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Product Details & Photo View
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/15 text-white/90 border border-white/20">
                  SKU Inspection
                </span>
              </div>
              <p className="text-xs text-white/70">
                Full visual catalog view and specifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(item);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors cursor-pointer border border-white/20"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit Product</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-all cursor-pointer"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Main Photo & Identification Card */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            {/* Photo Box (Col 5) */}
            <div className="md:col-span-5 flex flex-col items-center">
              <div
                onClick={() => photoSrc && !imageError && setIsZoomed(!isZoomed)}
                className={`w-full rounded-2xl bg-secondary/30 border border-border/80 overflow-hidden flex items-center justify-center relative group transition-all ${
                  photoSrc && !imageError ? "cursor-zoom-in" : ""
                } ${isZoomed ? "h-72" : "h-56"}`}
              >
                {photoSrc && !imageError ? (
                  <>
                    <img
                      src={photoSrc}
                      alt={item.name}
                      onError={() => setImageError(true)}
                      className={`w-full h-full object-contain p-2 transition-transform duration-300 ${
                        isZoomed ? "scale-125" : "group-hover:scale-105"
                      }`}
                    />
                    <div className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] font-medium flex items-center gap-1 backdrop-blur-xs opacity-80 group-hover:opacity-100 transition-opacity">
                      <ZoomIn className="h-3 w-3" />
                      <span>{isZoomed ? "Click to shrink" : "Click to zoom"}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground/60 p-6 text-center">
                    <Package className="h-16 w-16 stroke-[1.2] mb-2" />
                    <span className="text-xs font-semibold">No Image Available</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      Photo has not been uploaded yet
                    </span>
                  </div>
                )}
              </div>

              {photoSrc && !imageError && (
                <a
                  href={photoSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Open Original Full-Res Image</span>
                </a>
              )}
            </div>

            {/* Identification & Meta Details (Col 7) */}
            <div className="md:col-span-7 space-y-3.5">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      qty === 0
                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                        : isLowStock
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                    }`}
                  >
                    {qty === 0 ? "Out of Stock" : isLowStock ? "Low Stock Alert" : "In Stock"}
                  </span>
                  {/* Hierarchy Visual Diagram matching Level 1 -> Level 2 -> Level 3 -> Level 4 */}
                  {categoryChain.length > 0 ? (
                    <div className="w-full my-2 p-3 rounded-2xl bg-secondary/30 border border-primary/20">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground mb-2">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        <span>Category Hierarchy Structure (Level 1 to Level 4)</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap overflow-x-auto py-1">
                        {categoryChain.map((node, cIdx) => {
                          const lvl = node.level || cIdx + 1;
                          const styles = {
                            1: "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-blue-500/20",
                            2: "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-indigo-500/20",
                            3: "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 ring-amber-500/20",
                            4: "border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 ring-rose-500/20",
                          };
                          return (
                            <div key={node.id || cIdx} className="flex items-center gap-1.5 shrink-0">
                              {cIdx > 0 && (
                                <div className="flex flex-col items-center justify-center text-muted-foreground/60 px-0.5">
                                  <span className="text-xs font-bold leading-none">→</span>
                                </div>
                              )}
                              <div
                                className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border-2 shadow-xs transition-all ${
                                  styles[lvl] || styles[1]
                                }`}
                              >
                                <span className="text-[9px] uppercase tracking-wider font-extrabold opacity-75">
                                  Level {lvl}
                                </span>
                                <span className="text-xs font-bold text-center truncate max-w-[120px]">
                                  {node.name}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : item.category ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary text-foreground border border-border">
                      {item.category}
                    </span>
                  ) : (
                    <div className="w-full my-1.5 p-2 rounded-xl bg-secondary/20 border border-border text-[11px] text-muted-foreground italic flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      <span>Direct Item (No Parent Category Assigned)</span>
                    </div>
                  )}
                </div>

                <h3 className="font-display text-xl font-bold text-foreground">
                  {item.name}
                </h3>

                {(item.code || item.sku) && (
                  <p className="font-mono text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    <span className="font-semibold text-foreground">Code / SKU:</span>{" "}
                    {item.code || item.sku}
                  </p>
                )}
              </div>

              {/* Created By Banner (Prominent Print Name) */}
              <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground font-medium block">
                    Created By
                  </span>
                  <span className="text-sm font-bold text-primary">
                    {item.createdByName || "Admin"}
                  </span>
                </div>
              </div>

              {/* Stock Levels & Capacity Card */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-secondary/30 border border-border text-center">
                <div>
                  <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Current Stock</span>
                  <span className="text-sm font-bold text-foreground">{qty} {item.unit || "Nos"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block uppercase">Min Alert</span>
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{minStock} {item.unit || "Nos"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold block uppercase">Max Item</span>
                  <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{item.maxStock ?? 100} {item.unit || "Nos"}</span>
                </div>
              </div>

              {/* Price & Valuation Card */}
              <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-2xl bg-secondary/20 border border-border">
                <div>
                  <span className="text-[11px] text-muted-foreground font-medium block">
                    Price per Item
                  </span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                    <span>₹{cost.toLocaleString("en-IN")}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      / {item.unit || "Nos"}
                    </span>
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground font-medium block">
                    Total Valuation ({qty} {item.unit || "Nos"})
                  </span>
                  <span className="text-base font-bold text-foreground">
                    ₹{totalValuation.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Storage & Timestamps */}
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 p-2 rounded-xl bg-background border border-border">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">
                    {[item.warehouse, item.location].filter(Boolean).join(" • ") || "No location assigned"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 p-2 rounded-xl bg-background border border-border">
                  <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">
                    {fmtDate(item.updatedAt || item.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Specifications Section */}
          <div className="bg-background rounded-2xl border border-border/80 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <h4 className="font-display text-sm font-bold text-foreground">
                  Technical Specifications
                </h4>
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">
                {specsArr.length} parameter{specsArr.length === 1 ? "" : "s"} defined
              </span>
            </div>

            {specsArr.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 italic">
                No specific technical parameters defined for this item.
              </p>
            ) : (
              <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/40 text-xs">
                {specsArr.map((sp, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 py-2 px-3 hover:bg-secondary/20 transition-colors"
                  >
                    <span className="col-span-5 font-semibold text-muted-foreground">
                      {sp.key}
                    </span>
                    <span className="col-span-7 font-mono font-medium text-foreground">
                      {String(sp.value || "—")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-border bg-secondary/15 flex items-center justify-end text-xs text-muted-foreground">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
