import { useEffect, useState, useMemo } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import {
  Loader2,
  RefreshCw,
  ArrowLeft,
  Trash2,
  AlertTriangle,
  Building2,
  Phone,
  MapPin,
  Users,
  Edit,
  X,
  Key,
  Eye,
  EyeOff,
  Search,
  UserPlus,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiDelete, apiPut, apiPost } from "../../lib/api.js";

const CustomerList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterType = searchParams.get("filter");

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(filterType || "all");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [updating, setUpdating] = useState(false);
  const [editErrors, setEditErrors] = useState({});
  const [resetPasswordTarget, setResetPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const loadCustomers = async () => {
    try {
      const data = await apiGet("/customers");
      setCustomers(data.customers || []);
    } catch (err) {
      console.error("Failed to load customers:", err);
      toast.error(err.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    setLoading(true);
    loadCustomers();
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      await apiDelete(`/customers/${deleteTarget.id}`);
      toast.success(`Customer "${deleteTarget.fullName}" deleted successfully.`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      console.error("Failed to delete customer:", err);
      toast.error(err.message || "Failed to delete customer.");
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = (customer) => {
    setEditTarget(customer);
    setEditForm({
      fullName: customer.fullName,
      companyName: customer.companyName || "",
      phone: customer.phone || "",
      address: customer.address || "",
      city: customer.city || "",
      country: customer.country || "",
      isActive: customer.isActive,
    });
    setEditErrors({});
  };

  const validateEditForm = () => {
    const newErrors = {};

    if (!editForm.fullName?.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (editForm.fullName.trim().length < 3) {
      newErrors.fullName = "Full name must be at least 3 characters";
    }

    if (editForm.companyName && editForm.companyName.trim().length < 2) {
      newErrors.companyName = "Company name must be at least 2 characters";
    }

    if (editForm.phone && !/^[+]?[\d\s()\-]{7,20}$/.test(editForm.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    setEditErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async () => {
    if (!editTarget) return;

    if (!validateEditForm()) {
      toast.error("Please fix the validation errors");
      return;
    }

    setUpdating(true);
    try {
      await apiPut(`/customers/${editTarget.id}`, editForm);
      toast.success(`Customer "${editForm.fullName}" updated successfully!`);
      setEditTarget(null);
      refresh();
    } catch (err) {
      console.error("Failed to update customer:", err);
      toast.error(err.message || "Failed to update customer.");
    } finally {
      setUpdating(false);
    }
  };

  const handleResetPassword = (customer) => {
    setResetPasswordTarget(customer);
    setNewPassword("");
    setPasswordError("");
    setShowNewPassword(false);
  };

  const submitResetPassword = async () => {
    if (!resetPasswordTarget) return;

    if (!newPassword) {
      setPasswordError("Password is required");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    setResettingPassword(true);
    try {
      await apiPost(`/customers/${resetPasswordTarget.id}/reset-password`, {
        password: newPassword,
      });
      toast.success(`Password reset successfully for "${resetPasswordTarget.fullName}"!`);
      setResetPasswordTarget(null);
      setNewPassword("");
    } catch (err) {
      console.error("Failed to reset password:", err);
      setPasswordError(err.message || "Failed to reset password.");
      toast.error(err.message || "Failed to reset password.");
    } finally {
      setResettingPassword(false);
    }
  };

  // Filter & Search Logic
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // Tab filter
      if (activeTab === "company" && !c.companyName) return false;
      if (activeTab === "contact" && !c.phone) return false;
      if (activeTab === "active" && !c.isActive) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = c.fullName?.toLowerCase().includes(query);
        const matchEmail = c.email?.toLowerCase().includes(query);
        const matchCompany = c.companyName?.toLowerCase().includes(query);
        const matchPhone = c.phone?.toLowerCase().includes(query);
        const matchCity = c.city?.toLowerCase().includes(query);
        return matchName || matchEmail || matchCompany || matchPhone || matchCity;
      }

      return true;
    });
  }, [customers, activeTab, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => navigate("/admin/customer-hub")}
            className="p-2 rounded-xl border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-xs"
            aria-label="Back to Customer Hub"
            title="Back to Customer Hub"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Customer Management</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">Directory</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Customer Directory
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-secondary text-xs font-medium text-foreground transition-colors cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            to="/admin/customer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold shadow-xs hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <UserPlus className="h-4 w-4" />
            Onboard New Client
          </Link>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Quick Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/50 border border-border w-fit overflow-x-auto">
          {[
            { key: "all", label: "All Clients", count: customers.length },
            { key: "company", label: "Corporate", count: customers.filter((c) => c.companyName).length },
            { key: "contact", label: "With Phone", count: customers.filter((c) => c.phone).length },
            { key: "active", label: "Active", count: customers.filter((c) => c.isActive).length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email, company, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Customers Table / Card Container */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs">Loading customer directory...</span>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-16 text-center">
            <div className="h-12 w-12 rounded-2xl bg-secondary/80 flex items-center justify-center mx-auto mb-3 text-muted-foreground">
              <Users className="h-6 w-6 opacity-60" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">No customers found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No records matching "${searchQuery}". Try clearing search filters.`
                : "No customer accounts registered in this category yet."}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="mt-3 text-xs text-primary font-medium hover:underline cursor-pointer"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/80 bg-secondary/40 text-left uppercase tracking-wider text-[11px] font-semibold text-muted-foreground">
                  <th className="px-5 py-3.5">Customer & Organization</th>
                  <th className="px-5 py-3.5">Contact Details</th>
                  <th className="px-5 py-3.5">Location</th>
                  <th className="px-5 py-3.5">Account Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-secondary/30 transition-colors group"
                  >
                    {/* Customer & Organization */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-linear-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-xs shrink-0">
                          {customer.fullName?.charAt(0)?.toUpperCase() || "C"}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                            {customer.fullName}
                          </div>
                          {customer.companyName ? (
                            <div className="text-muted-foreground flex items-center gap-1 mt-0.5 font-medium">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span>{customer.companyName}</span>
                            </div>
                          ) : (
                            <div className="text-muted-foreground/60 text-[11px] mt-0.5">Individual Account</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact Details */}
                    <td className="px-5 py-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-foreground">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{customer.email}</span>
                        </div>
                        {customer.phone && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{customer.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Location */}
                    <td className="px-5 py-3.5">
                      {customer.city || customer.country ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[180px]">
                            {[customer.city, customer.country].filter(Boolean).join(", ")}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                          customer.isActive
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${customer.isActive ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                        {customer.isActive ? "Active Portal Access" : "Suspended"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="p-1.5 rounded-lg border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="Edit details"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleResetPassword(customer)}
                          className="p-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer"
                          title="Reset Password"
                        >
                          <Key className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(customer)}
                          className="p-1.5 rounded-lg border border-destructive/30 bg-destructive/5 hover:bg-destructive/15 text-destructive transition-colors cursor-pointer"
                          title="Delete Account"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Customer Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-xs">
          <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Edit className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Edit Customer Profile</h3>
                  <p className="text-xs text-muted-foreground">{editTarget.email}</p>
                </div>
              </div>
              <button
                onClick={() => setEditTarget(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div>
                <label className="font-medium text-foreground mb-1 block">Full Name *</label>
                <input
                  value={editForm.fullName || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                />
                {editErrors.fullName && <p className="text-destructive mt-1">{editErrors.fullName}</p>}
              </div>

              <div>
                <label className="font-medium text-foreground mb-1 block">Company Name</label>
                <input
                  value={editForm.companyName || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, companyName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-foreground mb-1 block">Phone</label>
                  <input
                    value={editForm.phone || ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                  />
                </div>
                <div>
                  <label className="font-medium text-foreground mb-1 block">City</label>
                  <input
                    value={editForm.city || ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-foreground mb-1 block">Plant / Factory Address</label>
                <input
                  value={editForm.address || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border">
                <div>
                  <span className="font-medium text-foreground block">Customer Portal Status</span>
                  <span className="text-[11px] text-muted-foreground">Allow login to customer dashboard</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isActive ?? true}
                    onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-border flex justify-end gap-2 bg-secondary/20">
              <button
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 rounded-xl border border-border bg-background text-xs font-medium hover:bg-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={updating}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {updating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-xs">
          <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <Key className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Reset Password</h3>
                  <p className="text-xs text-muted-foreground">{resetPasswordTarget.fullName}</p>
                </div>
              </div>
              <button
                onClick={() => setResetPasswordTarget(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                Enter a new password for this customer. An updated credentials notification will be prepared.
              </p>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter at least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordError && <p className="text-destructive">{passwordError}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => setResetPasswordTarget(null)}
                className="px-4 py-2 rounded-xl border border-border bg-background text-xs font-medium hover:bg-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={submitResetPassword}
                disabled={resettingPassword}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {resettingPassword && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Set Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-xs">
          <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">Confirm Account Deletion</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Are you sure you want to delete customer <strong>{deleteTarget.fullName}</strong>?
                  This action removes their account access and profile records permanently.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-5 pt-3 border-t border-border">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl border border-border bg-background text-xs font-medium hover:bg-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerList;
