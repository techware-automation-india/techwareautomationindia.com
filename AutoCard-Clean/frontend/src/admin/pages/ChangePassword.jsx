import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "../../lib/api.js";

const ChangePassword = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const passwordChecks = {
    length: formData.newPassword.length >= 8,
    uppercase: /[A-Z]/.test(formData.newPassword),
    lowercase: /[a-z]/.test(formData.newPassword),
    number: /\d/.test(formData.newPassword),
    special: /[^A-Za-z0-9]/.test(formData.newPassword),
  };

  const score = Object.values(passwordChecks).filter(Boolean).length;

  const getStrength = () => {
    if (!formData.newPassword) {
      return {
        text: "Enter a new password",
        width: "0%",
      };
    }

    if (score <= 2) {
      return {
        text: "Weak",
        width: "30%",
      };
    }

    if (score <= 4) {
      return {
        text: "Good",
        width: "65%",
      };
    }

    return {
      text: "Strong",
      width: "100%",
    };
  };

  const strength = getStrength();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitting) return;

    if (!formData.currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }

    if (formData.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }

    if (!Object.values(passwordChecks).every(Boolean)) {
      toast.error("Please meet all password requirements.");
      return;
    }

    if (!formData.confirmPassword) {
      toast.error("Please confirm your new password.");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      toast.error(
        "New password must be different from your current password.",
      );
      return;
    }

    setSubmitting(true);

    try {
      await apiPost("/auth/change-password", {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });

      toast.success("Password changed successfully.");

      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setTimeout(() => {
        navigate("/admin/profile");
      }, 800);
    } catch (err) {
      toast.error(
        err.message || "Unable to change password. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const togglePassword = (field) => {
    setShowPassword((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  return (
    <div className="min-h-full w-full">

      {/* Page Header */}
      <div className="max-w-4xl mx-auto px-1">

        <Link
          to="/admin/profile"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Profile
        </Link>

        <div className="mb-7">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-primary" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Change Password
            </h1>
          </div>

          <p className="text-sm text-muted-foreground ml-13">
            Update your password to keep your administrator account secure.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">

          {/* Form */}
          <div className="rounded-2xl border border-border bg-background overflow-hidden">

            {/* Form Header */}
            <div className="px-6 py-5 border-b border-border">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-primary" />

                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Password Security
                  </h2>

                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enter your current password and create a new one.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6">

              <div className="space-y-5">

                {/* Current Password */}
                <PasswordInput
                  label="Current Password"
                  name="currentPassword"
                  value={formData.currentPassword}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  show={showPassword.current}
                  onChange={handleChange}
                  onToggle={() => togglePassword("current")}
                />

                {/* New Password */}
                <div>
                  <PasswordInput
                    label="New Password"
                    name="newPassword"
                    value={formData.newPassword}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    show={showPassword.new}
                    onChange={handleChange}
                    onToggle={() => togglePassword("new")}
                  />

                  {/* Strength */}
                  {formData.newPassword && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">
                          Password strength
                        </span>

                        <span
                          className={`text-xs font-semibold ${
                            score === 5
                              ? "text-emerald-500"
                              : score >= 3
                                ? "text-primary"
                                : "text-destructive"
                          }`}
                        >
                          {strength.text}
                        </span>
                      </div>

                      <div className="flex gap-1.5 h-1.5">
                        <div
                          className={`flex-1 rounded-full ${
                            score >= 1 ? "bg-primary" : "bg-secondary"
                          }`}
                        />
                        <div
                          className={`flex-1 rounded-full ${
                            score >= 3 ? "bg-primary" : "bg-secondary"
                          }`}
                        />
                        <div
                          className={`flex-1 rounded-full ${
                            score >= 5 ? "bg-primary" : "bg-secondary"
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Requirements */}
                <div className="rounded-xl border border-border bg-secondary/20 p-4">
                  <p className="text-xs font-semibold text-foreground mb-3">
                    Password must contain
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    <Requirement
                      valid={passwordChecks.length}
                      text="8 or more characters"
                    />

                    <Requirement
                      valid={passwordChecks.uppercase}
                      text="Uppercase letter"
                    />

                    <Requirement
                      valid={passwordChecks.lowercase}
                      text="Lowercase letter"
                    />

                    <Requirement
                      valid={passwordChecks.number}
                      text="Number"
                    />

                    <Requirement
                      valid={passwordChecks.special}
                      text="Special character"
                    />
                  </div>
                </div>

                {/* Confirm Password */}
                <PasswordInput
                  label="Confirm New Password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  show={showPassword.confirm}
                  onChange={handleChange}
                  onToggle={() => togglePassword("confirm")}
                />

                {/* Match */}
                {formData.confirmPassword && (
                  <div
                    className={`flex items-center gap-2 text-xs ${
                      formData.newPassword === formData.confirmPassword
                        ? "text-emerald-500"
                        : "text-destructive"
                    }`}
                  >
                    {formData.newPassword === formData.confirmPassword ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Passwords match
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4" />
                        Passwords do not match
                      </>
                    )}
                  </div>
                )}

              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-7 pt-5 border-t border-border">

                <Link
                  to="/admin/profile"
                  className="h-11 px-5 rounded-xl border border-border flex items-center justify-center text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-11 px-6 rounded-xl cta-gradient text-white flex items-center justify-center gap-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Update Password
                    </>
                  )}
                </button>

              </div>
            </form>
          </div>

          {/* Security Sidebar */}
          <div className="space-y-4">

            {/* Security Card */}
            <div className="rounded-2xl border border-border bg-background p-5">

              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Account Security
                  </h3>

                  <p className="text-[11px] text-muted-foreground">
                    Protect your administrator account
                  </p>
                </div>
              </div>

              <div className="space-y-4">

                <SecurityItem
                  title="Use a strong password"
                  description="Avoid simple or common passwords."
                />

                <SecurityItem
                  title="Don't reuse passwords"
                  description="Use a password unique to this account."
                />

                <SecurityItem
                  title="Keep it private"
                  description="Never share your password with anyone."
                />

              </div>
            </div>

            {/* Back Profile */}
            <Link
              to="/admin/profile"
              className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3.5 hover:bg-secondary transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </div>

              <div>
                <p className="text-sm font-medium text-foreground">
                  My Profile
                </p>

                <p className="text-xs text-muted-foreground">
                  Return to account profile
                </p>
              </div>
            </Link>

          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------------------------------------
   Password Input
--------------------------------------------- */

const PasswordInput = ({
  label,
  name,
  value,
  placeholder,
  autoComplete,
  show,
  onChange,
  onToggle,
}) => {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-sm font-medium text-foreground mb-2"
      >
        {label}
      </label>

      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />

        <input
          id={name}
          name={name}
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full h-11 rounded-xl border border-border bg-background pl-10 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />

        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};

/* ---------------------------------------------
   Requirement
--------------------------------------------- */

const Requirement = ({ valid, text }) => {
  return (
    <div className="flex items-center gap-2">
      {valid ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
      ) : (
        <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/40 shrink-0" />
      )}

      <span
        className={`text-xs ${
          valid
            ? "text-emerald-500"
            : "text-muted-foreground"
        }`}
      >
        {text}
      </span>
    </div>
  );
};

/* ---------------------------------------------
   Security Item
--------------------------------------------- */

const SecurityItem = ({ title, description }) => {
  return (
    <div>
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />

        <p className="text-xs font-medium text-foreground">
          {title}
        </p>
      </div>

      <p className="text-[11px] text-muted-foreground ml-5 mt-1 leading-relaxed">
        {description}
      </p>
    </div>
  );
};

export default ChangePassword;