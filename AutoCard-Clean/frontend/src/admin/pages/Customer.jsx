import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Loader2, Users, Building2, Phone, Eye, EyeOff } from "lucide-react";
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
  country: "",
};

const Customer = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const loadCustomers = async () => {
    console.log("🔄 [Frontend] Loading customers...");
    try {
      const data = await apiGet("/customers");
      console.log("✅ [Frontend] Customers loaded:", data.customers);
      console.log(`📊 [Frontend] Total customers: ${data.customers.length}`);
      setCustomers(data.customers);
    } catch (err) {
      console.error("❌ [Frontend] Failed to load customers:", err);
      toast.error(err.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadCustomers();
    })();
  }, []);

  // Validation function
  const validateForm = () => {
    const newErrors = {};

    // Full Name validation
    if (!form.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (form.fullName.trim().length < 3) {
      newErrors.fullName = "Full name must be at least 3 characters";
    } else if (!/^[A-Za-z\s]+$/.test(form.fullName)) {
      newErrors.fullName = "Full name can only contain letters and spaces";
    }

    // Email validation
    if (!form.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Password validation
    if (!form.password) {
      newErrors.password = "Password is required";
    } else if (form.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])|(?=.*[a-z])(?=.*[0-9])|(?=.*[A-Z])(?=.*[0-9])/.test(form.password)) {
      newErrors.password = "Password must contain at least 2 of: uppercase, lowercase, number";
    }

    // Company Name validation (optional but if provided)
    if (form.companyName && form.companyName.trim().length < 2) {
      newErrors.companyName = "Company name must be at least 2 characters if provided";
    }

    // Phone validation (optional but if provided)
    if (form.phone && !/^[+]?[\d\s()\-]{7,20}$/.test(form.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    
    // Clear previous errors
    setErrors({});
    
    // Validate form
    if (!validateForm()) {
      toast.error("Please fix the validation errors");
      return;
    }
    
    console.log("📤 [Frontend] Creating customer:", form);
    setSubmitting(true);
    
    try {
      const response = await apiPost("/customers", {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        companyName: form.companyName || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
      });
      
      console.log("✅ [Frontend] Customer created successfully:", response);
      toast.success(`Customer "${form.fullName}" created successfully!`);
      
      setForm(emptyForm);
      setErrors({});
      loadCustomers();
    } catch (err) {
      console.error("❌ [Frontend] Failed to create customer:", err);
      
      // Handle backend validation errors
      if (err.field && err.message) {
        setErrors({ [err.field]: err.message });
        toast.error(err.message);
      } else if (err.errors && Array.isArray(err.errors)) {
        const backendErrors = {};
        err.errors.forEach(error => {
          if (error.field) {
            backendErrors[error.field] = error.message;
          }
        });
        setErrors(backendErrors);
        toast.error("Please fix the validation errors");
      } else {
        toast.error(err.message || "Failed to create customer.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete customer "${name}"? This action cannot be undone.`)) {
      return;
    }

    console.log(`🗑️ [Frontend] Deleting customer: ${name} (${id})`);
    try {
      await apiDelete(`/customers/${id}`);
      console.log(`✅ [Frontend] Customer deleted: ${name}`);
      toast.success(`Customer "${name}" deleted.`);
      loadCustomers();
    } catch (err) {
      console.error(`❌ [Frontend] Failed to delete customer:`, err);
      toast.error(err.message || "Failed to delete customer.");
    }
  };

  const handleStatCardClick = (filter) => {
    navigate(`/admin/customer-list?filter=${filter}`);
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow";

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Customer Management</h1>
          <p className="text-sm text-muted-foreground">Create and manage customer accounts.</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          onClick={() => handleStatCardClick("all")} 
          className="cursor-pointer hover:scale-105 transition-transform rounded-2xl bg-background border-2 border-border card-shadow p-5 flex items-center gap-4"
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
            <Users className="h-5.5 w-5.5" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold leading-none">{customers.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Customers</div>
          </div>
        </div>
        <div 
          onClick={() => handleStatCardClick("company")} 
          className="cursor-pointer hover:scale-105 transition-transform rounded-2xl bg-background border-2 border-border card-shadow p-5 flex items-center gap-4"
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-600">
            <Building2 className="h-5.5 w-5.5" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold leading-none">
              {customers.filter((c) => c.companyName).length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Companies</div>
          </div>
        </div>
        <div 
          onClick={() => handleStatCardClick("contact")} 
          className="cursor-pointer hover:scale-105 transition-transform rounded-2xl bg-background border-2 border-border card-shadow p-5 flex items-center gap-4"
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 text-blue-600">
            <Phone className="h-5.5 w-5.5" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold leading-none">
              {customers.filter((c) => c.phone).length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">With Contact Info</div>
          </div>
        </div>
      </div>

      {/* Create form */}
      <div className="rounded-2xl bg-background border border-border card-shadow p-6">
        <h2 className="font-display text-lg font-semibold mb-4">Create New Customer</h2>
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Full Name <span className="text-destructive">*</span></label>
            <input
              className={`${inputClass} ${errors.fullName ? 'border-destructive focus:ring-destructive/30' : ''}`}
              placeholder="John Doe"
              value={form.fullName}
              onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
              required
            />
            {errors.fullName && (
              <p className="text-xs text-destructive mt-1">{errors.fullName}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email <span className="text-destructive">*</span></label>
            <input
              type="email"
              className={`${inputClass} ${errors.email ? 'border-destructive focus:ring-destructive/30' : ''}`}
              placeholder="john@company.com"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1">{errors.email}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Password <span className="text-destructive">*</span></label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className={`${inputClass} pr-10 ${errors.password ? 'border-destructive focus:ring-destructive/30' : ''}`}
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive mt-1">{errors.password}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Company Name <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              className={`${inputClass} ${errors.companyName ? 'border-destructive focus:ring-destructive/30' : ''}`}
              placeholder="Acme Corporation"
              value={form.companyName}
              onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
            />
            {errors.companyName && (
              <p className="text-xs text-destructive mt-1">{errors.companyName}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Phone <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              type="tel"
              className={`${inputClass} ${errors.phone ? 'border-destructive focus:ring-destructive/30' : ''}`}
              placeholder="+1 555 123 4567"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
            {errors.phone && (
              <p className="text-xs text-destructive mt-1">{errors.phone}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">City <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              className={inputClass}
              placeholder="New York"
              value={form.city}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Country <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              className={inputClass}
              placeholder="United States"
              value={form.country}
              onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Address <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              className={inputClass}
              placeholder="123 Main Street"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="cta-gradient text-white font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {submitting ? "Creating..." : "Create Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Customer;
