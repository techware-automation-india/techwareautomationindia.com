import {
  ArrowRight,
  ClipboardList,
  FileText,
  Plane,
  ScanLine,
} from "lucide-react";
import { Link } from "react-router-dom";

const Requests = () => {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Requests</h1>
            <p className="text-sm text-muted-foreground">
              Submit a request and track its status.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Request Services</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            // {
            //   label: "Leave",
            //   description: "Apply for leave and track approvals.",
            //   path: "/employee/leave",
            //   icon: Plane,
            // },
            {
              label: "Forgot Punch",
              description:
                "Request a correction for a missed check-in or check-out.",
              path: "/employee/requests/forgot-punch",
              icon: ScanLine,
            },
            {
              label: "Track My Request",
              description: "View submitted requests and their status.",
              path: "/employee/requests/track",
              icon: ClipboardList,
            },
          ].map(({ label, description, path, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className="group rounded-2xl border border-border bg-background p-5 card-shadow transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <h3 className="mt-4 font-semibold">{label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Requests;
