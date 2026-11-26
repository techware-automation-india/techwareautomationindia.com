import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  UserPlus,
  Loader2,
  Users,
  Eye,
  EyeOff,
  ArrowLeft,
  Building2,
  Mail,
  Lock,
  Phone,
  MapPin,
  Globe,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Send,
  Calendar,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";

const emptyForm = {
  fullName: "",
  email: "",
  password: "",
  companyName: "",
  phone: "",
  address: "",
  city: "",
  country: "India",
};

const Customer = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [customers, setCustomers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const loadData = async () => {
    try {
      const data = await apiGet("/customers");
      setCustomers(data.customers || []);
    } catch (err) {
      console.error("Failed to load customer statistics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = {
    total: customers.length,
    corporate: customers.filter((c) => c.companyName).length,
    withContact: customers.filter((c) => c.phone).length,
    active: customers.filter((c) => c.isActive).length,
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (form.fullName.trim().length < 3) {
      newErrors.fullName = "Full name must be at least 3 characters";
    } else if (!/^[A-Za-z\s]+$/.test(form.fullName)) {
      newErrors.fullName = "Full name can only contain letters and spaces";
    }

    if (!form.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!form.password) {
      newErrors.password = "Password is required";
    } else if (form.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])|(?=.*[a-z])(?=.*[0-9])|(?=.*[A-Z])(?=.*[0-9])/.test(form.password)) {
      newErrors.password = "Must contain at least 2 of: uppercase, lowercase, number";
    }

    if (form.companyName && form.companyName.trim().length < 2) {
      newErrors.companyName = "Company name must be at least 2 characters if provided";
    }

    if (form.phone && !/^[+]?[\d\s()\-]{7,20}$/.test(form.phone)) {
      newErrors.phone = "Please enter a valid phone number (7-20 digits)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setErrors({});

    if (!validateForm()) {
      toast.error("Please fill all required fields correctly");
      return;
    }

    setSubmitting(true);

    try {
      await apiPost("/customers", {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        companyName: form.companyName || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
      });

      toast.success(`Customer "${form.fullName}" created successfully! Welcome email sent.`);
      setForm(emptyForm);
      setErrors({});
      loadData();
      navigate("/admin/customer-list");
    } catch (err) {
      console.error("Failed to create customer:", err);
      if (err.field && err.message) {
        setErrors((p) => ({ ...p, [err.field]: err.message }));
        toast.error(err.message);
      } else {
        toast.error(err.message || "Failed to create customer account.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:bg-background text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all";

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header matching Add Account / Employee */}
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={() => navigate("/admin/customer-hub")}
          className="p-2.5 rounded-xl border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer shadow-xs"
          aria-label="Back to Customer Hub"
          title="Back to Customer Hub"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
            Add Customer Account
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Register new customer portal accounts, corporate credentials, and factory installation sites.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards matching Add Account */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => navigate("/admin/customer-list?filter=all")}
          className="rounded-2xl bg-card border border-border card-shadow p-5 flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition-transform"
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
            <Users className="h-5.5 w-5.5" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold leading-none">{stats.total}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Customers</div>
          </div>
        </div>

        <div
          onClick={() => navigate("/admin/customer-list?filter=company")}
          className="rounded-2xl bg-card border border-border card-shadow p-5 flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition-transform"
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Building2 className="h-5.5 w-5.5" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold leading-none">{stats.corporate}</div>
            <div className="text-xs text-muted-foreground mt-1">Corporate Units</div>
          </div>
        </div>

        <div
          onClick={() => navigate("/admin/customer-list?filter=contact")}
          className="rounded-2xl bg-card border border-border card-shadow p-5 flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition-transform"
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
            <Phone className="h-5.5 w-5.5" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold leading-none">{stats.withContact}</div>
            <div className="text-xs text-muted-foreground mt-1">Phone Verified</div>
          </div>
        </div>

        <div
          onClick={() => navigate("/admin/customer-list")}
          className="rounded-2xl bg-card border border-border card-shadow p-5 flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition-transform"
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            <ShieldCheck className="h-5.5 w-5.5" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold leading-none">{stats.active}</div>
            <div className="text-xs text-muted-foreground mt-1">Active Portals</div>
          </div>
        </div>
      </div>

      {/* Main Creation Form Card */}
      <div className="rounded-2xl bg-card border border-border shadow-xs p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-border/80">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Create Customer Account</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fill in client credentials below. A welcome email containing login credentials will be delivered.
            </p>
          </div>
          <Link
            to="/admin/customer-list"
            className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Open Customer Directory &rarr;</span>
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Full Name */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                Contact Person Name <span className="text-destructive">*</span>
              </label>
              <input
                className={`${inputClass} ${errors.fullName ? "border-destructive" : ""}`}
                placeholder="e.g. Rajesh Sharma"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                required
              />
              {errors.fullName && <p className="text-xs text-destructive mt-1">{errors.fullName}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                Official Email (Username) <span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                className={`${inputClass} ${errors.email ? "border-destructive" : ""}`}
                placeholder="rajesh@company.com"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                required
              />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                Default Password <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className={`${inputClass} pr-10 ${errors.password ? "border-destructive" : ""}`}
                  placeholder="Min 6 characters (uppercase, number)"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
            </div>

            {/* Company Name */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                Company / Plant Name
              </label>
              <input
                className={`${inputClass} ${errors.companyName ? "border-destructive" : ""}`}
                placeholder="e.g. Apex Industrial Automation Ltd"
                value={form.companyName}
                onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
              />
              {errors.companyName && <p className="text-xs text-destructive mt-1">{errors.companyName}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                Phone / Mobile
              </label>
              <input
                type="tel"
                className={`${inputClass} ${errors.phone ? "border-destructive" : ""}`}
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
              {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
            </div>

            {/* City */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                City / Industrial Area
              </label>
              <input
                className={inputClass}
                placeholder="Ahmedabad / Pune"
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              />
            </div>

            {/* Country */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                Country
              </label>
              <input
                className={inputClass}
                placeholder="India"
                value={form.country}
                onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
              />
            </div>

            {/* Address */}
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                Plant / Factory Site Address
              </label>
              <input
                className={inputClass}
                placeholder="Plot No. 42, GIDC Industrial Estate, Phase 2"
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => navigate("/admin/customer-hub")}
              className="px-5 py-2.5 rounded-xl border border-border bg-background hover:bg-secondary text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-white font-semibold text-xs shadow-xs hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating Customer...</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>Create Customer Account</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Customer;
