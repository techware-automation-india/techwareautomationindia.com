import ExcelJS from "exceljs";

/**
 * Styling constants
 */
const BRAND_PRIMARY = "1E3A8A"; // Deep Navy Blue
const BRAND_SECONDARY = "0284C7"; // Ocean Blue
const HEADER_BG = "1E293B";     // Slate 800
const HEADER_TEXT = "FFFFFF";
const ZEBRA_EVEN = "F8FAFC";
const ZEBRA_ODD = "FFFFFF";
const BORDER_COLOR = "E2E8F0";
const SUBTOTAL_BG = "F1F5F9";

/**
 * Cache for base64 logo
 */
let cachedLogoBase64 = null;

async function getLogoBase64() {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const res = await fetch("/techwareLogo.png");
    if (!res.ok) throw new Error("Failed to load /techwareLogo.png");
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoBase64 = reader.result;
        resolve(cachedLogoBase64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("Logo base64 load error, continuing without image:", err);
    return null;
  }
}

/**
 * Generate a beautifully styled, A4-ready multi-tab Excel Workbook with embedded Company Logo
 *
 * @param {Object} options
 * @param {string} options.filename - Download filename (.xlsx)
 * @param {Array<{ name: string, title: string, subtitle: string, headers: Array<string>, rows: Array<Array<any>>, subtotalRow?: Array<any>, colWidths: Array<number>, rightAlignCols: Array<number>, centerAlignCols: Array<number> }>} options.sheets
 */
export async function exportStyledExcelWithLogo({ filename, sheets = [] }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TECHWARE AUTOMATION (INDIA)";
  workbook.created = new Date();

  const logoBase64 = await getLogoBase64();
  let imageId = null;
  if (logoBase64) {
    imageId = workbook.addImage({
      base64: logoBase64,
      extension: "png",
    });
  }

  sheets.forEach((sheetData) => {
    // Clean sheet name: max 31 chars, no invalid chars
    let sheetName = (sheetData.name || "Sheet").replace(/[\/\\?*\[\]]/g, "-").trim();
    if (sheetName.length > 31) sheetName = sheetName.substring(0, 31);

    const worksheet = workbook.addWorksheet(sheetName, {
      pageSetup: {
        paperSize: 9, // A4
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.4,
          right: 0.4,
          top: 0.5,
          bottom: 0.5,
          header: 0.3,
          footer: 0.3,
        },
      },
      views: [{ showGridLines: true }],
    });

    const totalCols = (sheetData.headers || []).length || 10;

    // Set Column Widths (ensure Column A has sufficient width for the logo)
    if (sheetData.colWidths && sheetData.colWidths.length > 0) {
      const adjustedColWidths = [...sheetData.colWidths];
      adjustedColWidths[0] = Math.max(adjustedColWidths[0] || 8, 16); // Give Col A width for logo
      worksheet.columns = adjustedColWidths.map((w) => ({ width: w }));
    }

    // Row 1 to 3: Header space with company logo and brand title
    worksheet.addRow([]);
    worksheet.addRow([]);
    worksheet.addRow([]);

    worksheet.getRow(1).height = 24;
    worksheet.getRow(2).height = 20;
    worksheet.getRow(3).height = 20;

    // Merge columns B..last for Company Header & Details
    const endColLetter = String.fromCharCode(65 + Math.min(totalCols - 1, 25));

    // Title Row (Row 1)
    worksheet.mergeCells(`B1:${endColLetter}1`);
    const titleCell = worksheet.getCell("B1");
    titleCell.value = "TECHWARE AUTOMATION (INDIA)";
    titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FF" + BRAND_PRIMARY } };
    titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    // Subtitle Row (Row 2)
    worksheet.mergeCells(`B2:${endColLetter}2`);
    const subCell = worksheet.getCell("B2");
    subCell.value = sheetData.title || "Central Master Catalog";
    subCell.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF0F172A" } };
    subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    // Meta Row (Row 3)
    worksheet.mergeCells(`B3:${endColLetter}3`);
    const metaCell = worksheet.getCell("B3");
    metaCell.value = `${sheetData.subtitle || ""}  |  Generated: ${new Date().toLocaleDateString("en-IN")} ${new Date().toLocaleTimeString("en-IN")}`;
    metaCell.font = { name: "Segoe UI", size: 9.5, italic: true, color: { argb: "FF64748B" } };
    metaCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    // Merge cells A1:A3 to house the company logo cleanly
    worksheet.mergeCells("A1:A3");
    const logoCell = worksheet.getCell("A1");
    logoCell.alignment = { vertical: "middle", horizontal: "center" };

    // Insert Image into Column A (Row 1 to 3) with exact aspect ratio (1.5:1, 90x60px)
    if (imageId !== null) {
      worksheet.addImage(imageId, {
        tl: { col: 0.15, row: 0.15 },
        ext: { width: 90, height: 60 },
        editAs: "oneCell",
      });
    }

    // Row 4: Blank separator row
    const blankRow = worksheet.addRow([]);
    blankRow.height = 8;

    // Row 5: Table Header Row
    const headerRow = worksheet.addRow(sheetData.headers);
    headerRow.height = 26;
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF" + HEADER_TEXT } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF" + HEADER_BG },
      };
      const isRight = (sheetData.rightAlignCols || []).includes(colNumber - 1);
      const isCenter = (sheetData.centerAlignCols || []).includes(colNumber - 1);
      cell.alignment = {
        vertical: "middle",
        horizontal: isRight ? "right" : isCenter ? "center" : "left",
      };
      cell.border = {
        top: { style: "medium", color: { argb: "FF0F172A" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FF334155" } },
        right: { style: "thin", color: { argb: "FF334155" } },
      };
    });

    // Data Rows
    (sheetData.rows || []).forEach((rowVals, rowIdx) => {
      const dataRow = worksheet.addRow(rowVals);
      dataRow.height = 20;
      const isEven = rowIdx % 2 === 0;

      dataRow.eachCell((cell, colNumber) => {
        const isRight = (sheetData.rightAlignCols || []).includes(colNumber - 1);
        const isCenter = (sheetData.centerAlignCols || []).includes(colNumber - 1);

        cell.font = {
          name: "Segoe UI",
          size: 9.5,
          bold: colNumber === 2 || colNumber === 6, // Root 1 and Item Name bolder
          color: { argb: "FF1E293B" },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF" + (isEven ? ZEBRA_EVEN : ZEBRA_ODD) },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: isRight ? "right" : isCenter ? "center" : "left",
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF" + BORDER_COLOR } },
          bottom: { style: "thin", color: { argb: "FF" + BORDER_COLOR } },
          left: { style: "thin", color: { argb: "FF" + BORDER_COLOR } },
          right: { style: "thin", color: { argb: "FF" + BORDER_COLOR } },
        };
      });
    });

    // Subtotal Row
    if (sheetData.subtotalRow && sheetData.subtotalRow.length > 0) {
      const subtotal = worksheet.addRow(sheetData.subtotalRow);
      subtotal.height = 24;
      subtotal.eachCell((cell, colNumber) => {
        const isRight = (sheetData.rightAlignCols || []).includes(colNumber - 1);
        const isCenter = (sheetData.centerAlignCols || []).includes(colNumber - 1);

        cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF0F172A" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF" + SUBTOTAL_BG },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: isRight ? "right" : isCenter ? "center" : "left",
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF94A3B8" } },
          bottom: { style: "medium", color: { argb: "FF475569" } },
          left: { style: "thin", color: { argb: "FF" + BORDER_COLOR } },
          right: { style: "thin", color: { argb: "FF" + BORDER_COLOR } },
        };
      });
    }
  });

  // Export to Blob and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `Techware_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Backward compatibility export if cached in Vite dev server
export function styleExcelWorksheet() {
  // No-op for backward compatibility with cached dev modules
  return;
}

export default ExcelJS;
