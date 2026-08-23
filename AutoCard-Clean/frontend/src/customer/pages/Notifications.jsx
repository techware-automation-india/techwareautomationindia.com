import { Bell, Check, Trash2 } from "lucide-react";

const Notifications = () => {
  const notifications = [
    {
      id: "1",
      title: "Project Update",
      message: "Website Development project progress updated to 65%",
      type: "INFO",
      read: false,
      createdAt: "2026-07-29T10:30:00",
    },
    {
      id: "2",
      title: "Invoice Generated",
      message: "New invoice INV-2026-002 has been generated for $4,999",
      type: "BILLING",
      read: false,
      createdAt: "2026-07-28T14:20:00",
    },
    {
      id: "3",
      title: "Request Updated",
      message: "Your support request 'Bug Fix - Login Issue' status changed to In Progress",
      type: "SUPPORT",
      read: true,
      createdAt: "2026-07-26T09:15:00",
    },
  ];

  const getTypeColor = (type) => {
    const colors = {
      INFO: "bg-blue-100 text-blue-700",
      BILLING: "bg-green-100 text-green-700",
      SUPPORT: "bg-purple-100 text-purple-700",
      ALERT: "bg-red-100 text-red-700",
    };
    return colors[type] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground">Stay updated with your activities</p>
          </div>
        </div>

        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background hover:bg-secondary transition-colors text-sm font-medium">
          <Check className="h-4 w-4" />
          Mark All Read
        </button>
      </div>

      <div className="space-y-3">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={`rounded-2xl bg-background border card-shadow p-5 transition-all ${
              notif.read ? "border-border" : "border-primary/50 bg-primary/5"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(notif.type)}`}>
                    {notif.type}
                  </span>
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
                <h3 className="font-semibold mb-1">{notif.title}</h3>
                <p className="text-sm text-muted-foreground">{notif.message}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(notif.createdAt).toLocaleString()}
                </p>
              </div>

              <button className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {notifications.length === 0 && (
        <div className="text-center py-12">
          <Bell className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="font-semibold text-lg mb-2">No notifications</h3>
          <p className="text-sm text-muted-foreground">You're all caught up!</p>
        </div>
      )}
    </div>
  );
};

export default Notifications;
