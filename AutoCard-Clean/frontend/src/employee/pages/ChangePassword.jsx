import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "../../lib/api.js";

const ChangePassword = () => {
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);

  const requirements = useMemo(
    () => ({
      length: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[^A-Za-z0-9]/.test(newPassword),
    }),
    [newPassword]
  );

  const requirementCount =
    Object.values(requirements).filter(Boolean).length;

  const passwordStrength =
    requirementCount === 0
      ? 0
      : requirementCount <= 2
        ? 1
        : requirementCount <= 4
          ? 2
          : 3;

  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("New password must contain at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword === currentPassword) {
      toast.error("New password must be different from your current password");
      return;
    }

    setLoading(true);

    try {
      await apiPost("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      toast.success("Password changed successfully");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        navigate("/employee/profile");
      }, 700);
    } catch (error) {
      console.error("Change password error:", error);

      toast.error(
        error?.message || "Unable to change password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const PasswordInput = ({
    label,
    value,
    onChange,
    show,
    setShow,
    placeholder,
  }) => (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">
        {label}
      </label>

      <div className="relative">
        <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />

        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-11 rounded-xl border border-border bg-background pl-10 pr-11 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
        />

        <button
          type="button"
          onClick={() => setShow((prev) => !prev)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      {/* ================= HEADER ================= */}
      <div className="mb-6">
        <Link
          to="/employee/profile"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </Link>

        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
          Change Password
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Update your password to keep your employee account secure.
        </p>
      </div>

      {/* ================= CONTENT ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* ================= FORM ================= */}
        <section className="rounded-2xl border border-border bg-background overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-5 sm:px-6 border-b border-border">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground">
                Password Security
              </h2>

              <p className="text-xs text-muted-foreground mt-0.5">
                Create a strong and secure password
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-5 sm:p-6 space-y-5">
              {/* Current Password */}
              <PasswordInput
                label="Current Password"
                value={currentPassword}
                onChange={setCurrentPassword}
                show={showCurrent}
                setShow={setShowCurrent}
                placeholder="Enter your current password"
              />

              {/* New Password */}
              <PasswordInput
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                show={showNew}
                setShow={setShowNew}
                placeholder="Enter your new password"
              />

              {/* Strength */}
              {newPassword.length > 0 && (
                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Password strength
                    </span>

                    <span className="text-xs font-semibold text-foreground">
                      {passwordStrength === 1
                        ? "Weak"
                        : passwordStrength === 2
                          ? "Good"
                          : passwordStrength === 3
                            ? "Strong"
                            : "Very weak"}
                    </span>
                  </div>

                  <div className="flex gap-1.5">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-all ${
                          passwordStrength >= level
                            ? "bg-primary"
                            : "bg-border"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements */}
              <div className="rounded-xl border border-border p-4">
                <p className="text-sm font-semibold text-foreground mb-3">
                  Password requirements
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Requirement
                    valid={requirements.length}
                    text="At least 8 characters"
                  />

                  <Requirement
                    valid={requirements.uppercase}
                    text="One uppercase letter"
                  />

                  <Requirement
                    valid={requirements.lowercase}
                    text="One lowercase letter"
                  />

                  <Requirement
                    valid={requirements.number}
                    text="One number"
                  />

                  <Requirement
                    valid={requirements.special}
                    text="One special character"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <PasswordInput
                label="Confirm New Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                show={showConfirm}
                setShow={setShowConfirm}
                placeholder="Re-enter your new password"
              />

              {/* Match status */}
              {confirmPassword.length > 0 && (
                <div
                  className={`flex items-center gap-2 text-xs font-medium ${
                    passwordsMatch
                      ? "text-emerald-600"
                      : "text-destructive"
                  }`}
                >
                  {passwordsMatch ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Passwords match
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4" />
                      Passwords do not match
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 px-5 py-4 sm:px-6 border-t border-border bg-secondary/20">
              <Link
                to="/employee/profile"
                className="inline-flex items-center justify-center h-10 px-5 rounded-xl border border-border bg-background text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl cta-gradient text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <ShieldCheck className="h-4 w-4" />

                {loading ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </section>

        {/* ================= SECURITY PANEL ================= */}
        <aside className="space-y-6">
          {/* Security card */}
          <section className="rounded-2xl border border-border bg-background overflow-hidden">
            <div className="px-5 py-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>

                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Stay Secure
                  </h2>

                  <p className="text-xs text-muted-foreground mt-0.5">
                    Protect your account
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <SecurityTip text="Never share your password with anyone." />
              <SecurityTip text="Avoid using passwords from other accounts." />
              <SecurityTip text="Use a combination of letters, numbers and symbols." />
              <SecurityTip text="Change your password if you suspect unauthorized access." />
            </div>
          </section>

          {/* Account card */}
          <section className="rounded-2xl border border-border bg-background p-5">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-secondary flex items-center justify-center">
                <LockKeyhole className="h-4 w-4 text-muted-foreground" />
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground">
                  Account Security
                </p>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Your password helps protect your personal information and
                  employee account.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

/* ================= REQUIREMENT ================= */

const Requirement = ({ valid, text }) => {
  return (
    <div
      className={`flex items-center gap-2 text-xs ${
        valid ? "text-emerald-600" : "text-muted-foreground"
      }`}
    >
      <span
        className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 ${
          valid
            ? "bg-emerald-500/10 text-emerald-600"
            : "bg-secondary text-muted-foreground"
        }`}
      >
        {valid ? (
          <Check className="h-2.5 w-2.5" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
      </span>

      {text}
    </div>
  );
};

/* ================= SECURITY TIP ================= */

const SecurityTip = ({ text }) => {
  return (
    <div className="flex items-start gap-2.5">
      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />

      <p className="text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
};

export default ChangePassword;