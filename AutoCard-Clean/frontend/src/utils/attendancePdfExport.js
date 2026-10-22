/**
 * attendancePdfExport.js
 * Utility for exporting professional printable PDF reports for Attendance.
 * Supports:
 * 1. Single Employee Monthly / Weekly Attendance Report
 * 2. Team Attendance (All Employees) Summary & Matrix Report
 */

// Robust printing helper that renders in a hidden iframe (preventing 'about:blank' popups)
// and falls back gracefully to a focused window if needed.
const printHtmlDocument = (htmlContent, title) => {
  try {
    const existingIframe = document.getElementById("__attendance_print_frame__");
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement("iframe");
    iframe.id = "__attendance_print_frame__";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow || iframe.contentDocument;
    const iframeDoc = doc.document || doc;

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    const triggerPrint = () => {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }
      } catch (err) {
        console.warn("Iframe print fallback to window:", err);
      } finally {
        setTimeout(() => {
          iframe.remove();
        }, 60000);
      }
    };

    // Allow images/styles to finish rendering before print
    if (iframe.contentWindow) {
      iframe.contentWindow.onload = () => {
        setTimeout(triggerPrint, 250);
      };
      // Safety timeout in case onload fired early
      setTimeout(triggerPrint, 800);
    }
  } catch (err) {
    console.error("Iframe printing failed, using popup fallback:", err);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }
};

export const printSingleEmployeeAttendancePdf = ({
  employee,
  monthName,
  year,
  periodLabel = "Full Month",
  records = [],
  summary = {},
  isShortDayFn,
  isHolidayDateFn,
  fmtDateFn,
  fmtTimeFn,
  fmtWorkedHoursFn,
}) => {
  // Pre-sort records by date ascending
  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const empName = employee?.fullName || employee?.name || "Employee";
  const empCode = employee?.employeeCode || employee?.code || "—";
  const department = employee?.department?.name || employee?.department || "General";

  // Helper to parse time strings like "160h 30m" into total minutes
  const parseHMToMinutes = (str) => {
    if (!str || str === "—") return 0;
    const matchH = str.match(/(\d+)\s*h/i);
    const matchM = str.match(/(\d+)\s*m/i);
    const h = matchH ? parseInt(matchH[1], 10) : 0;
    const m = matchM ? parseInt(matchM[1], 10) : 0;
    return h * 60 + m;
  };

  const fmtMinutesToHMString = (mins) => {
    if (mins == null || Number.isNaN(mins) || mins <= 0) return "0h 0m";
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m`;
  };

  // Calculate or extract summary values
  const shortDaysCount = summary.SHORT_DAY ?? (isShortDayFn ? records.filter(isShortDayFn).length : 0);
  const absentCount = summary.ABSENT ?? records.filter((r) => r.status === "ABSENT").length;
  const leaveCount = summary.ON_LEAVE ?? records.filter((r) => r.status === "ON_LEAVE").length;
  const presentCount = summary.PRESENT ?? records.filter((r) => r.status === "PRESENT").length;
  const holidayCount = summary.HOLIDAY ?? records.filter((r) => isHolidayDateFn ? isHolidayDateFn(r.date) : (r.status === "HOLIDAY" || new Date(r.date).getDay() === 0)).length;
  const otDaysCount = summary.OT_DAYS ?? records.filter((r) => (r.overtimeHours > 0 || r.otHours > 0)).length;
  const otHoursTotal = summary.OT_HOURS_TEXT || (summary.totalOvertime != null ? fmtWorkedHoursFn(summary.totalOvertime) : "—");
  const totalWorkedText = summary.TOTAL_WORKED_TEXT || (summary.totalWorked != null ? fmtWorkedHoursFn(summary.totalWorked) : "—");

  // Worked = total worked - ot
  const totalWorkedMins = parseHMToMinutes(totalWorkedText);
  const totalOtMins = parseHMToMinutes(otHoursTotal);
  const netWorkedMins = Math.max(0, totalWorkedMins - totalOtMins);
  const netWorkedText = fmtMinutesToHMString(netWorkedMins);

  const rowsHtml = sortedRecords.length > 0
    ? sortedRecords
        .map((r, idx) => {
          const isSun = new Date(r.date).getDay() === 0;
          const isHol = isHolidayDateFn ? isHolidayDateFn(r.date) : r.status === "HOLIDAY";
          const isShort = isShortDayFn ? isShortDayFn(r) : r.isShortDay;

          // Status Badge
          let statusText = r.status;
          let statusClass = "status-present";

          if (isShort) {
            statusText = "Short Day";
            statusClass = "status-short";
          } else if (r.status === "ON_LEAVE") {
            statusText = "On Leave";
            statusClass = "status-leave";
          } else if (r.status === "ABSENT") {
            statusText = "Absent";
            statusClass = "status-absent";
          } else if (isHol || isSun || r.status === "HOLIDAY") {
            statusText = isSun && !r.status ? "Weekly Off" : (r.note || "Holiday");
            statusClass = "status-holiday";
          } else if (r.status === "PRESENT") {
            statusText = "Present";
            statusClass = "status-present";
          }

          const inTime = r.status === "ON_LEAVE" || r.status === "ABSENT" ? "—" : (r.checkIn ? fmtTimeFn(r.checkIn) : "—");
          const outTime = r.status === "ON_LEAVE" || r.status === "ABSENT" ? "—" : (r.checkOut ? fmtTimeFn(r.checkOut) : "—");
          const worked = r.status === "ON_LEAVE" || r.status === "ABSENT" ? "—" : (fmtWorkedHoursFn(r.workedHoursTotal ?? r.workedHours) || "—");
          const ot = (r.overtimeHours > 0 || r.otHours > 0)
            ? (fmtWorkedHoursFn(r.overtimeHours || r.otHours) || "—")
            : "—";

          const dateObj = new Date(r.date);
          const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dateObj.getDay()];

          return `
            <tr class="${isShort ? 'row-short-day' : (idx % 2 === 1 ? 'row-alt' : '')}">
              <td class="cell-date">
                <div>${fmtDateFn(r.date)}</div>
                <div class="cell-day">${dayName}</div>
              </td>
              <td class="cell-status"><span class="badge ${statusClass}">${statusText}</span></td>
              <td class="cell-time">${inTime}</td>
              <td class="cell-time">${outTime}</td>
              <td class="cell-hours"><strong>${worked}</strong></td>
              <td class="cell-ot">${ot !== "—" ? `<span class="badge-ot">${ot}</span>` : '<span class="text-muted">—</span>'}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="6" style="text-align:center; padding: 24px; color: #64748b;">No attendance records found for this period.</td></tr>`;

  const htmlContent = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Attendance Report - ${empName} - ${monthName} ${year}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            font-size: 13px;
            line-height: 1.4;
          }
          /* Full Page Transparent Watermark Logo */
          .watermark-container {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.08;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .watermark-container img {
            width: 75vmin;
            max-width: 620px;
            height: auto;
            max-height: 620px;
            object-fit: contain;
            filter: grayscale(15%);
          }

          .content-wrapper {
            position: relative;
            z-index: 1;
            background: transparent;
          }

          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 16px;
            margin-bottom: 18px;
            gap: 16px;
          }
          .company-brand {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .company-logo {
            height: 52px;
            width: auto;
            object-fit: contain;
          }
          .title-area h1 {
            margin: 0;
            font-size: 19px;
            font-weight: 800;
            color: #1e3a8a;
            letter-spacing: -0.01em;
          }
          .company-name {
            font-size: 15px;
            font-weight: 800;
            color: #0284c7;
            margin-top: 1px;
            letter-spacing: 0.02em;
          }
          .company-name .highlight {
            color: #0284c7;
          }
          .company-sub {
            margin: 2px 0 0;
            font-size: 11px;
            color: #64748b;
            font-weight: 500;
          }
          .meta-area {
            text-align: right;
            font-size: 12px;
          }
          .meta-badge {
            display: inline-block;
            background: #e0f2fe;
            color: #0369a1;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 12px;
            margin-bottom: 4px;
          }
          .meta-date {
            color: #64748b;
            font-size: 11px;
          }

          /* Employee Info Box */
          .emp-box {
            display: flex;
            justify-content: space-between;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 16px;
          }
          .emp-item {
            display: flex;
            flex-direction: column;
          }
          .emp-label {
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 700;
            color: #64748b;
            letter-spacing: 0.05em;
          }
          .emp-val {
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 2px;
          }

          /* Summary Div */
          .summary-container {
            margin-bottom: 20px;
          }
          .summary-title {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: #475569;
            margin-bottom: 8px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
          }
          .summary-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 12px;
            border-left: 4px solid #94a3b8;
          }
          .card-short { border-left-color: #f59e0b; background: #fffbeb; }
          .card-absent { border-left-color: #ef4444; background: #fef2f2; }
          .card-leave { border-left-color: #8b5cf6; background: #faf5ff; }
          .card-ot-days { border-left-color: #0284c7; background: #f0f9ff; }
          .card-ot { border-left-color: #f97316; background: #fff7ed; }

          .summary-card .val {
            font-size: 17px;
            font-weight: 800;
            line-height: 1.1;
          }
          .summary-card .lbl {
            font-size: 10.5px;
            font-weight: 600;
            color: #64748b;
            margin-top: 4px;
          }
          .val-short { color: #b45309; }
          .val-absent { color: #b91c1c; }
          .val-leave { color: #6d28d9; }
          .val-ot-days { color: #0369a1; }
          .val-ot { color: #c2410c; }

          /* Table */
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.95);
          }
          thead th {
            background: #f1f5f9;
            color: #1e293b;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.05em;
            padding: 10px 12px;
            border-bottom: 2px solid #cbd5e1;
            text-align: left;
          }
          tbody td {
            padding: 8px 12px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: middle;
          }
          .row-alt {
            background: rgba(248, 250, 252, 0.7);
          }
          .row-short-day {
            background: rgba(254, 243, 199, 0.45) !important;
            border-left: 3px solid #f59e0b;
          }
          .cell-date { font-weight: 600; }
          .cell-day { font-size: 11px; color: #64748b; font-weight: 600; margin-top: 1px; }
          .cell-time { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; }
          .cell-hours { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
          .cell-ot { }

          /* Badges */
          .badge {
            display: inline-block;
            font-size: 10.5px;
            font-weight: 700;
            padding: 3px 9px;
            border-radius: 9999px;
            text-align: center;
          }
          .status-present { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
          .status-short {
            background: #fef3c7;
            color: #b45309;
            border: 1px solid #fde68a;
            font-weight: 800;
            box-shadow: 0 1px 2px rgba(245, 158, 11, 0.15);
          }
          .status-absent { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
          .status-leave { background: #f3e8ff; color: #6d28d9; border: 1px solid #e9d5ff; }
          .status-holiday { background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; }
          .badge-ot {
            display: inline-block;
            background: #ffedd5;
            color: #c2410c;
            font-weight: 700;
            font-size: 10.5px;
            padding: 2px 7px;
            border-radius: 6px;
          }
          .text-muted { color: #94a3b8; }

          /* HR Notice Box */
          .hr-notice-box {
            margin-top: 18px;
            padding: 10px 14px;
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-left: 4px solid #f59e0b;
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: #92400e;
            font-weight: 600;
          }
          .hr-notice-icon {
            font-size: 15px;
            line-height: 1;
          }

          /* Footer */
          .footer {
            margin-top: 18px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #64748b;
          }

          @media print {
            body { padding: 12mm 15mm; }
            @page { margin: 10mm; size: A4 portrait; }
            .watermark-container {
              opacity: 0.05 !important;
            }
          }
        </style>
      </head>
      <body>
        <!-- Background Transparent Watermark Logo -->
        <div class="watermark-container">
          <img src="/techwareLogo.png" alt="Techware Automation (INDIA) Watermark" onerror="this.src='/techwareLogo.svg'" />
        </div>

        <div class="content-wrapper">
          <div class="header">
            <div class="company-brand">
              <img src="/techwareLogo.png" alt="Techware Automation" class="company-logo" onerror="this.src='/techwareLogo.svg'" />
              <div class="title-area">
                <h1>Attendance Register</h1>
                <div class="company-name">Techware Automation (INDIA)</div>
                <p class="company-sub">Monthly Employee Attendance & Overtime Record</p>
              </div>
            </div>
            <div class="meta-area">
              <div class="meta-badge">${monthName} ${year}</div>
              <div class="meta-date">Period: ${periodLabel} &bull; Generated: ${new Date().toLocaleDateString("en-IN")}</div>
            </div>
          </div>

          <div class="emp-box">
            <div class="emp-item">
              <span class="emp-label">Employee Name</span>
              <span class="emp-val">${empName}</span>
            </div>
            <div class="emp-item">
              <span class="emp-label">Employee Code</span>
              <span class="emp-val">${empCode}</span>
            </div>
            <div class="emp-item">
              <span class="emp-label">Department</span>
              <span class="emp-val">${department}</span>
            </div>
            <div class="emp-item">
              <span class="emp-label">Total Worked Hours</span>
              <span class="emp-val">${totalWorkedText}</span>
            </div>
          </div>

          <!-- Employee Monthly Summary Overview Table -->
          <div style="margin-bottom: 22px;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; margin-bottom: 8px;">
              Employee Attendance Monthly Summary
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 22%; text-align: left;">Employee</th>
                  <th style="width: 9%; text-align: center;">Present</th>
                  <th style="width: 10%; text-align: center;">Short Day</th>
                  <th style="width: 9%; text-align: center;">Absent</th>
                  <th style="width: 9%; text-align: center;">Leave</th>
                  <th style="width: 9%; text-align: center;">Holiday</th>
                  <th style="width: 14%; text-align: center;">Total working hours</th>
                  <th style="width: 10%; text-align: center;">Worked</th>
                  <th style="width: 8%; text-align: center;">OT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="cell-emp" style="text-align: left;">
                    <strong>${empName}</strong>
                    <div class="emp-code">${empCode} &bull; ${department}</div>
                  </td>
                  <td class="cell-num text-present" style="text-align: center;">${presentCount}</td>
                  <td class="cell-num text-short" style="text-align: center;">${shortDaysCount}</td>
                  <td class="cell-num text-absent" style="text-align: center;">${absentCount}</td>
                  <td class="cell-num text-leave" style="text-align: center;">${leaveCount}</td>
                  <td class="cell-num text-hol" style="text-align: center;">${holidayCount}</td>
                  <td class="cell-num" style="text-align: center;"><strong>${totalWorkedText}</strong></td>
                  <td class="cell-num text-present" style="text-align: center;"><strong>${netWorkedText}</strong></td>
                  <td class="cell-num" style="text-align: center;">
                    ${otHoursTotal && otHoursTotal !== "—" && otHoursTotal !== "0h 0m" ? `<span class="badge-ot">${otHoursTotal}</span>` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Attendance Daily Details Register Table -->
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; margin-bottom: 8px;">
            Daily Attendance & Punch Details
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 20%;">Date &amp; Day</th>
                <th style="width: 20%;">Status (Present, Short Day, Holiday, Leave, Absent)</th>
                <th style="width: 15%;">Check In</th>
                <th style="width: 15%;">Check Out</th>
                <th style="width: 15%;">Working Hours</th>
                <th style="width: 15%;">OT</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <!-- HR / Accountant Assistance Notice -->
          <div class="hr-notice-box">
            <span class="hr-notice-icon">&#9888;</span>
            <span>If any problem in Your Attendace Pls Connect to HR Depearment/Accountant</span>
          </div>

          <div class="footer">
            <span>Techware Automation (INDIA)</span>
            <span>Confidential &bull; Page 1 of 1</span>
          </div>
        </div>
      </body>
    </html>
  `;

  printHtmlDocument(htmlContent, `Attendance-${empName}`);
};


/**
 * Team Attendance (All Employees) PDF Generator
 */
export const printTeamAttendancePdf = ({
  employees = [],
  monthName,
  year,
  periodLabel = "Full Month",
  visibleDates = [],
  getEmployeeMonthSummary,
  fmtDateFn,
}) => {
  // Calculate team grand totals
  let teamShortDays = 0;
  let teamAbsent = 0;
  let teamLeave = 0;
  let teamPresent = 0;
  let teamOtMinutes = 0;
  let teamWorkedMinutes = 0;

  const rowsHtml = employees
    .map((emp, idx) => {
      const summary = getEmployeeMonthSummary(emp);
      teamShortDays += summary.shortDay || 0;
      teamAbsent += summary.absent || 0;
      teamLeave += summary.leave || 0;
      teamPresent += summary.present || 0;
      teamOtMinutes += summary.totalOtMinutes || 0;
      teamWorkedMinutes += summary.totalWorkedMinutes || 0;

      const netWorkedMinutes = Math.max(0, (summary.totalWorkedMinutes || 0) - (summary.totalOtMinutes || 0));
      const netWorkedText = `${Math.floor(netWorkedMinutes / 60)}h ${Math.round(netWorkedMinutes % 60)}m`;

      return `
        <tr class="${idx % 2 === 1 ? 'row-alt' : ''}">
          <td class="cell-emp">
            <strong>${emp.fullName}</strong>
            <div class="emp-code">${emp.employeeCode || "—"}</div>
          </td>
          <td class="cell-num text-present">${summary.present}</td>
          <td class="cell-num text-short">${summary.shortDay}</td>
          <td class="cell-num text-absent">${summary.absent}</td>
          <td class="cell-num text-leave">${summary.leave}</td>
          <td class="cell-num text-hol">${summary.holiday}</td>
          <td class="cell-num"><strong>${summary.totalWorkedText}</strong></td>
          <td class="cell-num text-present"><strong>${netWorkedText}</strong></td>
          <td class="cell-num">${summary.totalOtMinutes > 0 ? `<span class="badge-ot">${summary.totalOtText}</span>` : '—'}</td>
        </tr>
      `;
    })
    .join("");

  const otHoursTotalFormatted = `${Math.floor(teamOtMinutes / 60)}h ${teamOtMinutes % 60}m`;
  const workedHoursTotalFormatted = `${Math.floor(teamWorkedMinutes / 60)}h ${teamWorkedMinutes % 60}m`;

  const htmlContent = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Team Attendance Report - Techware Automation (INDIA) - ${monthName} ${year}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            font-size: 13px;
            line-height: 1.4;
          }

          /* Full Page Transparent Watermark Logo */
          .watermark-container {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.08;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .watermark-container img {
            width: 70vmin;
            max-width: 650px;
            height: auto;
            max-height: 650px;
            object-fit: contain;
            filter: grayscale(15%);
          }

          .content-wrapper {
            position: relative;
            z-index: 1;
            background: transparent;
          }

          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 16px;
            margin-bottom: 18px;
            gap: 16px;
          }
          .company-brand {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .company-logo {
            height: 54px;
            width: auto;
            object-fit: contain;
          }
          .title-area h1 {
            margin: 0;
            font-size: 19px;
            font-weight: 800;
            color: #1e3a8a;
          }
          .company-name {
            font-size: 15px;
            font-weight: 800;
            color: #0284c7;
            margin-top: 1px;
            letter-spacing: 0.02em;
          }
          .company-sub {
            margin: 2px 0 0;
            font-size: 11px;
            color: #64748b;
          }
          .meta-badge {
            display: inline-block;
            background: #e0f2fe;
            color: #0369a1;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 12px;
            margin-bottom: 4px;
          }
          .meta-date {
            color: #64748b;
            font-size: 11px;
            text-align: right;
          }

          /* Summary Box */
          .summary-container {
            margin-bottom: 20px;
          }
          .summary-title {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: #475569;
            margin-bottom: 8px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
          }
          .summary-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
            border-left: 4px solid #94a3b8;
          }
          .card-short { border-left-color: #f59e0b; background: #fffbeb; }
          .card-absent { border-left-color: #ef4444; background: #fef2f2; }
          .card-leave { border-left-color: #8b5cf6; background: #faf5ff; }
          .card-ot { border-left-color: #f97316; background: #fff7ed; }

          .summary-card .val {
            font-size: 18px;
            font-weight: 800;
            line-height: 1.1;
          }
          .summary-card .lbl {
            font-size: 11px;
            font-weight: 600;
            color: #64748b;
            margin-top: 4px;
          }
          .val-short { color: #b45309; }
          .val-absent { color: #b91c1c; }
          .val-leave { color: #6d28d9; }
          .val-ot { color: #c2410c; }

          /* Table */
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.95);
          }
          thead th {
            background: #f1f5f9;
            color: #1e293b;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.05em;
            padding: 10px 12px;
            border-bottom: 2px solid #cbd5e1;
            text-align: center;
          }
          thead th:first-child { text-align: left; }
          tbody td {
            padding: 8px 12px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: middle;
          }
          .row-alt { background: rgba(248, 250, 252, 0.7); }
          .cell-emp { text-align: left; }
          .emp-code { font-size: 10.5px; color: #64748b; font-weight: 500; }
          .cell-num { text-align: center; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }

          .text-present { color: #15803d; font-weight: 700; }
          .text-short { color: #b45309; font-weight: 700; }
          .text-absent { color: #b91c1c; font-weight: 700; }
          .text-leave { color: #6d28d9; font-weight: 700; }
          .text-hol { color: #4338ca; font-weight: 600; }
          .badge-ot {
            background: #ffedd5;
            color: #c2410c;
            padding: 2px 7px;
            border-radius: 6px;
            font-weight: 700;
          }

          /* HR Notice Box */
          .hr-notice-box {
            margin-top: 18px;
            padding: 10px 14px;
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-left: 4px solid #f59e0b;
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: #92400e;
            font-weight: 600;
          }
          .hr-notice-icon {
            font-size: 15px;
            line-height: 1;
          }

          /* Footer */
          .footer {
            margin-top: 18px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #64748b;
          }

          @media print {
            body { padding: 10mm 12mm; }
            @page { margin: 10mm; size: A4 landscape; }
            .watermark-container {
              opacity: 0.05 !important;
            }
          }
        </style>
      </head>
      <body>
        <!-- Background Transparent Watermark Logo -->
        <div class="watermark-container">
          <img src="/techwareLogo.png" alt="Techware Automation (INDIA) Watermark" onerror="this.src='/techwareLogo.svg'" />
        </div>

        <div class="content-wrapper">
          <div class="header">
            <div class="company-brand">
              <img src="/techwareLogo.png" alt="Techware Automation" class="company-logo" onerror="this.src='/techwareLogo.svg'" />
              <div class="title-area">
                <h1>All Employees Attendance Summary</h1>
                <div class="company-name">Techware Automation (INDIA)</div>
                <p class="company-sub">Team Attendance & Overtime Register (${employees.length} Employees)</p>
              </div>
            </div>
            <div>
              <div class="meta-badge">${monthName} ${year}</div>
              <div class="meta-date">Period: ${periodLabel} &bull; Generated: ${new Date().toLocaleDateString("en-IN")}</div>
            </div>
          </div>

          <!-- Small Summary Div: Short Days, Absent, On Leave, OT Hours -->
          <div class="summary-container">
            <div class="summary-title">Team Grand Totals</div>
            <div class="summary-grid">
              <div class="summary-card card-short">
                <div class="val val-short">${teamShortDays}</div>
                <div class="lbl">Total Short Days</div>
              </div>
              <div class="summary-card card-absent">
                <div class="val val-absent">${teamAbsent}</div>
                <div class="lbl">Total Absent Days</div>
              </div>
              <div class="summary-card card-leave">
                <div class="val val-leave">${teamLeave}</div>
                <div class="lbl">Total On Leave</div>
              </div>
              <div class="summary-card card-ot">
                <div class="val val-ot">${otHoursTotalFormatted}</div>
                <div class="lbl">Total OT Hours</div>
              </div>
            </div>
          </div>

          <!-- Table -->
          <table>
            <thead>
              <tr>
                <th style="width: 22%; text-align: left;">Employee</th>
                <th style="width: 9%;">Present</th>
                <th style="width: 10%;">Short Day</th>
                <th style="width: 9%;">Absent</th>
                <th style="width: 9%;">Leave</th>
                <th style="width: 9%;">Holiday</th>
                <th style="width: 14%;">Total working hours</th>
                <th style="width: 10%;">Worked</th>
                <th style="width: 8%;">OT</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <!-- HR / Accountant Assistance Notice -->
          <div class="hr-notice-box">
            <span class="hr-notice-icon">&#9888;</span>
            <span>If any problem in Your Attendace Pls Connect to HR Depearment/Accountant</span>
          </div>

          <div class="footer">
            <span>Techware Automation (INDIA) &bull; Total Worked: ${workedHoursTotalFormatted}</span>
            <span>Confidential &bull; Page 1 of 1</span>
          </div>
        </div>
      </body>
    </html>
  `;

  printHtmlDocument(htmlContent, `Team-Attendance-${monthName}-${year}`);
};
