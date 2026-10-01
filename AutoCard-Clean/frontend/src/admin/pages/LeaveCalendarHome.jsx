import { useState } from "react";
import { CalendarRange, BookOpen, CalendarDays, ArrowRight, ArrowLeft } from "lucide-react";
import LeavePolicy from "./LeavePolicy.jsx";
import Holidays from "./Holidays.jsx";

const LeaveCalendarHome = () => {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6">
      {/* Back Button for Submodules */}
      {activeTab !== "overview" && (
        <div>
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
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
            <h1 className="font-display text-2xl font-bold text-foreground">Leave & Calendar</h1>
            <p className="text-sm text-muted-foreground">
              Manage company leave policies and holiday schedules.
            </p>
          </div>
        </div>
      )}

      {/* Overview Cards View */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <h2 className="font-display text-lg font-semibold text-foreground">Select Module</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Card 1: Leave Policy */}
            <div
              onClick={() => setActiveTab("leave-policy")}
              className="group cursor-pointer rounded-2xl border border-border bg-background p-6 card-shadow transition-all hover:border-primary/40 hover:bg-primary/[0.02]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                  Manage <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-foreground">
                Leave Policy
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Define leave types (Sick, Casual, Annual), set yearly day allocations, paid/unpaid rules, and approval settings.
              </p>
            </div>

            {/* Card 2: Holiday */}
            <div
              onClick={() => setActiveTab("holidays")}
              className="group cursor-pointer rounded-2xl border border-border bg-background p-6 card-shadow transition-all hover:border-primary/40 hover:bg-primary/[0.02]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                  Manage <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-foreground">
                Holiday
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Create and manage the company official holiday calendar, festival days, and mandatory non-working days.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sub-module Views */}
      {activeTab === "leave-policy" && <LeavePolicy />}
      {activeTab === "holidays" && <Holidays />}
    </div>
  );
};

export default LeaveCalendarHome;
