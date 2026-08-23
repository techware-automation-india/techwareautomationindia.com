import { Settings as SettingsIcon, Lock, Bell, Globe } from "lucide-react";

const Settings = () => {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <SettingsIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account preferences</p>
        </div>
      </div>

      {/* Password Change */}
      <div className="rounded-2xl bg-background border border-border card-shadow p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Change Password</h3>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Current Password</label>
          <input
            type="password"
            placeholder="Enter current password"
            className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">New Password</label>
          <input
            type="password"
            placeholder="Enter new password"
            className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Confirm New Password</label>
          <input
            type="password"
            placeholder="Confirm new password"
            className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <button className="px-6 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity">
          Update Password
        </button>
      </div>

      {/* Notification Preferences */}
      <div className="rounded-2xl bg-background border border-border card-shadow p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Notification Preferences</h3>
        </div>

        <div className="space-y-3">
          {[
            { label: "Project Updates", description: "Get notified about project progress" },
            { label: "Invoice Notifications", description: "Receive alerts for new invoices" },
            { label: "Support Replies", description: "Get notified when support team responds" },
            { label: "Marketing Emails", description: "Receive product updates and offers" },
          ].map((pref, idx) => (
            <label key={idx} className="flex items-center justify-between p-4 rounded-lg hover:bg-secondary/30 cursor-pointer transition-colors">
              <div>
                <div className="font-medium text-sm">{pref.label}</div>
                <div className="text-xs text-muted-foreground">{pref.description}</div>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="w-5 h-5 rounded border-border text-primary focus:ring-2 focus:ring-primary/30"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Language & Region */}
      <div className="rounded-2xl bg-background border border-border card-shadow p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Language & Region</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Language</label>
            <select className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option>English</option>
              <option>Spanish</option>
              <option>French</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Timezone</label>
            <select className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option>UTC-5 (Eastern Time)</option>
              <option>UTC-6 (Central Time)</option>
              <option>UTC-7 (Mountain Time)</option>
              <option>UTC-8 (Pacific Time)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
