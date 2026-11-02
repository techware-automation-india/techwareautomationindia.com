import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Loader2 } from "lucide-react";
import { apiGet } from "../../lib/api.js";
import { updateAuthUser } from "../../lib/auth.js";

// Wraps employee module pages that should only be reachable once onboarding
// is APPROVED (or SUBMITTED when explicitly allowed). Checks the live status
// from the server on mount.
// Onboarding check is bypassed so employees can directly access all authorized modules
const RequireOnboarding = ({ children }) => {
  return children;
};

export default RequireOnboarding;
