
import logo from "../assets/techwareLogo.png";
import {
  FaLinkedinIn,
  FaWhatsapp,
  FaYoutube,
  FaInstagram,
  FaFacebookF,
} from "react-icons/fa";

const Footer = () => {
  const socialLinks = [
    {
      icon: FaLinkedinIn,
      href: "https://www.linkedin.com/in/techware-automation-india-640b25410/",
      label: "LinkedIn",
    },
    {
      icon: FaWhatsapp,
      href: "https://wa.me/919650678040",
      label: "WhatsApp",
    },
    {
      icon: FaYoutube,
      href: "https://www.youtube.com/@TechwareAutomation",
      label: "YouTube",
    },
    {
      icon: FaInstagram,
      href: "https://www.instagram.com/techware_automation_india",
      label: "Instagram",
    },
    {
      icon: FaFacebookF,
      href: "https://www.facebook.com/profile.php?id=61590028692801",
      label: "Facebook",
    },
  ];

  return (
    <footer className="bg-card border-t border-border">
      <div className="section-container py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Company Info */}
          <div>
            <a href="#home" className="flex items-center mb-4">
              <img
                src={logo}
                alt="Techware Automation India"
                className="h-20 w-auto"
              />
            </a>

          

            {/* Social Media */}
            <div>
             

              <div className="flex flex-wrap gap-3">
                {socialLinks.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                   
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className="w-10 h-10 rounded-lg bg-primary/10 border border-border flex items-center justify-center hover:bg-primary hover:text-white transition-all duration-300"
                  >
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Quick Links</h4>

            <div className="space-y-2">
              {[
                "Home",
                "About",
                "Services",
                "Products",
              ].map((link) => (
                <a
                  key={link}
                  href={`#${link.toLowerCase()}`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Services</h4>

            <div className="space-y-2">
              {[
                "Industrial Automation",
                "Machine Development",
                "Card Validation",
                "Software Solutions",
                "Maintenance",
                "PLC Integration",
              ].map((service) => (
                <div
                  key={service}
                  className="text-sm text-muted-foreground"
                >
                  {service}
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Contact</h4>

            <div className="space-y-2 text-sm text-muted-foreground">
              <div>
                <a
                  href="mailto:info@techwareautomation.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  info@techwareautomation.com
                </a>
              </div>

              <div>
                <a
                  href="tel:+919650678040"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  +91 96506 78040
                </a>
              </div>

              <div>Khasra No. 1099</div>
              <div>Vikas Nagar Industrial Area</div>
              <div>Meerut Road, Ghaziabad</div>
              <div>Ghaziabad, Uttar Pradesh - 201003</div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div>
            © {new Date().getFullYear()} Techware Automation India. All rights
            reserved.
          </div>

          <div className="flex gap-4">
            <a
              href="/privacy-policy"
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </a>

            <a
              href="/terms-of-service"
              className="hover:text-foreground transition-colors"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

