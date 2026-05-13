import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="font-display text-6xl font-bold gradient-text">404</h1>
      <p className="text-muted-foreground text-lg">Page not found</p>
      <button
        onClick={() => navigate("/")}
        className="px-6 py-2 rounded-lg cta-gradient text-white font-semibold hover:opacity-90 transition-opacity"
      >
        Back to Home
      </button>
    </div>
  );
};

export default NotFound;
