import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Inbox } from "lucide-react";
import { apiGet } from "../../lib/api.js";
import { adminModules } from "../modules.js";

const Overview = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Exclude the overview entry itself from the module grid.
  const modules = adminModules.filter((m) => m.key !== "overview");

  useEffect(() => {
    const loadPendingRequests = async () => {
      try {
        const [requestData, leaveData, attendanceData] = await Promise.all([
          apiGet("/requests?status=PENDING"),
          apiGet("/leave/admin/all?status=PENDING"),
          apiGet("/attendance/pending-approvals"),
        ]);
        const requests = [
          ...(requestData.requests || []),
          ...(leaveData.requests || []).map((request) => ({
            id: `leave-${request.id}`,
            subject: `${request.leaveType?.name || "Leave"} request`,
            type: "LEAVE",
            employee: { fullName: request.employee?.user?.fullName || "Employee" },
          })),
          ...(attendanceData.pendingRecords || []).map((request) => ({
            id: `attendance-${request.id}`,
            subject: "Attendance location approval",
            type: "ATTENDANCE",
            path: "/admin/attendance-requests",
            employee: { fullName: request.employee?.user?.fullName || "Employee" },
          })),
        ];
        setPendingRequests(requests);
        setPendingCount(requests.length);
      } catch {
        setPendingRequests([]);
        setPendingCount(0);
      }
    };

    loadPendingRequests();
    const intervalId = window.setInterval(loadPendingRequests, 3000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
             Select a module to manage your organization.
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications((visible) => !visible)}
            className={`relative rounded-lg border p-3 transition-colors hover:bg-secondary ${
              pendingCount > 0
                ? "border-rose-200 text-rose-500 hover:text-rose-600"
                : "border-emerald-200 text-emerald-500 hover:text-emerald-600"
            }`}
            aria-label={`Notifications${pendingCount ? `, ${pendingCount} pending` : ""}`}
            title="Notifications"
          >
            <Bell className="h-6 w-6" />
            {pendingCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-full z-20 mt-3 w-72 rounded-xl border border-border bg-background p-4 shadow-lg">
              <div className="flex items-center gap-2 font-semibold">
                <Inbox className="h-4 w-4 text-primary" />
                Notifications
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {pendingCount > 0
                  ? `${pendingCount} employee request${pendingCount === 1 ? "" : "s"} waiting for review.`
                  : "No pending employee requests."}
              </p>
              {pendingRequests.length > 0 && (
                <div className="mt-3 max-h-52 space-y-2 overflow-y-auto border-t border-border pt-3">
                  {pendingRequests.map((request) => (
                    <Link
                      key={request.id}
                      to={request.path || "/admin/requests"}
                      onClick={() => setShowNotifications(false)}
                      className="block rounded-lg bg-secondary/60 p-2.5 text-sm hover:bg-secondary"
                    >
                      <div className="font-semibold">{request.subject}</div>
                      <div className="text-xs text-muted-foreground">
                        {request.employee?.fullName || "Employee"} · {request.type}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Link
                to="/admin/requests"
                onClick={() => setShowNotifications(false)}
                className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline"
              >
                Open Requests
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map(({ key, label, path, icon: Icon, description }) => (
          <Link
            key={key}
            to={path}
            className="group rounded-2xl bg-background border border-border p-6 card-shadow hover:card-shadow-hover hover:border-primary/30 transition-all duration-300"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <Icon className="h-5.5 w-5.5 text-primary" />
            </div>
            <h3 className="font-display font-semibold mb-1">{label}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Overview;
