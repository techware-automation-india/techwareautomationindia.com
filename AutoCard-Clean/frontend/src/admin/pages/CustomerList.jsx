import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, RefreshCw, ArrowLeft, Trash2, AlertTriangle, Building2, Phone, MapPin, Users, Edit, X, Key, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiDelete, apiPut, apiPost } from "../../lib/api.js";

const CustomerList = () => {
  const [searchParams] = useSearchParams();
  const filterType = searchParams.get("filter"); // Get filter from URL: 'all', 'company', 'contact'
  
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
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
    console.log("🔄 [Frontend] Loading customers...");
    try {
      const data = await apiGet("/customers");
      console.log("✅ [Frontend] Customers loaded:", data.customers);
      setCustomers(data.customers);
    } catch (err) {
      console.error("❌ [Frontend] Failed to load customers:", err);
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
    
    console.log("🗑️ [Frontend] Deleting customer:", deleteTarget);
    setDeleting(true);
    
    try {
      await apiDelete(`/customers/${deleteTarget.id}`);
      console.log("✅ [Frontend] Customer deleted successfully");
      toast.success(`Customer "${deleteTarget.fullName}" deleted.`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      console.error("❌ [Frontend] Failed to delete customer:", err);
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

    if (!editForm.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (editForm.fullName.trim().length < 3) {
      newErrors.fullName = "Full name must be at least 3 characters";
    }

    if (editForm.companyName && editForm.companyName.trim().length < 2) {
      newErrors.companyName = "Company name must be at least 2 characters if provided";
    }

    if (editForm.phone && !/^[+]?[\d\s()\-]{7,20}$/.test(editForm.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    setEditErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async () => {
    if (!editTarget || updating) return;

    if (!validateEditForm()) {
      toast.error("Please fix the validation errors");
      return;
    }

    console.log("📝 [Frontend] Updating customer:", editTarget.id);
    setUpdating(true);

    try {
      await apiPut(`/customers/${editTarget.id}`, {
        fullName: editForm.fullName,
        companyName: editForm.companyName || undefined,
        phone: editForm.phone || undefined,
        address: editForm.address || undefined,
        city: editForm.city || undefined,
        country: editForm.country || undefined,
        isActive: editForm.isActive,
      });

      console.log("✅ [Frontend] Customer updated successfully");
      toast.success(`Customer "${editForm.fullName}" updated successfully!`);
      setEditTarget(null);
      setEditForm({});
      refresh();
    } catch (err) {
      console.error("❌ [Frontend] Failed to update customer:", err);
      if (err.field && err.message) {
        setEditErrors({ [err.field]: err.message });
        toast.error(err.message);
      } else {
        toast.error(err.message || "Failed to update customer.");
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleResetPassword = (customer) => {
    setResetPasswordTarget(customer);
    setNewPassword("");
    setShowNewPassword(false);
    setPasswordError("");
  };

  const validatePassword = (password) => {
    if (!password) {
      return "Password is required";
    }
    if (password.length < 6) {
      return "Password must be at least 6 characters";
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])|(?=.*[a-z])(?=.*[0-9])|(?=.*[A-Z])(?=.*[0-9])/.test(password)) {
      return "Password must contain at least 2 of: uppercase, lowercase, number";
    }
    return "";
  };

  const handleConfirmResetPassword = async () => {
    if (!resetPasswordTarget || resettingPassword) return;

    const error = validatePassword(newPassword);
    if (error) {
      setPasswordError(error);
      toast.error(error);
      return;
    }

    console.log("🔑 [Frontend] Resetting password for customer:", resetPasswordTarget.id);
    setResettingPassword(true);

    try {
      await apiPost(`/customers/${resetPasswordTarget.id}/reset-password`, {
        password: newPassword,
      });

      console.log("✅ [Frontend] Password reset successfully");
      toast.success(`Password reset successfully for "${resetPasswordTarget.fullName}"!`);
      setResetPasswordTarget(null);
      setNewPassword("");
    } catch (err) {
      console.error("❌ [Frontend] Failed to reset password:", err);
      if (err.field && err.message) {
        setPasswordError(err.message);
        toast.error(err.message);
      } else {
        toast.error(err.message || "Failed to reset password.");
      }
    } finally {
      setResettingPassword(false);
    }
  };

  // Filter customers based on URL parameter
  const filteredCustomers = () => {
    if (filterType === "company") {
      return customers.filter((c) => c.companyName);
    } else if (filterType === "contact") {
      return customers.filter((c) => c.phone);
    }
    return customers; // 'all' or no filter
  };

  // Get title based on filter
  const getPageTitle = () => {
    if (filterType === "company") return "Customers with Company";
    if (filterType === "contact") return "Customers with Contact Info";
    return "All Customers";
  };

  const displayedCustomers = filteredCustomers();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link 
            to="/admin/customer" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Customer Module
          </Link>
          <h1 className="font-display text-2xl font-bold">{getPageTitle()}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Showing {displayedCustomers.length} {displayedCustomers.length === 1 ? 'customer' : 'customers'}
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background hover:bg-secondary transition-colors text-sm font-medium"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Customer List Table */}
      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
          </div>
        ) : displayedCustomers.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            {filterType === "company" 
              ? "No customers with company name found." 
              : filterType === "contact"
              ? "No customers with contact info found."
              : "No customers found."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border bg-secondary/30">
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Company</th>
                  <th className="px-6 py-4 font-medium">Phone</th>
                  <th className="px-6 py-4 font-medium">Location</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors">
                    <td className="px-6 py-4 font-medium">{customer.fullName}</td>
                    <td className="px-6 py-4 text-muted-foreground">{customer.email}</td>
                    <td className="px-6 py-4">
                      {customer.companyName ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{customer.companyName}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {customer.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{customer.phone}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {customer.city || customer.country ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{[customer.city, customer.country].filter(Boolean).join(", ")}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        customer.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        {customer.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                          title="Edit customer"
                        >
                          <Edit className="h-4 w-4" /> Edit
                        </button>
                        <button
                          onClick={() => handleResetPassword(customer)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-amber-100 hover:text-amber-700 transition-colors"
                          title="Reset password"
                        >
                          <Key className="h-4 w-4" /> Reset
                        </button>
                        <button
                          onClick={() => setDeleteTarget(customer)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title="Delete customer"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
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

      {/* Reset Password Modal */}
      {resetPasswordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => !resettingPassword && setResetPasswordTarget(null)} />
          <div className="relative bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Key className="h-5.5 w-5.5 text-amber-700" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-semibold text-lg">Reset Password</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Set a new password for <strong>{resetPasswordTarget.fullName}</strong>
                  {resetPasswordTarget.companyName && ` from ${resetPasswordTarget.companyName}`}
                </p>
              </div>
              <button
                onClick={() => !resettingPassword && setResetPasswordTarget(null)}
                disabled={resettingPassword}
                className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <label className="text-sm font-medium mb-1.5 block">New Password <span className="text-destructive">*</span></label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  className={`w-full px-4 py-2.5 pr-10 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow ${
                    passwordError ? 'border-destructive focus:ring-destructive/30' : 'border-border'
                  }`}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleConfirmResetPassword();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs text-destructive mt-1">{passwordError}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Password must be at least 6 characters and contain at least 2 of: uppercase, lowercase, number
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setResetPasswordTarget(null)}
                disabled={resettingPassword}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background hover:bg-secondary text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResetPassword}
                disabled={resettingPassword}
                className="flex-1 px-4 py-2.5 rounded-lg bg-amber-600 text-white hover:opacity-90 text-sm font-medium transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resettingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                {resettingPassword ? "Resetting..." : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => !updating && setEditTarget(null)} />
          <div className="relative bg-background rounded-2xl border border-border shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Edit className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold">Edit Customer</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Update customer information</p>
                </div>
              </div>
              <button
                onClick={() => !updating && setEditTarget(null)}
                disabled={updating}
                className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Full Name <span className="text-destructive">*</span></label>
                  <input
                    className={`w-full px-4 py-2.5 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow ${
                      editErrors.fullName ? 'border-destructive focus:ring-destructive/30' : 'border-border'
                    }`}
                    placeholder="John Doe"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
                  />
                  {editErrors.fullName && (
                    <p className="text-xs text-destructive mt-1">{editErrors.fullName}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Company Name</label>
                  <input
                    className={`w-full px-4 py-2.5 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow ${
                      editErrors.companyName ? 'border-destructive focus:ring-destructive/30' : 'border-border'
                    }`}
                    placeholder="Acme Corporation"
                    value={editForm.companyName}
                    onChange={(e) => setEditForm((p) => ({ ...p, companyName: e.target.value }))}
                  />
                  {editErrors.companyName && (
                    <p className="text-xs text-destructive mt-1">{editErrors.companyName}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Phone</label>
                  <input
                    type="tel"
                    className={`w-full px-4 py-2.5 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow ${
                      editErrors.phone ? 'border-destructive focus:ring-destructive/30' : 'border-border'
                    }`}
                    placeholder="+1 555 123 4567"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                  {editErrors.phone && (
                    <p className="text-xs text-destructive mt-1">{editErrors.phone}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">City</label>
                  <input
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                    placeholder="New York"
                    value={editForm.city}
                    onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Country</label>
                  <input
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                    placeholder="United States"
                    value={editForm.country}
                    onChange={(e) => setEditForm((p) => ({ ...p, country: e.target.value }))}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">Address</label>
                  <input
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                    placeholder="123 Main Street"
                    value={editForm.address}
                    onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
                    />
                    <span className="text-sm font-medium">Account Active</span>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1 ml-6">
                    Inactive customers cannot log in to the portal
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-border flex items-center justify-end gap-3">
              <button
                onClick={() => setEditTarget(null)}
                disabled={updating}
                className="px-4 py-2.5 rounded-lg border border-border bg-background hover:bg-secondary text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={updating}
                className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-sm font-medium transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit className="h-4 w-4" />}
                {updating ? "Updating..." : "Update Customer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5.5 w-5.5 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-semibold text-lg">Delete Customer</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Are you sure you want to delete <strong>{deleteTarget.fullName}</strong>
                  {deleteTarget.companyName && ` from ${deleteTarget.companyName}`}? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background hover:bg-secondary text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 text-sm font-medium transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerList;
