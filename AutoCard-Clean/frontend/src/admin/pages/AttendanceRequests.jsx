import { useEffect, useState } from "react";
import { ArrowLeft, Check, Clock, Loader2, MapPin, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";

const fmtDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
};

const fmtTime = (value) => value
  ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  : "—";

const extractReason = (note) => {
  const match = note?.match(/Reason:\s*(.*?)(?:\.\s*Pending admin approval|\.|$)/i);
  return match?.[1]?.trim() || note || "No reason provided.";
};

const openGoogleMap = (request) => {
  const latitude = Number(request.checkInLatitude ?? request.checkOutLatitude);
  const longitude = Number(request.checkInLongitude ?? request.checkOutLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    toast.error("Location coordinates are not available for this request.");
    return;
  }
  window.open(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`, "_blank", "noopener,noreferrer");
};

const AttendanceRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);

  const loadRequests = async () => {
    try {
      const data = await apiGet("/attendance/pending-approvals");
      setRequests(data.pendingRecords || []);
    } catch (err) {
      toast.error(err.message || "Failed to load attendance requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    const intervalId = window.setInterval(loadRequests, 10000);
    return () => window.clearInterval(intervalId);
  }, []);

  const approve = async (id) => {
    setActingId(id);
    try {
      await apiPost(`/attendance/${id}/approve`);
      toast.success("Attendance request approved.");
      await loadRequests();
    } catch (err) {
      toast.error(err.message || "Failed to approve request.");
    } finally {
      setActingId(null);
    }
  };

  const reject = async (id) => {
    setActingId(id);
    try {
      await apiPost(`/attendance/${id}/reject`, { reason: "Unassigned location request rejected by admin." });
      toast.success("Attendance request rejected.");
      await loadRequests();
    } catch (err) {
      toast.error(err.message || "Failed to reject request.");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate("/admin/attendance")}
            className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Attendance
          </button>
          <h1 className="font-display text-2xl font-bold">Attendance Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review check-in and check-out requests from unassigned locations.</p>
        </div>
        <div className="rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">Awaiting Approval</div>
          <div className="mt-1 font-display text-2xl font-bold text-rose-900">{requests.length}</div>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-rose-200 bg-background card-shadow overflow-hidden">
        <div className="border-b border-rose-200 bg-rose-50 px-6 py-4">
          <div className="flex items-center gap-2 font-display font-bold text-rose-900">
            <Clock className="h-5 w-5" /> Pending location requests
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No attendance requests are waiting for approval.</div>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((request) => (
              <div key={request.id} className="p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div>
                      <h2 className="font-display text-lg font-bold">{request.employee?.user?.fullName || "Employee"}</h2>
                      <p className="text-xs text-muted-foreground">{request.employee?.employeeCode || request.employee?.user?.email || "—"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div><div className="text-xs text-muted-foreground">Date</div><div className="font-medium">{fmtDate(request.date)}</div></div>
                      <div><div className="text-xs text-muted-foreground">Check In</div><div className="font-medium">{fmtTime(request.checkIn)}</div></div>
                      <div><div className="text-xs text-muted-foreground">Check Out</div><div className="font-medium">{fmtTime(request.checkOut)}</div></div>
                      <div><div className="text-xs text-muted-foreground">Status</div><div className="font-semibold text-amber-700">Awaiting Approval</div></div>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                      <div className="mb-1 font-semibold">Submitted reason</div>
                      {extractReason(request.note)}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                    <button type="button" onClick={() => approve(request.id)} disabled={actingId === request.id} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                      {actingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
                    </button>
                    <button type="button" onClick={() => reject(request.id)} disabled={actingId === request.id} className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                      <X className="h-4 w-4" /> Reject
                    </button>
                    <button type="button" onClick={() => openGoogleMap(request)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-100 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-200">
                      <MapPin className="h-4 w-4" /> Review map
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceRequests;
