import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { TrendingDown, Zap, Target, DollarSign, Layers } from "lucide-react";

const benefits = [
  { icon: TrendingDown, stat: "95%", label: "Reduced Manual Errors", desc: "Eliminate human error from validation and sorting processes.", color: "from-blue-500 to-cyan-400" },
  { icon: Zap, stat: "3x", label: "Faster Production", desc: "Dramatically accelerate throughput with automated systems.", color: "from-amber-500 to-orange-400" },
  { icon: Target, stat: "99.8%", label: "High Accuracy", desc: "Precision scanning and validation with near-perfect accuracy.", color: "from-emerald-500 to-green-400" },
  { icon: DollarSign, stat: "40%", label: "Cost Efficiency", desc: "Lower operational costs through automation and reduced waste.", color: "from-violet-500 to-purple-400" },
  { icon: Layers, stat: "∞", label: "Scalable Systems", desc: "Modular designs that scale from pilot to full production.", color: "from-rose-500 to-pink-400" },
];

const BenefitsSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="section-padding relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      <div className="section-container relative" ref={ref}>
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.span initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}} className="text-sm font-semibold text-primary uppercase tracking-widest">Why Choose Us</motion.span>
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.1 }} className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mt-3 mb-4">
            Measurable <span className="gradient-text">Impact</span>
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.2 }} className="text-muted-foreground text-lg">Numbers that speak for themselves</motion.p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {benefits.map((b, i) => (
            <motion.div key={b.label} initial={{ opacity: 0, y: 30 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.1 * i }} className="group text-center p-8 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 card-shadow hover:card-shadow-hover relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${b.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${b.color} flex items-center justify-center mx-auto mb-5 shadow-lg`}>
                <b.icon className="h-7 w-7 text-white" />
              </div>
              <div className="font-display text-4xl font-bold gradient-text mb-2">{b.stat}</div>
              <div className="font-semibold text-sm mb-2">{b.label}</div>
              <p className="text-xs text-muted-foreground leading-relaxed">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
