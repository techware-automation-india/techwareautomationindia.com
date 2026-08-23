import { useState, useEffect } from "react";
import { Headphones, Mail, Phone, MessageCircle, Clock, Loader2, HelpCircle } from "lucide-react";
import { apiGet } from "../../lib/api.js";
import { toast } from "sonner";

const Support = () => {
  const [supportInfo, setSupportInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSupportInfo();
  }, []);

  const loadSupportInfo = async () => {
    setLoading(true);
    try {
      // Public endpoint - no auth required
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4001"}/api/support`);
      const data = await response.json();
      setSupportInfo(data);
    } catch (err) {
      console.error("Failed to load support info:", err);
      toast.error("Failed to load support information.");
      // Set default values on error
      setSupportInfo({
        companyName: "Techware Automation India",
        supportEmail: "support@techwareautomation.com",
        supportPhone: "+91 9876543210",
        liveChatEnabled: false,
        supportHours: {
          monday: { open: "10:00 AM", close: "06:00 PM", isOpen: true },
          tuesday: { open: "09:00 AM", close: "06:00 PM", isOpen: true },
          wednesday: { open: "09:00 AM", close: "06:00 PM", isOpen: true },
          thursday: { open: "09:00 AM", close: "06:00 PM", isOpen: true },
          friday: { open: "09:00 AM", close: "06:00 PM", isOpen: true },
          saturday: { open: "10:00 AM", close: "04:00 PM", isOpen: true },
          sunday: { open: "", close: "", isOpen: false }
        },
        faqs: []
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailClick = () => {
    window.location.href = `mailto:${supportInfo?.supportEmail}`;
  };

  const handlePhoneClick = () => {
    window.location.href = `tel:${supportInfo?.supportPhone}`;
  };

  const handleChatClick = () => {
    if (supportInfo?.liveChatUrl) {
      window.open(supportInfo.liveChatUrl, '_blank');
    } else {
      toast.info("Live chat is currently unavailable. Please use email or phone support.");
    }
  };

  const getDayName = (key) => {
    const days = {
      monday: "Monday",
      tuesday: "Tuesday",
      wednesday: "Wednesday",
      thursday: "Thursday",
      friday: "Friday",
      saturday: "Saturday",
      sunday: "Sunday"
    };
    return days[key] || key;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading support information...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Headphones className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Support</h1>
          <p className="text-sm text-muted-foreground">Get help from our support team</p>
        </div>
      </div>

      {/* Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-background border border-border card-shadow p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mx-auto">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="font-semibold">Email Support</h3>
          <p className="text-sm text-muted-foreground">{supportInfo?.supportEmail || "support@techwareautomation.com"}</p>
          <button 
            onClick={handleEmailClick}
            className="w-full px-4 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity text-sm"
          >
            Send Email
          </button>
        </div>

        <div className="rounded-2xl bg-background border border-border card-shadow p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mx-auto">
            <Phone className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="font-semibold">Phone Support</h3>
          <p className="text-sm text-muted-foreground">{supportInfo?.supportPhone || "+91 9876543210"}</p>
          <button 
            onClick={handlePhoneClick}
            className="w-full px-4 py-2 rounded-lg border border-border bg-background hover:bg-secondary transition-colors text-sm font-medium"
          >
            Call Now
          </button>
        </div>

        <div className="rounded-2xl bg-background border border-border card-shadow p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mx-auto">
            <MessageCircle className="h-6 w-6 text-purple-600" />
          </div>
          <h3 className="font-semibold">Live Chat</h3>
          <p className="text-sm text-muted-foreground">
            {supportInfo?.liveChatEnabled ? "Available now" : "Currently unavailable"}
          </p>
          <button 
            onClick={handleChatClick}
            disabled={!supportInfo?.liveChatEnabled}
            className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              supportInfo?.liveChatEnabled
                ? "border border-border bg-background hover:bg-secondary"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {supportInfo?.liveChatEnabled ? "Start Chat" : "Unavailable"}
          </button>
        </div>
      </div>

      {/* Office Hours */}
      <div className="rounded-2xl bg-background border border-border card-shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Support Hours</h3>
        </div>
        <div className="space-y-2 text-sm">
          {supportInfo?.supportHours && Object.entries(supportInfo.supportHours).map(([day, hours]) => (
            <div key={day} className="flex justify-between">
              <span className="text-muted-foreground capitalize">{getDayName(day)}</span>
              <span className={`font-medium ${!hours.isOpen ? 'text-red-600' : ''}`}>
                {hours.isOpen ? `${hours.open} - ${hours.close}` : "Closed"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      {supportInfo?.faqs && supportInfo.faqs.length > 0 && (
        <div className="rounded-2xl bg-background border border-border card-shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Frequently Asked Questions</h3>
          </div>
          <div className="space-y-4">
            {supportInfo.faqs.map((faq, idx) => (
              <div key={idx} className="p-4 rounded-lg bg-secondary/20 border border-border">
                <h4 className="font-semibold text-sm mb-2">{faq.question}</h4>
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Support;
