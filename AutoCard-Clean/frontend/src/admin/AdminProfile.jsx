import { useState } from "react";
import { Link } from "react-router-dom";
import {
  User,
  Mail,
  Phone,
  Shield,
  Lock,
  Save,
  Camera,
  KeyRound,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { getAuthUser } from "../lib/auth.js";

const AdminProfile = () => {
  const user = getAuthUser();

  const [formData, setFormData] = useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();

    // Connect this to your backend API when profile update endpoint is ready.
    toast.success("Profile updated successfully");
  };

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "AD";

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* =========================================================
          PAGE HEADER
      ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
            My Profile
          </h1>

          <p className="text-sm text-muted-foreground mt-1">
            Manage your personal information and account security.
          </p>
        </div>
      </div>

      {/* =========================================================
          PROFILE HERO
      ========================================================= */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-background">

        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/5 pointer-events-none" />

        <div className="relative p-6 lg:p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6">

            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 lg:w-28 lg:h-28 rounded-2xl cta-gradient flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                {initials}
              </div>

              <button
                type="button"
                onClick={() => toast.info("Profile photo upload coming soon")}
                className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-background border border-border shadow-md flex items-center justify-center hover:bg-secondary transition-colors"
                aria-label="Change profile photo"
              >
                <Camera className="h-4 w-4 text-foreground" />
              </button>
            </div>

            {/* User Details */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold text-foreground">
                  {user?.fullName || "System Admin"}
                </h2>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-semibold">
                  <Shield className="h-3.5 w-3.5" />
                  Administrator
                </span>
              </div>

              <p className="text-sm text-muted-foreground mt-1">
                {user?.email || "admin@techware.com"}
              </p>

              <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">

                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Account Active
                </div>

                <div className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-primary" />
                  Full Administrator Access
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          MAIN GRID
      ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* =======================================================
            PERSONAL INFORMATION
        ======================================================= */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-background">

          {/* Card Header */}
          <div className="px-6 py-5 border-b border-border">
            <div className="flex items-center gap-3">

              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>

              <div>
                <h2 className="font-semibold text-foreground">
                  Personal Information
                </h2>

                <p className="text-xs text-muted-foreground mt-0.5">
                  Update your account details.
                </p>
              </div>

            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="p-6 space-y-5">

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Full Name
              </label>

              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email Address
              </label>

              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Phone Number
              </label>

              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Enter your phone number"
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Role
              </label>

              <div className="relative">
                <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

                <input
                  type="text"
                  value="Administrator"
                  disabled
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-secondary/40 text-sm text-muted-foreground cursor-not-allowed"
                />
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end pt-4 border-t border-border">
              <button
                type="submit"
                className="cta-gradient text-white font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-2 text-sm shadow-sm"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </button>
            </div>

          </form>
        </div>

        {/* =======================================================
            ACCOUNT OVERVIEW
        ======================================================= */}
        <div className="space-y-6">

          {/* Account Status */}
          <div className="rounded-2xl border border-border bg-background p-6">

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>

              <div>
                <h2 className="font-semibold text-foreground">
                  Account Status
                </h2>

                <p className="text-xs text-muted-foreground">
                  Current account state
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Status
                </span>

                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-muted-foreground">
                  Account Type
                </span>

                <span className="text-sm font-medium text-foreground">
                  Admin
                </span>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="rounded-2xl border border-border bg-background p-6">

            <div className="flex items-center gap-3 mb-5">

              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Lock className="h-5 w-5 text-primary" />
              </div>

              <div>
                <h2 className="font-semibold text-foreground">
                  Account Security
                </h2>

                <p className="text-xs text-muted-foreground">
                  Manage your password
                </p>
              </div>

            </div>

            <Link
  to="/admin/change-password"
  className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-border bg-background hover:bg-secondary/60 transition-all group"
>
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
      <KeyRound className="h-4 w-4 text-primary" />
    </div>

    <div className="text-left">
      <div className="text-sm font-semibold text-foreground">
        Change Password
      </div>

      <div className="text-xs text-muted-foreground mt-0.5">
        Update your account password
      </div>
    </div>
  </div>

  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
</Link>

          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;