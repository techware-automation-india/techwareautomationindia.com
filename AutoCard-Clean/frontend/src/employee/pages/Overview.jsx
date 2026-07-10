import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { employeeModules } from "../modules.js";
import { getAuthUser } from "../../lib/auth.js";

const Overview = () => {
  const user = getAuthUser();
  const onboardingStatus = user?.onboardingStatus;

  // Exclude the overview entry itself from the module grid.
  const modules = employeeModules.filter((m) => m.key !== "overview");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Employee Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back, {user?.fullName || "Employee"}. {onboardingStatus === "PENDING" ? "Let's get you onboarded!" : "Select a module to get started."}
        </p>
      </div>

      {/* Onboarding Status Card */}
      {onboardingStatus === "PENDING" && (
        <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50 p-8 card-shadow">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-xl font-bold text-amber-900 mb-2">Complete Your Onboarding</h2>
              <p className="text-sm text-amber-800 leading-relaxed mb-4">
                To access all employee features like attendance tracking and leave management, you need to complete your onboarding form first. This is a one-time process and takes about 10 minutes.
              </p>
              <Link
                to="/employee/onboarding"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm transition-colors"
              >
                Complete Onboarding Now
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {onboardingStatus === "SUBMITTED" && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Onboarding Under Review</h3>
            <p className="text-sm text-blue-800">
              Your onboarding form has been submitted and is awaiting admin approval. You'll be notified once it's processed.
            </p>
          </div>
        </div>
      )}

      {onboardingStatus === "APPROVED" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-emerald-900 mb-1">Onboarding Complete</h3>
            <p className="text-sm text-emerald-800">
              Welcome aboard! Your onboarding has been approved. You now have full access to all employee modules.
            </p>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map(({ key, label, path, icon: Icon, description }) => {
          // Disable non-onboarding modules if status is PENDING
          const isPending = onboardingStatus === "PENDING";
          const isOnboardingModule = key === "onboarding";
          const isDisabled = isPending && !isOnboardingModule;

          if (isDisabled) {
            return (
              <div
                key={key}
                className="rounded-2xl bg-secondary/40 border border-border p-6 opacity-50 cursor-not-allowed"
              >
                <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center mb-4">
                  <Icon className="h-5.5 w-5.5 text-muted-foreground" />
                </div>
                <h3 className="font-display font-semibold mb-1 text-muted-foreground">{label}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                <p className="text-xs text-amber-600 mt-2 font-medium">🔒 Complete onboarding first</p>
              </div>
            );
          }

          return (
            <Link
              key={key}
              to={path}
              className="group rounded-2xl bg-background border border-border p-6 card-shadow hover:card-shadow-hover hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Icon className="h-5.5 w-5.5 text-primary" />
              </div>
              <h3 className="font-display font-semibold mb-1">{label}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default Overview;
