import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import industryBanking from "../assets/industry-banking.jpg";
import industryId from "../assets/industry-id.jpg";
import industrySim from "../assets/industry-sim.jpg";
import industrySmart from "../assets/industry-smart.jpg";

const industries = [
  { image: industryBanking, name: "Banking Cards", desc: "Debit, credit, and prepaid card manufacturing automation." },
  { image: industryId, name: "ID Cards", desc: "National ID, driver's license, and access card production." },
  { image: industrySim, name: "SIM Cards", desc: "Telecom SIM card validation, sorting, and packaging." },
  { image: industrySmart, name: "Smart Cards", desc: "Chip-based smart card testing and quality assurance." },
];

const IndustriesSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="section-padding relative">
      <div className="section-container relative" ref={ref}>
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.span initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}} className="text-sm font-semibold text-primary uppercase tracking-widest">Industries We Serve</motion.span>
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.1 }} className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mt-3">
            Versatile <span className="gradient-text">Applications</span>
          </motion.h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {industries.map((ind, i) => (
            <motion.div key={ind.name} initial={{ opacity: 0, scale: 0.95 }} animate={isInView ? { opacity: 1, scale: 1 } : {}} transition={{ duration: 0.5, delay: 0.1 * i }} className="group relative h-72 rounded-2xl overflow-hidden card-shadow hover:card-shadow-hover transition-shadow duration-300">
              <img src={ind.image} alt={ind.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <h3 className="font-display text-xl font-bold mb-1">{ind.name}</h3>
                <p className="text-sm text-white/70">{ind.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default IndustriesSection;
