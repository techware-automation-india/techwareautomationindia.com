import { Receipt, Download, DollarSign, AlertCircle } from "lucide-react";

const Invoices = () => {
  const invoices = [
    {
      id: "INV-2026-001",
      projectName: "Website Development",
      amount: 2999,
      status: "PAID",
      dueDate: "2026-07-15",
      paidDate: "2026-07-10",
    },
    {
      id: "INV-2026-002",
      projectName: "Mobile App Design",
      amount: 4999,
      status: "PENDING",
      dueDate: "2026-08-15",
      paidDate: null,
    },
    {
      id: "INV-2026-003",
      projectName: "Cloud Setup",
      amount: 1999,
      status: "OVERDUE",
      dueDate: "2026-07-01",
      paidDate: null,
    },
  ];

  const getStatusColor = (status) => {
    const colors = {
      PAID: "bg-green-100 text-green-700 border-green-200",
      PENDING: "bg-amber-100 text-amber-700 border-amber-200",
      OVERDUE: "bg-red-100 text-red-700 border-red-200",
    };
    return colors[status] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const totalPaid = invoices.filter(i => i.status === "PAID").reduce((sum, i) => sum + i.amount, 0);
  const totalPending = invoices.filter(i => i.status !== "PAID").reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Receipt className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground">View and download your invoices</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-background border border-border card-shadow p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Paid</div>
              <div className="font-display text-2xl font-bold text-green-600">${totalPaid.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-background border border-border card-shadow p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Outstanding</div>
              <div className="font-display text-2xl font-bold text-amber-600">${totalPending.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/30 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoice ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm font-medium">{invoice.id}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">{invoice.projectName}</td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-sm">${invoice.amount.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {new Date(invoice.dueDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                        invoice.status
                      )}`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-secondary transition-colors text-sm">
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Invoices;
