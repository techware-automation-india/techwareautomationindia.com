/**
 * pollContext.jsx
 * ---------------
 * Global silent-polling context.
 *
 * Polls the server every POLL_INTERVAL ms and broadcasts:
 *   - adminPendingCount  – total pending requests visible to admin
 *   - adminPendingItems  – list of pending requests for admin notification bell
 *   - empNotifications   – approved/rejected requests for employee notification bell
 *   - pollTick           – incrementing counter that components can watch to
 *                          re-fetch their own data (avoids central state bloat)
 *
 * Usage:
 *   Wrap <AppRoutes> with <PollProvider>.
 *   Inside any component: const { pollTick, adminPendingCount } = usePoll();
 *   Then put pollTick in a useEffect dependency array to auto-refresh.
 */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { apiGet, getToken } from "./api.js";
import { getAuthUser } from "./auth.js";

const POLL_INTERVAL = 5000; // 5 seconds

const PollContext = createContext({
  pollTick: 0,
  adminPendingCount: 0,
  adminPendingItems: [],
  empNotifications: [],
});

export const usePoll = () => useContext(PollContext);

export const PollProvider = ({ children }) => {
  const [pollTick, setPollTick] = useState(0);
  const [adminPendingCount, setAdminPendingCount] = useState(0);
  const [adminPendingItems, setAdminPendingItems] = useState([]);
  const [empNotifications, setEmpNotifications] = useState([]);
  const mountedRef = useRef(true);
  const tickRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;

    const poll = async () => {
      // ── Guard: skip if no token or no user ──
      const token = getToken();
      const user = getAuthUser();
      if (!token || !user) return;

      try {
        if (user.role === "ADMIN") {
          // ── Admin: count pending requests across all types ──
          const [requestData, leaveData, attendanceData] = await Promise.allSettled([
            apiGet("/requests?status=PENDING"),
            apiGet("/leave/admin/all?status=PENDING"),
            apiGet("/attendance/pending-approvals"),
          ]);

          const items = [
            ...(requestData.status === "fulfilled" ? requestData.value?.requests || [] : []),
            ...(leaveData.status === "fulfilled"
              ? (leaveData.value?.requests || []).map((r) => ({
                  id: `leave-${r.id}`,
                  subject: `${r.leaveType?.name || "Leave"} request`,
                  type: "LEAVE",
                  employee: { fullName: r.employee?.user?.fullName || "Employee" },
                }))
              : []),
            ...(attendanceData.status === "fulfilled"
              ? (attendanceData.value?.pendingRecords || []).map((r) => ({
                  id: `attendance-${r.id}`,
                  subject: "Attendance Approval",
                  type: "ATTENDANCE",
                  employee: { fullName: r.employee?.user?.fullName || "Employee" },
                }))
              : []),
          ];

          if (mountedRef.current) {
            setAdminPendingCount(items.length);
            setAdminPendingItems(items);
          }
        } else if (user.role === "EMPLOYEE") {
          // ── Employee: collect approved/rejected notifications ──
          const [requestData, leaveData, attendanceData] = await Promise.allSettled([
            apiGet("/requests/my"),
            apiGet("/leave/my"),
            apiGet("/attendance/my-requests"),
          ]);

          const rosterData = await apiGet("/roster/my-notifications").catch(() => ({ entries: [] }));

          const all = [
            ...(requestData.status === "fulfilled" ? requestData.value?.requests || [] : []),
            ...(leaveData.status === "fulfilled"
              ? (leaveData.value?.requests || []).map((r) => ({
                  ...r,
                  subject: `${r.leaveType?.name || "Leave"} request`,
                  type: "LEAVE",
                }))
              : []),
            ...(attendanceData.status === "fulfilled"
              ? (attendanceData.value?.records || []).map((r) => ({
                  ...r,
                  subject: "Attendance request",
                  type: "ATTENDANCE",
                  status:
                    r.status === "APPROVED" || r.note?.toLowerCase().includes("approved")
                      ? "APPROVED"
                      : r.status === "REJECTED" || r.note?.toLowerCase().includes("rejected")
                      ? "REJECTED"
                      : "PENDING",
                  createdAt: r.createdAt || r.date || r.updatedAt,
                }))
              : []),
            ...(Array.isArray(rosterData?.entries)
              ? rosterData.entries.map((e) => ({
                  id: e.id,
                  subject: "Roster assignment",
                  type: "ROSTER",
                  status: "ASSIGNED",
                  createdAt: e.updatedAt || e.date,
                  description: `${e.shift?.name || "Shift assigned"}${e.location?.name ? ` · ${e.location.name}` : ""}`,
                }))
              : []),
          ];

          const filtered = all
            .filter((r) => r.type === "ROSTER" || ["APPROVED", "REJECTED"].includes(r.status))
            .filter((r) => r.createdAt)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);

          if (mountedRef.current) {
            setEmpNotifications(filtered);
          }
        }
      } catch {
        // Silent — never crash the app on poll failure
      }

      // Always increment tick so subscribed pages re-fetch their own data
      if (mountedRef.current) {
        tickRef.current += 1;
        setPollTick(tickRef.current);
      }
    };

    // Initial poll immediately
    poll();

    const intervalId = window.setInterval(poll, POLL_INTERVAL);

    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <PollContext.Provider value={{ pollTick, adminPendingCount, adminPendingItems, empNotifications }}>
      {children}
    </PollContext.Provider>
  );
};
