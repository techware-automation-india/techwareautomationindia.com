import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Loader2 } from "lucide-react";
import { apiGet } from "../../lib/api.js";
import { updateAuthUser } from "../../lib/auth.js";

// Wraps employee module pages that should only be reachable once onboarding
// is APPROVED (or SUBMITTED when explicitly allowed). Checks the live status
// from the server on mount.
const RequireOnboarding = ({ children, allowSubmitted = false }) => {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, approved: false });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiGet("/onboarding/me");
        const status = data.profile.onboardingStatus;
        updateAuthUser({ onboardingStatus: status });
        const isAllowed = status === "APPROVED" || (allowSubmitted && status === "SUBMITTED");
        if (active) setState({ loading: false, approved: isAllowed });
      } catch {
        if (active) setState({ loading: false, approved: false });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="p-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Checking access...
      </div>
    );
  }

  if (!state.approved) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background p-12 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-4">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="font-display text-lg font-semibold mb-1">Access Locked</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-5">
          You need to complete the onboarding form and receive admin approval before accessing this module.
        </p>
        <button
          onClick={() => navigate("/employee/onboarding")}
          className="cta-gradient text-white font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity text-sm"
        >
          Go to Onboarding Form
        </button>
      </div>
    );
  }

  return children;
};

export default RequireOnboarding;
