import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Edit2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost, apiPut } from "../../lib/api.js";

const emptyForm = {
  name: "",
  description: "",
  featuresText: "",
  price: "",
  category: "",
  isActive: true,
  orderIndex: 0,
};

const toForm = (service) => ({
  name: service?.name || "",
  description: service?.description || "",
  featuresText: Array.isArray(service?.features) ? service.features.join("\n") : "",
  price: service?.price || "",
  category: service?.category || "",
  isActive: service?.isActive ?? true,
  orderIndex: service?.orderIndex ?? 0,
});

const toPayload = (form) => ({
  name: form.name.trim(),
  description: form.description.trim(),
  features: form.featuresText
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean),
  price: form.price.trim(),
  category: form.category.trim() || undefined,
  isActive: form.isActive,
  orderIndex: Number(form.orderIndex) || 0,
});

const ServiceModal = ({ service, onClose, onSaved }) => {
  const [form, setForm] = useState(() => (service ? toForm(service) : emptyForm));
  const [saving, setSaving] = useState(false);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = toPayload(form);
      if (!payload.name) throw new Error("Service name is required.");
      if (payload.description.length < 10) throw new Error("Description must be at least 10 characters.");
      if (payload.features.length === 0) throw new Error("Add at least one feature.");
      if (!payload.price) throw new Error("Price is required.");

      if (service) {
        await apiPut(`/services/${service.id}`, payload);
        toast.success("Service updated successfully.");
      } else {
        await apiPost("/services", payload);
        toast.success("Service created successfully.");
      }

      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to save service.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-background border border-border card-shadow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">{service ? "Edit Service" : "Create Service"}</h2>
            <p className="text-xs text-muted-foreground">This service will appear on the customer Services page when active.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Service Name *</label>
              <input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="e.g., Machine Maintenance"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Price *</label>
              <input
                value={form.price}
                onChange={(e) => setField("price", e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="e.g., Custom Quote"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <input
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="e.g., Support"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Display Order</label>
              <input
                type="number"
                value={form.orderIndex}
                onChange={(e) => setField("orderIndex", e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <label className="flex items-center gap-3 rounded-lg border border-border px-4 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setField("isActive", e.target.checked)}
                className="w-4 h-4 rounded border-border"
              />
              <span className="text-sm font-medium">Show to customers</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              rows={4}
              className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder="Describe what this service includes."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Features *</label>
            <textarea
              value={form.featuresText}
              onChange={(e) => setField("featuresText", e.target.value)}
              rows={5}
              className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none font-mono text-sm"
              placeholder={"One feature per line\nPreventive maintenance\nOn-site support\nDetailed service report"}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-lg border border-border bg-background hover:bg-secondary transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="cta-gradient text-white px-5 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? "Saving..." : service ? "Update Service" : "Create Service"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Services = ({ employeePermissions = null } = {}) => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const permissions = employeePermissions || {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
  };

  const loadServices = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/services/all");
      setServices(data.services || []);
    } catch (err) {
      toast.error(err.message || "Failed to load services.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter((service) =>
      [service.name, service.description, service.category, service.price]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q)),
    );
  }, [search, services]);

  const stats = {
    total: services.length,
    active: services.filter((service) => service.isActive).length,
    inactive: services.filter((service) => !service.isActive).length,
    categories: new Set(services.map((service) => service.category).filter(Boolean)).size,
  };

  const openCreate = () => {
    if (!permissions.canCreate) return;
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (service) => {
    if (!permissions.canEdit) return;
    setEditing(service);
    setModalOpen(true);
  };

  const deleteService = async (service) => {
    if (!permissions.canDelete) return;
    if (!confirm(`Delete "${service.name}"?`)) return;

    setDeletingId(service.id);
    try {
      await apiDelete(`/services/${service.id}`);
      toast.success("Service deleted successfully.");
      loadServices();
    } catch (err) {
      toast.error(err.message || "Failed to delete service.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wrench className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Services</h1>
            <p className="text-sm text-muted-foreground">Manually create and manage services shown to customers.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadServices}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={openCreate}
            disabled={!permissions.canCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg cta-gradient text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Create Service
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Services", value: stats.total, color: "text-primary", bg: "bg-primary/10" },
          { label: "Visible", value: stats.active, color: "text-green-600", bg: "bg-green-100" },
          { label: "Hidden", value: stats.inactive, color: "text-red-600", bg: "bg-red-100" },
          { label: "Categories", value: stats.categories, color: "text-indigo-600", bg: "bg-indigo-100" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-background border border-border card-shadow p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bg}`}>
              <Wrench className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <div className={`font-display text-xl font-bold leading-none ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-secondary/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Search services..."
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            Loading services...
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <Wrench className="h-14 w-14 mx-auto mb-4 text-muted-foreground opacity-30" />
            <h3 className="font-semibold text-lg mb-2">No services found</h3>
            <p className="text-sm text-muted-foreground mb-5">Create a service manually to show it in the customer panel.</p>
            {permissions.canCreate && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg cta-gradient text-white text-sm font-semibold"
              >
                <Plus className="h-4 w-4" />
                Create Service
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredServices.map((service) => (
              <div key={service.id} className="p-5 flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h3 className="font-semibold text-lg">{service.name}</h3>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        service.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                      }`}
                    >
                      {service.isActive ? "Visible to Customers" : "Hidden"}
                    </span>
                    {service.category && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {service.category}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{service.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {(service.features || []).map((feature) => (
                      <span key={feature} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-xs">
                        <Check className="h-3 w-3 text-green-600" />
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0">
                  <div className="text-right">
                    <div className="font-semibold text-primary">{service.price}</div>
                    <div className="text-xs text-muted-foreground">Order {service.orderIndex ?? 0}</div>
                  </div>
                  {(permissions.canEdit || permissions.canDelete) && (
                    <div className="flex items-center gap-2">
                      {permissions.canEdit && (
                        <button
                          onClick={() => openEdit(service)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit
                        </button>
                      )}
                      {permissions.canDelete && (
                        <button
                          onClick={() => deleteService(service)}
                          disabled={deletingId === service.id}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-60"
                        >
                          {deletingId === service.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <ServiceModal
          service={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSaved={loadServices}
        />
      )}
    </div>
  );
};

export default Services;
