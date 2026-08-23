import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import logo from "../assets/techwareLogo.png";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Services", href: "#services" },
  { label: "Product", href: "#machines" },
  { label: "Contact", href: "#contact" },
];

const Navbar = ({ staticPosition = false }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const sectionPath = pathname === "/" ? "" : "/";

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`${staticPosition ? "sticky" : "fixed"} top-0 left-0 right-0 z-50 bg-background shadow-md border-b border-border`}
    >
      <div className="w-full max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 flex items-center justify-between h-14 sm:h-16 md:h-20">
        {/* Logo */}
        <a
          href={`${sectionPath}#home`}
          className="flex items-center gap-2 sm:gap-3 md:gap-4 group ml-0 sm:-ml-2 md:-ml-8 lg:-ml-16"
        >
          <img
            src={logo}
            alt="Techware Automation India"
            className="h-11 sm:h-12 md:h-14 lg:h-16 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
          />
          <div className="hidden sm:flex flex-col justify-center">
            <h1
              className="text-[1.1rem] sm:text-[1.2rem] md:text-[1.35rem] font-bold"
              style={{ lineHeight: 1 }}
            >
              <span style={{ color: "#2A3791" }}>Techware</span>
            </h1>

            <p
              className="text-[0.85rem] sm:text-[0.9rem] md:text-[0.95rem] font-semibold mt-1"
              style={{
                letterSpacing: "0.18em",
                lineHeight: 1.25,
              }}
            >
              <span style={{ color: "#2A3791" }}>Automation</span>
              <br />
              <span style={{ color: "#339DE0" }}>(INDIA)</span>
            </p>
          </div>
        </a>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={`${sectionPath}${link.href}`}
              className="relative text-sm font-semibold text-foreground/80 hover:text-primary transition-all duration-300 after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-0 after:bg-[#339DE0] after:transition-all after:duration-300 hover:after:w-full"
            >
              {link.label}
            </a>
          ))}

          {/* Single Login Button */}
          <Link
            to="/login"
            className="cta-gradient text-white font-semibold px-6 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm inline-flex items-center gap-1.5"
          >
            Login
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background border-b border-border shadow-md"
          >
            <div className="section-container py-4 flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={`${sectionPath}${link.href}`}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              ))}

              {/* Mobile Login Button */}
              <div className="pt-2 border-t border-border">
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="cta-gradient text-white font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity text-sm text-center block"
                >
                  Login
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
