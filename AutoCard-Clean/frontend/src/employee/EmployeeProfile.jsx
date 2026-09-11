import { useState } from "react";
import { Link } from "react-router-dom";
import {
  User,
  Mail,
  Phone,
  Shield,
  LockKeyhole,
  KeyRound,
  ChevronRight,
  Save,
  CheckCircle2,
  BriefcaseBusiness,
  AtSign,
} from "lucide-react";
import { toast } from "sonner";
import { getAuthUser } from "../lib/auth.js";

const EmployeeProfile = () => {
  const user = getAuthUser();

  const [formData, setFormData] = useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });

  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();

    setSaving(true);

    try {
      // Connect your profile update API here later.
      await new Promise((resolve) => setTimeout(resolve, 500));

      toast.success("Profile updated successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.fullName
    ? user.fullName
        .trim()
        .split(/\s+/)
        .map((name) => name[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "EM";

  const isActive =
    user?.status === "ACTIVE" || user?.status === "Active" || !user?.status;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
            My Profile
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage your personal information and account security.
          </p>
        </div>
      </div>

      {/* ================= PROFILE SUMMARY ================= */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-background">
        {/* Decorative background */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent pointer-events-none" />

        <div className="relative p-5 sm:p-6 lg:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-2xl font-bold shadow-lg ring-4 ring-background">
                {initials}
              </div>

              {/* Online indicator */}
              {isActive && (
                <span className="absolute right-1 bottom-1 h-5 w-5 rounded-full bg-emerald-500 border-4 border-background" />
              )}
            </div>

            {/* User details */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                  {user?.fullName || "Employee"}
                </h2>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Active
                </span>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                {user?.email || "No email available"}
              </p>

              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                  <Shield className="h-3.5 w-3.5" />
                  Employee
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <BriefcaseBusiness className="h-3.5 w-3.5" />
                  Employee Account
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= PERSONAL INFORMATION ================= */}
      <section className="rounded-2xl border border-border bg-background overflow-hidden">
        {/* Section header */}
        <div className="flex items-center gap-3 px-5 py-5 sm:px-6 border-b border-border">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">
              Personal Information
            </h2>

            <p className="text-xs text-muted-foreground mt-0.5">
              Update your basic account details
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave}>
          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Full Name
                </label>

                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />

                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    className="w-full h-11 rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email Address
                </label>

                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />

                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full h-11 rounded-xl border border-border bg-secondary/40 pl-10 pr-4 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Phone Number
                </label>

                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />

                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Enter phone number"
                    className="w-full h-11 rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Account Role
                </label>

                <div className="relative">
                  <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />

                  <input
                    type="text"
                    value="Employee"
                    disabled
                    className="w-full h-11 rounded-xl border border-border bg-secondary/40 pl-10 pr-4 text-sm text-muted-foreground cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Form footer */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 sm:px-6 border-t border-border bg-secondary/20">
            <p className="text-xs text-muted-foreground">
              Keep your contact information up to date.
            </p>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl cta-gradient text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />

              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </section>

      {/* ================= ACCOUNT INFORMATION + SECURITY ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Information */}
        <section className="rounded-2xl border border-border bg-background overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <AtSign className="h-5 w-5 text-primary" />
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground">
                Account Information
              </h2>

              <p className="text-xs text-muted-foreground mt-0.5">
                Your account details
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">
                Account Type
              </span>

              <span className="text-sm font-medium text-foreground">
                Employee
              </span>
            </div>

            <div className="h-px bg-border" />

            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">
                Account Status
              </span>

              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>

            <div className="h-px bg-border" />

            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Email</span>

              <span className="text-sm font-medium text-foreground truncate max-w-[55%]">
                {user?.email || "Not available"}
              </span>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="rounded-2xl border border-border bg-background overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <LockKeyhole className="h-5 w-5 text-primary" />
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground">
                Account Security
              </h2>

              <p className="text-xs text-muted-foreground mt-0.5">
                Protect your account
              </p>
            </div>
          </div>

          <div className="p-5">
            <Link
              to="/employee/change-password"
              className="group flex items-center justify-between gap-4 rounded-xl border border-border p-4 transition-all hover:border-primary/30 hover:bg-primary/5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                  <KeyRound className="h-4.5 w-4.5 text-primary" />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Change Password
                  </p>

                  <p className="text-xs text-muted-foreground mt-1">
                    Update your account password
                  </p>
                </div>
              </div>

              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>

            <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-secondary/60 p-3.5">
              <LockKeyhole className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />

              <p className="text-xs leading-5 text-muted-foreground">
                Use a strong password and avoid sharing your account credentials
                with anyone.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default EmployeeProfile;
