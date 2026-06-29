import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import axios from "axios";
import {
  FaWhatsapp,
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaLinkedinIn,
} from "react-icons/fa";

const ContactSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
  });

  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);


  const handleSubmit = async (e) => {
    e.preventDefault();
    const blockedDomains = [
      "tempmail.com",
      "mailinator.com",
      "10minutemail.com",
      "yopmail.com",
      "guerrillamail.com",
    ];

    const suspiciousWords = [
      "test",
      "testing",
      "admin",
      "asdf",
      "qwerty",
      "demo",
    ];





    const data = new FormData();

    data.append("name", formData.name);
    data.append("email", formData.email);
    data.append("phone", formData.phone);
    data.append("company", formData.company);
    data.append("message", formData.message);

    if (photo) {
      data.append("photo", photo);
    }

    try {
      setLoading(true);

      const response = await axios.post(
        "http://localhost:4000/api/contact",
        data,

      );

      toast.success(response.data.message);

      setFormData({
        name: "",
        email: "",
        phone: "",
        company: "",
        message: "",
      });

      setPhoto(null);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        "Failed to send message"
      );
    } finally {
      setLoading(false);
    }
  };


  const inputClass = "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow";

  return (
    <section id="contact" className="section-padding bg-card/50 relative">
      <div className="absolute inset-0 grid-overlay opacity-30" />
      <div className="section-container relative" ref={ref}>
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.span initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}} className="text-sm font-semibold text-primary uppercase tracking-widest">Get In Touch</motion.span>
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.1 }} className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mt-3 mb-4">
            Let's Build Your <span className="gradient-text">Automation System</span>
          </motion.h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.2 }}
          >
            <h3 className="font-display text-xl font-bold mb-6">
              Contact Information
            </h3>

            <div className="space-y-6 mb-10">
              {[
                {
                  icon: Mail,
                  label: "Email",
                  value: "info@techwareautomation.com",
                  link: "mailto:info@techwareautomation.com",
                },
                {
                  icon: Phone,
                  label: "Phone",
                  value: "+91 9650678040",
                  link: "tel:+919650678040",
                },
                {
                  icon: MapPin,
                  label: "Location",
                  value:
                    "Khasra No. 1099, Vikas Nagar Industrial Area\nMeerut Road, Ghaziabad\nUttar Pradesh - 201003",
                  link:
                    "https://www.google.com/maps/dir/28.6940139,77.4363853/Techware+Automation+INDIA,+Khasra+No.+1099,+Vikas+Nagar,+Industrial+Area,+Ghukna,+Ghaziabad,+Uttar+Pradesh+201003/@28.694029,77.433864,17z/data=!3m1!4b1!4m17!1m7!3m6!1s0x390cf1cc085c77fb:0x1689002c4c8e4d56!2sTechware+Automation+INDIA!8m2!3d28.6940557!4d77.4364926!16s%2Fg%2F11kb33hdtj!4m8!1m1!4e1!1m5!1m1!1s0x390cf1cc085c77fb:0x1689002c4c8e4d56!2m2!1d77.4364926!2d28.6940557!18m1!1e1?entry=ttu&g_ep=EgoyMDI2MDYxMC4wIKXMDSoASAFQAw%3D%3D",
                },
              ].map(({ icon: Icon, label, value, link }) => (
                <div
                  key={label}
                  className="flex items-start gap-4"
                >
                  {/* Icon */}
                  <a
                    href={link}
                    target={label === "Location" ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors"
                  >
                    <Icon className="h-5 w-5 text-primary" />
                  </a>

                  {/* Content */}
                  <div>
                    <div className="font-semibold text-sm mb-1">
                      {label}
                    </div>

                    <a
                      href={link}
                      target={label === "Location" ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className="text-muted-foreground text-sm whitespace-pre-line hover:text-primary transition-colors"
                    >
                      {value}
                    </a>
                  </div>
                </div>
              ))}
            </div>



            {/* Business Hours */}

            <div className="p-6 rounded-xl bg-card border border-border">
              <h4 className="font-semibold mb-3">
                Business Hours
              </h4>

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Monday - Saturday</span>
                  <span>10:00 AM - 06:00 PM</span>
                </div>

                <div className="flex justify-between">
                  <span>Sunday</span>
                  <span>Closed</span>
                </div>
              </div>
            </div>
          </motion.div>



          <motion.form
            noValidate
            onSubmit={handleSubmit}
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <input
                className={inputClass}
                placeholder="Your Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    name: e.target.value,
                  }))
                }
                required
              />

              <input
                type="email"
                className={inputClass}
                placeholder="Email Address"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                autoComplete="email"
                required
              />
            </div>

            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              className={inputClass}
              placeholder="9876543210"
              value={formData.phone}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");

                setFormData((prev) => ({
                  ...prev,
                  phone: value,
                }));
              }}
              required
            />

            <input
              className={inputClass}
              placeholder="Company Name"
              value={formData.company}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  company: e.target.value,
                }))
              }
              required
            />

            <input
              type="file"
              accept=".jpg,.jpeg,.png"
              className={inputClass}
              onChange={(e) =>
                setPhoto(e.target.files[0])
              }
            />



            <textarea
              className={inputClass + " resize-none"}
              placeholder="Tell us about your automation needs..."
              value={formData.message}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  message: e.target.value,
                }))
              }
              rows={5}
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full cta-gradient text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm"
            >
              <Send className="h-4 w-4" />
              {loading ? "Sending..." : "Send Message"}
            </button>
          </motion.form>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
