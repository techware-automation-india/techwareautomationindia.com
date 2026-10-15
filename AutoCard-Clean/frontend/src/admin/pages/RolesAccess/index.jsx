import { useState, useEffect } from "react";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import RolesTab from "./RolesTab";
import AccessTab from "./AccessTab";

export default function RolesAccess() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('roles');

  // Load active tab from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('rolesAccessActiveTab');
    if (saved && ['roles', 'access'].includes(saved)) {
      setActiveTab(saved);
    }
  }, []);

  // Save active tab to sessionStorage when it changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    sessionStorage.setItem('rolesAccessActiveTab', tab);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2.5 rounded-xl border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Roles &amp; Access Control
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Manage custom roles and assign module permissions to user accounts
            </p>
          </div>
        </div>

        {/* Tab Navigation Pill Group */}
        <div className="flex items-center gap-1.5 p-1 bg-secondary/60 rounded-xl border border-border self-start sm:self-auto">
          <button
            onClick={() => handleTabChange('roles')}
            className={`px-5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'roles'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Roles
          </button>
          <button
            onClick={() => handleTabChange('access')}
            className={`px-5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'access'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Access Assignment
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'roles' && <RolesTab />}
        {activeTab === 'access' && <AccessTab />}
      </div>
    </div>
  );
}
