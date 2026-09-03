import { useState } from "react";
import { useParams, useNavigate, Navigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ShieldCheck, Briefcase, User, Mail, Lock, ArrowLeft, LogIn, Eye, EyeOff, Loader2 } from "lucide-react";
import { apiPost } from "../lib/api.js";
import { saveAuth } from "../lib/auth.js";

const roleConfig = {
  admin: {
    label: "Admin",
    title: "Admin Login",
    subtitle: "Access the system administration dashboard",
    icon: ShieldCheck,
    accent: "from-blue-500 to-cyan-400",
  },
  employee: {
    label: "Employee",
    title: "Employee Login",
    subtitle: "Sign in to your staff dashboard",
    icon: Briefcase,
    accent: "from-amber-500 to-orange-400",
  },
  customer: {
    label: "Customer",
    title: "Customer Login",
    subtitle: "Track your orders and access support",
    icon: User,
    accent: "from-emerald-500 to-green-400",
  },
};

const Login = () => {
  const { role } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const config = roleConfig[role];

  // Redirect unknown roles back to home
  if (!config) {
    return <Navigate to="/" replace />;
  }

  const Icon = config.icon;

  // Determine login field label and type based on role
  const loginFieldConfig = role === "employee" 
    ? { label: "Username", placeholder: "Enter your username", type: "text", icon: User }
    : { label: "Email", placeholder: "Email address", type: "email", icon: Mail };

  const dashboardPath = {
    admin: "/admin",
    employee: "/employee",
    customer: "/customer",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      // Verify credentials against the backend. The server also confirms the
      // account's role matches this login portal, so customer credentials
      // cannot be used on the admin login (and so on).
      const data = await apiPost("/auth/login", {
        email: formData.email,
        password: formData.password,
        role,
      });

      // Persist the authenticated session for use across the app.
      saveAuth(data.token, data.user);

      if (role === "employee") {
        navigate("/employee");
      } else {
        navigate(dashboardPath[role]);
      }

      toast.success(`Welcome back, ${data.user.fullName}.`);
    } catch (err) {
      toast.error(err.message || "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full pl-11 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow";

  return (
    <div className="min-h-screen flex items-center justify-center bg-card/30 relative overflow-hidden px-4">
      <div className="absolute inset-0 grid-overlay opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <div className="rounded-2xl bg-background border border-border card-shadow p-8">
          <div className="flex flex-col items-center text-center mb-8">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${config.accent} flex items-center justify-center shadow-lg mb-4`}>
              <Icon className="h-8 w-8 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold">{config.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{config.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div className="relative">
              <loginFieldConfig.icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={loginFieldConfig.type}
                name={`${role}-login-identifier`}
                autoComplete="off"
                className={inputClass}
                placeholder={loginFieldConfig.placeholder}
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                name={`${role}-login-password`}
                autoComplete="off"
                className={inputClass + " pr-11"}
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
                <input type="checkbox" className="rounded border-border" />
                Remember me
              </label>
              <a href="#" className="text-primary hover:underline">Forgot password?</a>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full cta-gradient text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing In...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" /> Sign In
                </>
              )}
            </button>
          </form>

          
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
