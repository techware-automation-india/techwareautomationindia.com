import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarRange, Plane, CalendarDays, ArrowRight, ArrowLeft } from "lucide-react";
import Leave from "./Leave.jsx";
import EmployeeHolidays from "./EmployeeHolidays.jsx";

const EmployeeLeaveHolidaysHome = ({ defaultTab = "overview" }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromQuery = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState(tabFromQuery || defaultTab);

  useEffect(() => {
    if (tabFromQuery) {
      setActiveTab(tabFromQuery);
    }
  }, [tabFromQuery]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (newTab === "overview") {
      searchParams.delete("tab");
      setSearchParams(searchParams);
    } else {
      setSearchParams({ tab: newTab });
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Button for Submodules */}
      {activeTab !== "overview" && (
        <div>
          <button
            type="button"
            onClick={() => handleTabChange("overview")}
            className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary card-shadow transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1 text-primary" />
            <span>Back to Modules</span>
          </button>
        </div>
      )}

      {/* Overview Main Header (Only shown on overview page) */}
      {activeTab === "overview" && (
        <div className="flex items-center gap-4 border-b border-border pb-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarRange className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Leave & Holidays</h1>
            <p className="text-sm text-muted-foreground">
              Apply for leaves, track remaining balances, and view company official holiday schedules.
            </p>
          </div>
        </div>
      )}

      {/* Overview Cards View */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <h2 className="font-display text-lg font-semibold text-foreground">Select Module</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Card 1: My Leave */}
            <div
              onClick={() => handleTabChange("my-leave")}
              className="group cursor-pointer rounded-2xl border border-border bg-background p-6 card-shadow transition-all hover:border-primary/40 hover:bg-primary/[0.02]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                  <Plane className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                  Manage <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-foreground">
                My Leave
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Submit leave applications, view your remaining leave balances, and track request history & status.
              </p>
            </div>

            {/* Card 2: Holidays */}
            <div
              onClick={() => handleTabChange("holidays")}
              className="group cursor-pointer rounded-2xl border border-border bg-background p-6 card-shadow transition-all hover:border-primary/40 hover:bg-primary/[0.02]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                  View Calendar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-foreground">
                Holidays
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                View company official holidays, national festival days, and mandatory non-working days for the year.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sub-module Views */}
      {activeTab === "my-leave" && <Leave />}
      {activeTab === "holidays" && <EmployeeHolidays />}
    </div>
  );
};

export default EmployeeLeaveHolidaysHome;
