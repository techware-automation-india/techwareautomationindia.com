import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Sign a JWT for an authenticated user.
export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Express middleware: require a valid Bearer token.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  console.log("🔐 [Auth Middleware] Header:", header.substring(0, 50) + "...");
  console.log("🔐 [Auth Middleware] Token extracted:", token ? "YES" : "NO");

  if (!token) {
    console.log("❌ [Auth Middleware] No token provided");
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    console.log("✅ [Auth Middleware] Token valid for user:", req.user.id, "role:", req.user.role);
    next();
  } catch (err) {
    console.log("❌ [Auth Middleware] Token verification failed:", err.message);
    return res.status(401).json({ message: "Invalid or expired session." });
  }
}

// Express middleware factory: require a specific role (after requireAuth).
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: "You do not have access to this resource." });
    }
    next();
  };
}
