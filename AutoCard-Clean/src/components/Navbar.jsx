import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronDown, ShieldCheck, Briefcase, User } from "lucide-react";
import logo from "../assets/techwareLogo.png";
const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Services", href: "#services" },
  { label: "Product", href: "#machines" },
  { label: "Contact", href: "#contact" },
];

// const loginRoles = [
//   { role: "admin", label: "Login as Admin", desc: "System administration access", icon: ShieldCheck },
//   { role: "employee", label: "Login as Employee", desc: "Staff dashboard access", icon: Briefcase },
//   { role: "customer", label: "Login as Customer", desc: "Track orders & support", icon: User },
// ];

const Navbar = ({ staticPosition = false }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const loginRef = useRef(null);
  const { pathname } = useLocation();
  const sectionPath = pathname === "/" ? "" : "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (loginRef.current && !loginRef.current.contains(e.target)) {
        setLoginOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const isSolid = staticPosition || scrolled;

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`${staticPosition ? "sticky" : "fixed"} top-0 left-0 right-0 z-50 bg-white shadow-md border-b border-gray-200`}
    >
      <div className="w-full max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 flex items-center justify-between h-14 sm:h-16 md:h-20">

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
            <h1 className="text-[24px] md:text-[28px] lg:text-[34px] font-extrabold leading-none tracking-tight">
              <span style={{ color: "#2A3791" }}>TECH</span>
              <span style={{ color: "#2A3791" }}>WARE</span>
            </h1>

            <p
              className="uppercase text-[11px] md:text-xs font-semibold mt-1"
              style={{
                letterSpacing: "0.28em",
                lineHeight: 1.2,
              }}
            >
              <span style={{ color: "#2A3791" }}>AUTOMATION </span>
              <span style={{ color: "#339DE0" }}>INDIA</span>
            </p>
          </div>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={`${sectionPath}${link.href}`}
              className="relative text-sm font-semibold text-slate-700 hover:text-[#2A3791] transition-all duration-300 after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-0 after:bg-[#339DE0] after:transition-all after:duration-300 hover:after:w-full"
            >
              {link.label}
            </a>
          ))}

          {/* <div className="relative" ref={loginRef}>
            <button
              onClick={() => setLoginOpen((o) => !o)}
              className="cta-gradient text-white font-semibold px-6 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm inline-flex items-center gap-1.5"
            >
              Login
              <ChevronDown className={`h-4 w-4 transition-transform ${loginOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {loginOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute right-0 mt-2 w-64 rounded-xl bg-background border border-border shadow-lg overflow-hidden p-2"
                >
                  {loginRoles.map(({ role, label, desc, icon: Icon }) => (
                    <Link
                      key={role}
                      to={`/login/${role}`}
                      onClick={() => setLoginOpen(false)}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{label}</div>
                        <div className="text-xs text-muted-foreground">{desc}</div>
                      </div>
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div> */}
        </div>

        <button
          className="md:hidden text-gray-700"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-gray-200 shadow-md"
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

              <div className="pt-2 border-t border-border">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Login</div>
                <div className="flex flex-col gap-2">
                  {loginRoles.map(({ role, label, desc, icon: Icon }) => (
                    <Link
                      key={role}
                      to={`/login/${role}`}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{label}</div>
                        <div className="text-xs text-muted-foreground">{desc}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
