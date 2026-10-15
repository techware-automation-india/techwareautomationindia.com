/**
 * attendancePdfExport.js
 * Utility for exporting professional printable PDF reports for Attendance.
 * Supports:
 * 1. Single Employee Monthly / Weekly Attendance Report
 * 2. Team Attendance (All Employees) Summary & Matrix Report
 */

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
  const printWindow = window.open("", "_blank", "width=900,height=800");

  if (!printWindow) {
    alert("Please allow pop-ups to download or print your attendance PDF.");
    return;
  }

  // Pre-sort records by date ascending
  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const empName = employee?.fullName || employee?.name || "Employee";
  const empCode = employee?.employeeCode || employee?.code || "—";
  const department = employee?.department?.name || employee?.department || "General";

  // Calculate or extract summary values
  const shortDaysCount = summary.SHORT_DAY ?? (isShortDayFn ? records.filter(isShortDayFn).length : 0);
  const absentCount = summary.ABSENT ?? records.filter((r) => r.status === "ABSENT").length;
  const leaveCount = summary.ON_LEAVE ?? records.filter((r) => r.status === "ON_LEAVE").length;
  const presentCount = summary.PRESENT ?? records.filter((r) => r.status === "PRESENT").length;
  const otHoursTotal = summary.OT_HOURS_TEXT || (summary.totalOvertime != null ? fmtWorkedHoursFn(summary.totalOvertime) : "—");
  const totalWorkedText = summary.TOTAL_WORKED_TEXT || (summary.totalWorked != null ? fmtWorkedHoursFn(summary.totalWorked) : "—");

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

          return `
            <tr class="${idx % 2 === 1 ? 'row-alt' : ''}">
              <td class="cell-date">${fmtDateFn(r.date)}</td>
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

  printWindow.document.write(`
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
          .header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 16px;
            margin-bottom: 18px;
          }
          .title-area h1 {
            margin: 0 0 4px;
            font-size: 20px;
            font-weight: 800;
            color: #0369a1;
            letter-spacing: -0.02em;
          }
          .title-area p {
            margin: 0;
            font-size: 12px;
            color: #64748b;
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
            background: #f8fafc;
          }
          .cell-date { font-weight: 600; }
          .cell-time { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; }
          .cell-hours { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
          .cell-ot { }

          /* Badges */
          .badge {
            display: inline-block;
            font-size: 10.5px;
            font-weight: 700;
            padding: 2.5px 8px;
            border-radius: 9999px;
            text-align: center;
          }
          .status-present { background: #dcfce7; color: #15803d; }
          .status-short { background: #fef3c7; color: #b45309; }
          .status-absent { background: #fee2e2; color: #b91c1c; }
          .status-leave { background: #f3e8ff; color: #6d28d9; }
          .status-holiday { background: #e0e7ff; color: #4338ca; }
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

          /* Footer */
          .footer {
            margin-top: 24px;
            padding-top: 12px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #64748b;
          }

          @media print {
            body { padding: 12mm 15mm; }
            @page { margin: 10mm; size: A4 portrait; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h1>Attendance Register</h1>
            <p>Monthly Employee Attendance & Overtime Record</p>
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

        <!-- Small Summary Div: Short Days, Absent, On Leave, OT Hours -->
        <div class="summary-container">
          <div class="summary-title">Attendance Summary Metrics</div>
          <div class="summary-grid">
            <div class="summary-card card-short">
              <div class="val val-short">${shortDaysCount}</div>
              <div class="lbl">Short Days (&lt;8h)</div>
            </div>
            <div class="summary-card card-absent">
              <div class="val val-absent">${absentCount}</div>
              <div class="lbl">Absent Days</div>
            </div>
            <div class="summary-card card-leave">
              <div class="val val-leave">${leaveCount}</div>
              <div class="lbl">On Leave</div>
            </div>
            <div class="summary-card card-ot">
              <div class="val val-ot">${otHoursTotal}</div>
              <div class="lbl">OT Hours</div>
            </div>
          </div>
        </div>

        <!-- Attendance Data Table with exact columns -->
        <table>
          <thead>
            <tr>
              <th style="width: 18%;">Date</th>
              <th style="width: 18%;">Status</th>
              <th style="width: 16%;">Check In</th>
              <th style="width: 16%;">Check Out</th>
              <th style="width: 16%;">Working Hours</th>
              <th style="width: 16%;">OT</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <span>AutoCard Attendance Management System</span>
          <span>Confidential &bull; Page 1 of 1</span>
        </div>

        <script>
          window.onload = () => {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
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
  const printWindow = window.open("", "_blank", "width=1100,height=800");

  if (!printWindow) {
    alert("Please allow pop-ups to download or print your attendance PDF.");
    return;
  }

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
          <td class="cell-num">${summary.totalOtMinutes > 0 ? `<span class="badge-ot">${summary.totalOtText}</span>` : '—'}</td>
        </tr>
      `;
    })
    .join("");

  const otHoursTotalFormatted = `${Math.floor(teamOtMinutes / 60)}h ${teamOtMinutes % 60}m`;
  const workedHoursTotalFormatted = `${Math.floor(teamWorkedMinutes / 60)}h ${teamWorkedMinutes % 60}m`;

  printWindow.document.write(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Team Attendance Report - ${monthName} ${year}</title>
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
          .header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 16px;
            margin-bottom: 18px;
          }
          .title-area h1 {
            margin: 0 0 4px;
            font-size: 20px;
            font-weight: 800;
            color: #0369a1;
          }
          .title-area p {
            margin: 0;
            font-size: 12px;
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
          .row-alt { background: #f8fafc; }
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

          /* Footer */
          .footer {
            margin-top: 24px;
            padding-top: 12px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #64748b;
          }

          @media print {
            body { padding: 10mm 12mm; }
            @page { margin: 10mm; size: A4 landscape; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h1>All Employees Attendance Summary</h1>
            <p>Team Attendance & Overtime Register (${employees.length} Employees)</p>
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
              <th style="width: 28%; text-align: left;">Employee</th>
              <th style="width: 10%;">Present</th>
              <th style="width: 10%;">Short Day</th>
              <th style="width: 10%;">Absent</th>
              <th style="width: 10%;">Leave</th>
              <th style="width: 10%;">Holiday</th>
              <th style="width: 16%;">Worked</th>
              <th style="width: 16%;">OT</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <span>AutoCard Attendance Management System &bull; Total Worked: ${workedHoursTotalFormatted}</span>
          <span>Confidential &bull; Page 1 of 1</span>
        </div>

        <script>
          window.onload = () => {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
