const Footer = () => {
  return (
    <footer className="bg-card border-t border-border">
      <div className="section-container py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="font-display text-lg font-bold mb-4">
              <span className="gradient-text">AutoCard</span> Systems
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Advanced automation machines for the card manufacturing industry. Precision, speed, reliability.
            </p>
          </div>

          <div>
            <div className="font-semibold text-sm mb-4">Quick Links</div>
            <div className="space-y-2">
              {["Home", "About", "Services", "Machines", "Solutions"].map((link) => (
                <a key={link} href={`#${link.toLowerCase()}`} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">{link}</a>
              ))}
            </div>
          </div>

          <div>
            <div className="font-semibold text-sm mb-4">Services</div>
            <div className="space-y-2">
              {["Industrial Automation", "Machine Development", "Card Validation", "Software Solutions", "Maintenance"].map((s) => (
                <div key={s} className="text-sm text-muted-foreground">{s}</div>
              ))}
            </div>
          </div>

          <div>
            <div className="font-semibold text-sm mb-4">Contact</div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>info@autocardsystems.com</div>
              <div>+1 (555) 123-4567</div>
              <div>Industrial Zone, Tech Park</div>
              <div>Suite 200, CA 94107</div>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} AutoCard Systems. All rights reserved.</div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
