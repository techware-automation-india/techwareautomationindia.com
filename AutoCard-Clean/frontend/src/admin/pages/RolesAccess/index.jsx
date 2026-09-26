import { useState, useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import RolesTab from "./RolesTab";
import AccessTab from "./AccessTab";

export default function RolesAccess() {
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Roles & Access Control</h1>
              <p className="text-muted-foreground text-sm">Manage roles and assign access to users</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 border-b border-border">
            <button
              onClick={() => handleTabChange('roles')}
              className={`
                px-6 py-3 font-medium text-sm transition-colors relative
                ${activeTab === 'roles'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              Roles
            </button>
            <button
              onClick={() => handleTabChange('access')}
              className={`
                px-6 py-3 font-medium text-sm transition-colors relative
                ${activeTab === 'access'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              Access
            </button>
          </div>
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
