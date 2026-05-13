import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import machineCardSorting from "../assets/machine-card-sorting.jpg";
import machineQrValidation from "../assets/machine-qr-validation.jpg";
import machineCardFeeding from "../assets/machine-card-feeding.jpg";
import machineConveyorInspection from "../assets/machine-conveyor-inspection.jpg";

const machines = [
  { name: "Card Sorting Machine", image: machineCardSorting, desc: "High-speed automated card sorting with multi-bin output for classification by type, quality, or sequence.", features: ["5000+ cards/hour", "Multi-bin sorting", "Auto-reject system"] },
  { name: "QR Validation Machine", image: machineQrValidation, desc: "Real-time QR and barcode validation system with pass/fail classification and data logging.", features: ["Real-time scanning", "Pass/Fail logging", "Database integration"] },
  { name: "Card Feeding System", image: machineCardFeeding, desc: "Precision card feeding mechanism for consistent input to downstream processing stations.", features: ["Continuous feed", "Anti-jam design", "Variable speed control"] },
  { name: "Conveyor Inspection System", image: machineConveyorInspection, desc: "Vision-based conveyor inspection with AI-powered defect detection for quality assurance.", features: ["AI defect detection", "High-res cameras", "Auto-eject faulty cards"] },
];

const MachinesSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="machines" className="section-padding relative">
      <div className="absolute inset-0 grid-overlay opacity-30" />
      <div className="section-container relative" ref={ref}>
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.span initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}} className="text-sm font-semibold text-primary uppercase tracking-widest">Our Machines</motion.span>
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.1 }} className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mt-3 mb-4">
            Built for <span className="gradient-text">Production</span>
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.2 }} className="text-muted-foreground text-lg">
            Purpose-built automation machines designed for the card manufacturing industry
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {machines.map((machine, i) => (
            <motion.div key={machine.name} initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.15 * i }} className="group rounded-2xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-all duration-300 card-shadow">
              <div className="relative h-56 overflow-hidden">
                <img src={machine.image} alt={machine.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
              </div>
              <div className="p-6">
                <h3 className="font-display text-xl font-bold mb-2">{machine.name}</h3>
                <p className="text-muted-foreground text-sm mb-4 leading-relaxed">{machine.desc}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {machine.features.map((f) => (
                    <span key={f} className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">{f}</span>
                  ))}
                </div>
                <button className="text-primary hover:bg-primary/10 text-sm font-medium flex items-center gap-1 px-0 py-1 rounded transition-colors">
                  Learn More <ArrowRight className="ml-1 h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MachinesSection;
