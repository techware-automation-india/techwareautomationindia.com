import { useState, useEffect } from "react";
import { FileText, Plus, X, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";

const Requests = () => {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState([]);
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    priority: "MEDIUM",
  });

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/customers/me/requests");
      setRequests(data.requests || []);
    } catch (err) {
      console.error("Failed to load requests:", err);
      toast.error(err.message || "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      PENDING: "bg-amber-100 text-amber-700 border-amber-200",
      IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
      RESOLVED: "bg-green-100 text-green-700 border-green-200",
      REJECTED: "bg-red-100 text-red-700 border-red-200",
      APPROVED: "bg-green-100 text-green-700 border-green-200",
    };
    return colors[status] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      LOW: "bg-gray-100 text-gray-700",
      MEDIUM: "bg-blue-100 text-blue-700",
      HIGH: "bg-red-100 text-red-700",
    };
    return colors[priority] || "bg-gray-100 text-gray-700";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.subject.trim() || !formData.description.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      await apiPost("/customers/me/requests", formData);
      toast.success("Request submitted successfully!");
      setShowForm(false);
      setFormData({ subject: "", description: "", priority: "MEDIUM" });
      loadRequests(); // Reload requests list
    } catch (err) {
      console.error("Failed to submit request:", err);
      toast.error(err.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Requests</h1>
            <p className="text-sm text-muted-foreground">Submit and track your service requests</p>
          </div>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity text-sm"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "New Request"}
        </button>
      </div>

      {/* New Request Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl bg-background border border-border card-shadow p-6 space-y-4">
          <h3 className="font-semibold text-lg">Submit New Request</h3>

          <div>
            <label className="block text-sm font-medium mb-2">
              Subject <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Brief description of your request"
              className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Description <span className="text-destructive">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide detailed information about your request"
              rows={5}
              className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={submitting}
              className="px-6 py-2 rounded-lg border border-border bg-background hover:bg-secondary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Requests List */}
      <div className="space-y-4">
        {requests.length === 0 ? (
          <div className="rounded-2xl bg-background border border-border card-shadow p-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <h3 className="font-semibold text-lg mb-2">No Requests Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You haven't submitted any service requests. Click "New Request" to get started.
            </p>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-6 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" />
                Create Your First Request
              </button>
            )}
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="rounded-2xl bg-background border border-border card-shadow overflow-hidden"
            >
              <div className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">{request.subject}</h3>
                    {request.service && (
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          {request.service.name}
                        </span>
                        {request.service.category && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-secondary text-muted-foreground text-xs font-medium">
                            {request.service.category}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">{request.description}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                        request.status
                      )}`}
                    >
                      {request.status.replace("_", " ")}
                    </span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                      {request.priority}
                    </span>
                  </div>
                </div>

                {/* Response */}
                {request.response && (
                  <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Response from Support Team:</div>
                    <div className="text-sm">{request.response}</div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-border text-xs text-muted-foreground">
                  <span>Submitted: {new Date(request.createdAt).toLocaleDateString()}</span>
                  <span>Request ID: #{request.id}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Requests;
