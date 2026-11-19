import { useState, useEffect, useMemo } from "react";
import { exportStyledExcelWithLogo } from "../../../lib/excelExportHelper.js";
import {
  Bell,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Search,
  RefreshCw,
  ArrowLeft,
  Package,
  Sliders,
  Edit3,
  Plus,
  Tag,
  MapPin,
  X,
  Layers,
  Save,
  Download,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPut } from "../../../lib/api.js";
import { canPerformAction } from "../../../lib/permissions.js";

export default function InventoryAlertView({ onBackToHub }) {
  const canEdit = canPerformAction("inventory-alert", "edit");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [alertFilter, setAlertFilter] = useState("ALL_ALERTS"); // "ALL_ALERTS", "OUT_OF_STOCK", "LOW_STOCK", "HEALTHY"

  // Helper to format exact warehouse and rack/shelf location
  const getExactLocation = (item) => {
    const w = (item?.warehouse || "").trim();
    const l = (item?.location || "").trim();
    if (w && l) return `${w} (${l})`;
    if (l) return l;
    if (w) return w;
    return "—";
  };

  // ─── Category Hierarchy (Root 1, 2, 3, 4) Resolver ──────────────────────
  const getItemRoots = (item) => {
    let r1 = "—";
    let r2 = "—";
    let r3 = "—";
    let r4 = "—";

    let curr = item?.categoryRef;
    if (!curr) {
      if (item?.category && typeof item.category === "string" && item.category.trim()) {
        r1 = item.category.trim();
      }
      return { r1, r2, r3, r4 };
    }

    const chain = [];
    const visited = new Set();
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      chain.unshift(curr);
      curr = curr.parent;
    }

    if (chain.length > 0) r1 = chain[0]?.name || "—";
    if (chain.length > 1) r2 = chain[1]?.name || "—";
    if (chain.length > 2) r3 = chain[2]?.name || "—";
    if (chain.length > 3) r4 = chain[3]?.name || "—";

    return { r1, r2, r3, r4 };
  };

  // ─── Export to Excel (.xlsx with Logo & Root Tabs) ──────────────────────
  const handleExportAlertExcel = async () => {
    if (!filteredItems || filteredItems.length === 0) {
      toast.error("No items available to export for the selected filter.");
      return;
    }

    const filterLabels = {
      ALL_ALERTS: "All Active Stock Alerts (Out of Stock & Low Stock)",
      OUT_OF_STOCK: "Out of Stock Items (Zero Stock)",
      LOW_STOCK: "Low Stock Warning Items",
      HEALTHY: "Healthy Stock Inventory",
    };
    const reportTitle = filterLabels[alertFilter] || "Inventory Stock Alert Report";
    const totalUnits = filteredItems.reduce((acc, i) => acc + Number(i.quantity || 0), 0);

    const headers = [
      "S.No",
      "Root 1",
      "Root 2",
      "Root 3",
      "Root 4",
      "Item Name",
      "SKU / Code",
      "Quantity",
      "Min Stock",
      "Status",
      "Location",
    ];

    const colWidths = [8, 22, 22, 22, 22, 34, 18, 14, 14, 16, 22];
    const rightAlignCols = [8, 9];
    const centerAlignCols = [1, 10];

    // Group filtered items by Root 1
    const groupedByRoot1 = new Map();
    filteredItems.forEach((item) => {
      const roots = getItemRoots(item);
      const r1Key = roots.r1 || "Unassigned";
      if (!groupedByRoot1.has(r1Key)) {
        groupedByRoot1.set(r1Key, []);
      }
      groupedByRoot1.get(r1Key).push({ item, roots });
    });

    const getItemStatus = (qty, minS) => {
      if (qty === 0) return "OUT OF STOCK";
      if (qty <= minS) return "LOW STOCK";
      return "HEALTHY";
    };

    // Master sheet with all filtered items
    const masterRows = filteredItems.map((item, idx) => {
      const roots = getItemRoots(item);
      const qty = Number(item.quantity || 0);
      const minS = Number(item.minStock || 5);
      return [
        idx + 1,
        roots.r1,
        roots.r2,
        roots.r3,
        roots.r4,
        item.name || "—",
        item.code || item.sku || "—",
        qty,
        minS,
        getItemStatus(qty, minS),
        getExactLocation(item),
      ];
    });

    const masterSubtotal = [
      "",
      "",
      "",
      "",
      "",
      "",
      "TOTAL QUANTITY:",
      totalUnits,
      "",
      "",
      "",
    ];

    const sheets = [
      {
        name: "Master Alerts",
        title: `Techware Automation — ${reportTitle}`,
        subtitle: `Filter: ${alertFilter}  |  Total Alerts: ${filteredItems.length} SKUs  |  Total Units: ${totalUnits}`,
        headers,
        rows: masterRows,
        subtotalRow: masterSubtotal,
        colWidths,
        rightAlignCols,
        centerAlignCols,
      },
    ];

    // Individual Root Level 1 tabs
    groupedByRoot1.forEach((entries, r1Name) => {
      const catRows = entries.map(({ item, roots }, idx) => {
        const qty = Number(item.quantity || 0);
        const minS = Number(item.minStock || 5);
        return [
          idx + 1,
          roots.r1,
          roots.r2,
          roots.r3,
          roots.r4,
          item.name || "—",
          item.code || item.sku || "—",
          qty,
          minS,
          getItemStatus(qty, minS),
          getExactLocation(item),
        ];
      });

      const catUnits = entries.reduce((acc, { item }) => acc + Number(item.quantity || 0), 0);
      const catSubtotal = [
        "",
        "",
        "",
        "",
        "",
        "",
        `SUBTOTAL (${r1Name}):`,
        catUnits,
        "",
        "",
        "",
      ];

      sheets.push({
        name: r1Name,
        title: `Stock Alerts: ${r1Name}`,
        subtitle: `Category: ${r1Name}  |  Filter: ${alertFilter}  |  Total SKUs: ${entries.length}  |  Units: ${catUnits}`,
        headers,
        rows: catRows,
        subtotalRow: catSubtotal,
        colWidths,
        rightAlignCols,
        centerAlignCols,
      });
    });

    try {
      const filterTag = alertFilter.toLowerCase().replace(/_/g, "-");
      await exportStyledExcelWithLogo({
        filename: `Inventory_Alerts_${filterTag}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheets,
      });
      toast.success("Inventory alert items exported to Excel successfully with company logo & root tabs!");
    } catch (err) {
      console.error("Export Excel error:", err);
      toast.error("Failed to export Excel.");
    }
  };

  // ─── Export to PDF (Print View) ──────────────────────────────────────────
  const handleExportAlertPDF = () => {
    if (!filteredItems || filteredItems.length === 0) {
      toast.error("No items available to export for the selected filter.");
      return;
    }

    const filterLabels = {
      ALL_ALERTS: "All Active Stock Alerts (Out of Stock & Low Stock)",
      OUT_OF_STOCK: "Out of Stock Items (Zero Stock)",
      LOW_STOCK: "Low Stock Warning Items",
      HEALTHY: "Healthy Stock Inventory",
    };
    const reportTitle = filterLabels[alertFilter] || "Inventory Stock Alert Report";

    const printWin = window.open("", "_blank", "width=1200,height=850");
    if (!printWin) {
      toast.error("Popup blocked! Please allow popups to download or print PDF.");
      return;
    }

    const totalUnits = filteredItems.reduce((acc, i) => acc + Number(i.quantity || 0), 0);
    const zeroCount = filteredItems.filter(i => Number(i.quantity || 0) === 0).length;
    const lowCount = filteredItems.filter(i => Number(i.quantity || 0) > 0 && Number(i.quantity || 0) <= Number(i.minStock || 5)).length;

    // Group items by Root 1
    const groupedByRoot1 = new Map();
    filteredItems.forEach((item) => {
      const roots = getItemRoots(item);
      const r1Key = roots.r1 || "Unassigned";
      if (!groupedByRoot1.has(r1Key)) {
        groupedByRoot1.set(r1Key, []);
      }
      groupedByRoot1.get(r1Key).push({ item, roots });
    });

    let globalItemIndex = 0;
    const rootSectionsHtml = Array.from(groupedByRoot1.entries())
      .map(([r1Name, groupItems], groupIdx) => {
        const groupUnits = groupItems.reduce((acc, { item }) => acc + Number(item.quantity || 0), 0);
        const groupZero = groupItems.filter(({ item }) => Number(item.quantity || 0) === 0).length;
        const groupLow = groupItems.filter(({ item }) => Number(item.quantity || 0) > 0 && Number(item.quantity || 0) <= Number(item.minStock || 5)).length;

        const groupRowsHtml = groupItems
          .map(({ item, roots }) => {
            globalItemIndex += 1;
            const qty = Number(item.quantity || 0);
            const minS = Number(item.minStock || 5);

            let statusColor = "#059669";
            let statusText = "Healthy";
            let rowBg = "#ffffff";

            if (qty === 0) {
              statusColor = "#e11d48";
              statusText = "OUT OF STOCK";
              rowBg = "#fff1f2";
            } else if (qty <= minS) {
              statusColor = "#d97706";
              statusText = "LOW STOCK";
              rowBg = "#fffbeb";
            }

            return `
              <tr style="background: ${rowBg}; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                <td style="padding: 7px 6px; text-align: center; color: #64748b; font-weight: bold;">${globalItemIndex}</td>
                <td style="padding: 7px 8px; color: #1e3a8a; font-weight: 700;">${roots.r1}</td>
                <td style="padding: 7px 8px; color: #4338ca;">${roots.r2}</td>
                <td style="padding: 7px 8px; color: #b45309;">${roots.r3}</td>
                <td style="padding: 7px 8px; color: #be123c;">${roots.r4}</td>
                <td style="padding: 7px 8px; font-weight: 600;">
                  <div>${item.name || "—"}</div>
                  ${item.code || item.sku ? `<div style="font-size: 9px; font-family: monospace; color: #64748b;">${item.code || item.sku}</div>` : ""}
                </td>
                <td style="padding: 7px 8px; text-align: right; font-weight: 700; color: ${qty === 0 ? '#e11d48' : '#0f172a'};">${qty} ${item.unit || "Nos"}</td>
                <td style="padding: 7px 8px; text-align: right; font-weight: 600; color: #64748b;">${minS}</td>
                <td style="padding: 7px 8px; text-align: center;">
                  <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 9px; font-weight: 800; color: ${statusColor}; background: ${qty === 0 ? '#ffe4e6' : qty <= minS ? '#fef3c7' : '#d1fae5'};">
                    ${statusText}
                  </span>
                </td>
                <td style="padding: 7px 8px; color: #334155; font-size: 11px; font-weight: 600;">${getExactLocation(item)}</td>
              </tr>
            `;
          })
          .join("");

        return `
          <div class="root-section ${groupIdx > 0 ? 'page-break' : ''}">
            <div class="root-category-banner">
              <div class="banner-left">
                <span class="root-badge">ROOT LEVEL 1</span>
                <span class="root-name">${r1Name}</span>
              </div>
              <div class="banner-right">
                <span>SKUs: <strong>${groupItems.length}</strong></span>
                <span>Total Qty: <strong>${groupUnits}</strong></span>
                ${groupZero > 0 ? `<span style="color: #e11d48;">Zero Stock: <strong>${groupZero}</strong></span>` : ''}
                ${groupLow > 0 ? `<span style="color: #d97706;">Low Stock: <strong>${groupLow}</strong></span>` : ''}
                <button class="no-print btn-print-cat" onclick="printCategorySection('${r1Name.replace(/'/g, "\\'")}')" title="Print/Download PDF for ${r1Name}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download ${r1Name} PDF
                </button>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 35px; text-align: center;">S.No</th>
                  <th>Root 1</th>
                  <th>Root 2</th>
                  <th>Root 3</th>
                  <th>Root 4</th>
                  <th>Item</th>
                  <th style="text-align: right;">Qty</th>
                  <th style="text-align: right;">Min Qty</th>
                  <th style="text-align: center;">Status</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                ${groupRowsHtml}
                <tr style="background: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1; font-size: 11px;">
                  <td colspan="6" style="padding: 8px; text-align: right; color: #475569;">SUBTOTAL FOR ROOT 1 (${r1Name}):</td>
                  <td style="padding: 8px; text-align: right; color: #1e3a8a; font-weight: 800;">${groupUnits}</td>
                  <td colspan="3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      })
      .join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${reportTitle} - Techware Automation</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A4 landscape;
              margin: 10mm 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 16px;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #2563eb;
              padding-bottom: 14px;
              margin-bottom: 16px;
            }
            .company-brand-area {
              display: flex;
              align-items: center;
              gap: 16px;
            }
            .company-logo-img {
              height: 52px;
              width: auto;
              max-width: 160px;
              object-fit: contain;
            }
            .title {
              font-size: 18px;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 2px 0;
            }
            .subtitle {
              font-size: 11px;
              color: #64748b;
              margin: 0;
            }
            .summary-box {
              display: flex;
              gap: 20px;
              margin-bottom: 16px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 10px 14px;
              font-size: 11px;
            }
            .summary-item {
              display: flex;
              flex-direction: column;
            }
            .summary-item span:first-child {
              color: #64748b;
              font-weight: 500;
            }
            .summary-item span:last-child {
              color: #0f172a;
              font-weight: 700;
              font-size: 13px;
            }
            .root-section {
              margin-bottom: 24px;
            }
            .root-category-banner {
              background: #f1f5f9;
              border-left: 4px solid #2563eb;
              padding: 8px 12px;
              margin-bottom: 8px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-radius: 0 6px 6px 0;
            }
            .banner-left {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .root-badge {
              font-size: 9px;
              font-weight: 800;
              background: #2563eb;
              color: #fff;
              padding: 2px 6px;
              border-radius: 4px;
              letter-spacing: 0.05em;
            }
            .root-name {
              font-size: 14px;
              font-weight: 800;
              color: #1e3a8a;
            }
            .banner-right {
              font-size: 11px;
              color: #475569;
              display: flex;
              align-items: center;
              gap: 16px;
            }
            .btn-print-cat {
              background: #2563eb;
              color: #ffffff;
              border: none;
              border-radius: 4px;
              padding: 4px 10px;
              font-size: 10px;
              font-weight: 700;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              box-shadow: 0 1px 2px rgba(0,0,0,0.08);
              transition: background 0.15s;
            }
            .btn-print-cat:hover {
              background: #1d4ed8;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
            }
            th {
              background: #f8fafc;
              color: #334155;
              padding: 8px;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.03em;
              border-top: 1px solid #cbd5e1;
              border-bottom: 2px solid #cbd5e1;
              text-align: left;
            }
            @media print {
              .no-print { display: none !important; }
              body { padding: 0; }
              .page-break {
                page-break-before: always;
                break-before: page;
                margin-top: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 14px; display: flex; gap: 10px;">
            <button onclick="window.print()" style="padding: 8px 16px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Print / Save as PDF</button>
            <button onclick="window.close()" style="padding: 8px 16px; background: #e2e8f0; color: #0f172a; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Close</button>
          </div>

          <div class="header-bar">
            <div class="company-brand-area">
              <img src="/techwareLogo.png" alt="Techware Automation" class="company-logo-img" onerror="this.src='/techwareLogo.svg'" />
              <div>
                <h1 class="title">${reportTitle}</h1>
                <p class="subtitle">Techware Automation (India) — Central Stock Threshold Monitoring</p>
              </div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              <div>Generated: <strong>${new Date().toLocaleString("en-IN")}</strong></div>
              <div>Filter Mode: <strong>${alertFilter}</strong></div>
            </div>
          </div>

          <div class="summary-box">
            <div class="summary-item">
              <span>Root Level 1 Groups</span>
              <span>${groupedByRoot1.size} Categories</span>
            </div>
            <div class="summary-item">
              <span>Total Listed SKUs</span>
              <span>${filteredItems.length} Products</span>
            </div>
            <div class="summary-item">
              <span>Total Quantity</span>
              <span>${totalUnits} Units</span>
            </div>
            <div class="summary-item">
              <span>Zero Stock (Out of Stock)</span>
              <span style="color: #e11d48;">${zeroCount} SKUs</span>
            </div>
            <div class="summary-item">
              <span>Low Stock Warnings</span>
              <span style="color: #d97706;">${lowCount} SKUs</span>
            </div>
          </div>

          ${rootSectionsHtml}

          <script>
            function printCategorySection(categoryName) {
              var sections = document.querySelectorAll('.root-section');
              sections.forEach(function(s) {
                var nameEl = s.querySelector('.root-name');
                if (nameEl && nameEl.innerText.trim() === categoryName.trim()) {
                  s.style.display = 'block';
                  s.classList.remove('page-break');
                } else {
                  s.style.display = 'none';
                }
              });
              window.print();
              setTimeout(function() {
                sections.forEach(function(s, idx) {
                  s.style.display = 'block';
                  if (idx > 0) s.classList.add('page-break');
                });
              }, 1000);
            }
          </script>
        </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  // Restock / Limit Modal
  const [editModalItem, setEditModalItem] = useState(null);
  const [addQty, setAddQty] = useState(0);
  const [newMinStock, setNewMinStock] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/inventory/items");
      setItems(res.items || []);
    } catch (err) {
      toast.error(err.message || "Failed to load inventory alerts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openEditModal = (item) => {
    setEditModalItem(item);
    setAddQty(0);
    setNewMinStock(item.minStock ?? 5);
  };

  const handleUpdateStockLimit = async (e) => {
    e.preventDefault();
    if (!editModalItem) return;

    setSubmitting(true);
    try {
      const currentQty = Number(editModalItem.quantity || 0);
      const updatedQty = currentQty + Number(addQty || 0);
      const updatedMinStock = Number(newMinStock);

      await apiPut(`/inventory/items/${editModalItem.id}`, {
        quantity: updatedQty,
        minStock: updatedMinStock,
      });

      toast.success("Item stock and threshold limit updated!");
      setEditModalItem(null);
      await loadData();
    } catch (err) {
      toast.error(err.message || "Failed to update item stock.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const qty = Number(item.quantity || 0);
    const minS = Number(item.minStock || 5);

    const isOutOfStock = qty === 0;
    const isLowStock = qty > 0 && qty <= minS;
    const isHealthy = qty > minS;

    const matchesSearch =
      (item.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.code || item.sku || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.categoryRef?.name || item.category || "").toLowerCase().includes(search.toLowerCase());

    let matchesFilter = true;
    if (alertFilter === "ALL_ALERTS") {
      matchesFilter = isOutOfStock || isLowStock;
    } else if (alertFilter === "OUT_OF_STOCK") {
      matchesFilter = isOutOfStock;
    } else if (alertFilter === "LOW_STOCK") {
      matchesFilter = isLowStock;
    } else if (alertFilter === "HEALTHY") {
      matchesFilter = isHealthy;
    }

    return matchesSearch && matchesFilter;
  });

  const outOfStockCount = items.filter((i) => Number(i.quantity || 0) === 0).length;
  const lowStockCount = items.filter(
    (i) => Number(i.quantity || 0) > 0 && Number(i.quantity || 0) <= Number(i.minStock || 5)
  ).length;
  const healthyCount = items.filter(
    (i) => Number(i.quantity || 0) > Number(i.minStock || 5)
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-start sm:items-center gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="p-2 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
            title="Back to Inventory Submodules"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground truncate">
              Sub-module 4: Inventory Alert (Thresholds & Reorder Warnings)
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Real-time warnings for low stock items, zero-stock alerts, and minimum stock threshold tuning.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="self-end sm:self-auto p-2.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Metrics Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Out of Stock (Zero)
            </span>
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">{outOfStockCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Low Stock Warnings
            </span>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{lowStockCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Healthy Stock Items
            </span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{healthyCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Total Monitored SKUs
            </span>
            <span className="text-2xl font-bold text-foreground">{items.length}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-background p-4 rounded-2xl border border-border card-shadow">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search alerts by item name, SKU, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-secondary/30 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportAlertExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs hover:shadow-sm transition-all cursor-pointer"
            title="Download list in Excel (CSV) with Root 1, 2, 3, 4 levels, Min Qty & Present Qty"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Excel</span>
          </button>
          <button
            type="button"
            onClick={handleExportAlertPDF}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs hover:shadow-sm transition-all cursor-pointer"
            title="Download printable PDF report with Root 1, 2, 3, 4 levels, Min Qty & Present Qty"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Export PDF</span>
          </button>

          <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

          {[
            { id: "ALL_ALERTS", label: `Active Alerts (${outOfStockCount + lowStockCount})` },
            { id: "OUT_OF_STOCK", label: `Out of Stock (${outOfStockCount})` },
            { id: "LOW_STOCK", label: `Low Stock (${lowStockCount})` },
            { id: "HEALTHY", label: `Healthy (${healthyCount})` },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setAlertFilter(st.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                alertFilter === st.id
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-secondary/40 border border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert Items List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground bg-background rounded-2xl border border-border">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-rose-600" />
            <p className="text-sm">Loading stock alerts...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground bg-background rounded-2xl border border-border">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500" />
            <h3 className="font-bold text-base text-foreground mb-1">No Alerts for Selected Filter</h3>
            <p className="text-xs text-muted-foreground">
              All items in this view are within normal stock thresholds.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredItems.map((item) => {
              const qty = Number(item.quantity || 0);
              const minS = Number(item.minStock || 5);

              const isOutOfStock = qty === 0;
              const isLowStock = qty > 0 && qty <= minS;
              const isHealthy = qty > minS;
              const deficit = Math.max(0, minS - qty);
              const categoryName = item.categoryRef?.name || item.category || "Uncategorized";

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border bg-background p-5 card-shadow transition-all flex flex-col justify-between space-y-4 ${
                    isOutOfStock
                      ? "border-rose-500/50 bg-rose-500/[0.03]"
                      : isLowStock
                      ? "border-amber-500/40 bg-amber-500/[0.02]"
                      : "border-border"
                  }`}
                >
                  <div>
                    {/* Header: Title & Alert Badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-bold text-base text-foreground line-clamp-1">
                          {item.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <Tag className="h-3 w-3" />
                          <span>{item.code || item.sku || "No Code"}</span>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 flex items-center gap-1 ${
                          isOutOfStock
                            ? "bg-rose-100 text-rose-800 border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-300"
                            : isLowStock
                            ? "bg-amber-100 text-amber-800 border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                        }`}
                      >
                        {isOutOfStock ? (
                          <>
                            <XCircle className="h-3.5 w-3.5" />
                            CRITICAL
                          </>
                        ) : isLowStock ? (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5" />
                            WARNING
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            HEALTHY
                          </>
                        )}
                      </span>
                    </div>

                    {/* Category & Location Badges */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
                      <span className="px-2 py-0.5 rounded-md bg-secondary text-foreground font-medium">
                        {categoryName}
                      </span>
                      {item.location && (
                        <span className="px-2 py-0.5 rounded-md bg-secondary/60 text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {item.location}
                        </span>
                      )}
                    </div>

                    {/* Threshold & Deficit Box */}
                    <div className="p-3.5 rounded-xl bg-secondary/40 border border-border text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium">Current Stock:</span>
                        <span className={`font-bold text-sm ${isOutOfStock ? "text-rose-600" : isLowStock ? "text-amber-600" : "text-foreground"}`}>
                          {qty} {item.unit || "Nos"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium">Min Threshold Limit:</span>
                        <span className="font-semibold text-foreground">{minS} {item.unit || "Nos"}</span>
                      </div>
                      {!isHealthy && (
                        <div className="pt-2 border-t border-border flex items-center justify-between text-rose-600 dark:text-rose-400 font-bold">
                          <span>Required Reorder Deficit:</span>
                          <span>+{deficit > 0 ? deficit : minS} {item.unit || "Nos"}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  {canEdit && (
                    <div className="pt-3 border-t border-border flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sliders className="h-3.5 w-3.5" />
                        Adjust Limit / Quick Restock
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Adjust Threshold / Restock */}
      {editModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-rose-600" />
                <h3 className="font-bold text-base text-foreground">Adjust Stock & Threshold</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditModalItem(null)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStockLimit} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-secondary/40 border border-border text-xs space-y-1">
                <div className="font-bold text-foreground text-sm">{editModalItem.name}</div>
                <div className="text-muted-foreground">
                  Current Stock: <strong>{editModalItem.quantity || 0} {editModalItem.unit || "Nos"}</strong> | Code: {editModalItem.code || "N/A"}
                </div>
              </div>

              {/* Add Fresh Stock Quantity */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Add Fresh Restock Quantity (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  New Stock will become: <strong>{Number(editModalItem.quantity || 0) + Number(addQty || 0)} {editModalItem.unit || "Nos"}</strong>
                </span>
              </div>

              {/* Minimum Stock Limit */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Minimum Stock Threshold Limit (minStock) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newMinStock}
                  onChange={(e) => setNewMinStock(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  Alert will trigger whenever stock drops to or below this limit.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditModalItem(null)}
                  className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-secondary text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {submitting ? "Saving..." : "Save Adjustments"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
