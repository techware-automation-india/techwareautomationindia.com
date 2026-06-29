import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import machines from "../data/machines";

const featuredMachines = machines.slice(0, 4);

const MachinesSection = () => {
  const ref = useRef(null);

  const isInView = useInView(ref, {
    once: true,
    margin: "-100px",
  });

  return (
    <section id="machines" className="relative py-20 overflow-hidden">
      <div className="absolute inset-0 grid-overlay opacity-20" />

      <div ref={ref} className="section-container relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.span
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            className="text-sm font-semibold text-primary uppercase tracking-widest"
          >
            Our Products
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 }}
            className="font-display text-4xl md:text-5xl font-bold mt-3 mb-4"
          >
            Built for
            <span className="gradient-text"> Production</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground text-lg"
          >
            Purpose-built automation machines designed for smart card manufacturing,
            testing and inspection.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {featuredMachines.map((machine, index) => (
            <motion.div
              key={machine.name}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.6,
                delay: index * 0.15,
              }}
              className="group rounded-3xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-all duration-300"
            >
              <div className="relative h-[420px] overflow-hidden bg-slate-100">
                <img
                  src={machine.image}
                  alt={machine.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
              </div>

              <div className="p-6">
                <h3 className="font-display text-2xl font-bold mb-3">
                  {machine.name}
                </h3>

                <p className="text-muted-foreground text-sm leading-relaxed mb-5 line-clamp-2">
                  {machine.desc}
                </p>

                <div className="flex flex-wrap gap-2">
                  {machine.features?.slice(0, 2).map((feature) => (
                    <span
                      key={feature}
                      className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <Link
            to="/machines"
            className="cta-gradient text-white font-semibold px-8 py-4 rounded-xl inline-flex items-center gap-2"
          >
            View All Products
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default MachinesSection;