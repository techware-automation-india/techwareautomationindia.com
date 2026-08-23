import { useState, useEffect } from "react";
import { ShoppingBag, Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../../lib/api.js";
import { toast } from "sonner";

const Services = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestingId, setRequestingId] = useState(null);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/services");
      setServices(data.services || []);
    } catch (err) {
      console.error("Failed to load services:", err);
      toast.error(err.message || "Failed to load services.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestQuote = async (service) => {
    if (requestingId) return;

    setRequestingId(service.id);
    try {
      const payload = {
        serviceId: service.id,
        subject: `Service request: ${service.name}`,
        description: [
          `I would like to request a quote for ${service.name}.`,
          service.category ? `Category: ${service.category}` : null,
          service.price ? `Listed price: ${service.price}` : null,
        ].filter(Boolean).join("\n"),
        priority: "MEDIUM",
      };

      await apiPost("/customers/me/requests", payload);
      toast.success(`Request created for "${service.name}".`);
      navigate("/customer/requests", { state: { createdServiceRequest: service.name } });
    } catch (err) {
      console.error("Failed to create service request:", err);
      toast.error(err.message || "Failed to create service request.");
    } finally {
      setRequestingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShoppingBag className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Services</h1>
          <p className="text-sm text-muted-foreground">Browse our available services and packages</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {services.length === 0 ? (
          <div className="col-span-2 rounded-2xl bg-background border border-border card-shadow p-12 text-center">
            <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <h3 className="font-semibold text-lg mb-2">No Services Available</h3>
            <p className="text-sm text-muted-foreground">
              Check back later for available services and packages.
            </p>
          </div>
        ) : (
          services.map((service) => (
            <div key={service.id} className="rounded-2xl bg-background border border-border card-shadow p-6 space-y-4">
              <h3 className="font-semibold text-xl">{service.name}</h3>
              <p className="text-sm text-muted-foreground">{service.description}</p>
              
              <ul className="space-y-2">
                {service.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="pt-4 border-t border-border flex items-center justify-between">
                <span className="font-semibold text-lg text-primary">{service.price}</span>
                <button 
                  onClick={() => handleRequestQuote(service)}
                  disabled={requestingId === service.id}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {requestingId === service.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  {requestingId === service.id ? "Creating..." : "Request Quote"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Services;
