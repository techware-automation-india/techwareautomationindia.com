import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Shield, Cpu, Settings, Target } from "lucide-react";

const pillars = [
  { icon: Cpu, title: "Engineering Excellence", desc: "Custom-designed automation systems powered by modern tech for seamless control and monitoring." },
  { icon: Shield, title: "Quality Assurance", desc: "Every machine undergoes rigorous testing to ensure reliability in high-volume production environments." },
  { icon: Settings, title: "Custom Solutions", desc: "Tailored automation systems designed to fit your exact production workflow and requirements." },
  { icon: Target, title: "Scalable Systems", desc: "Modular architecture that grows with your business, from pilot lines to full production." },
];

const AboutSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="about" className="section-padding relative overflow-hidden">
      <div className="absolute inset-0 grid-overlay opacity-50" />
      <div className="section-container relative" ref={ref}>
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <motion.span initial={{ opacity: 0, x: -20 }} animate={isInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.5 }} className="text-sm font-semibold text-primary uppercase tracking-widest">
              About Us
            </motion.span>
            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.1 }} className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mt-3 mb-6">
              Engineering the Future of{" "}<span className="gradient-text">Card Production</span>
            </motion.h2>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.2 }} className="text-muted-foreground text-lg leading-relaxed mb-4">
              With over a decade of expertise, we design and manufacture automation machines and validation systems for the card manufacturing industry. From banking cards to smart cards, our systems ensure precision, speed, and reliability.
            </motion.p>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.3 }} className="text-muted-foreground leading-relaxed">
              Our mission: deliver reliable and scalable automation solutions that transform production workflows and eliminate manual errors.
            </motion.p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {pillars.map((pillar, i) => (
              <motion.div key={pillar.title} initial={{ opacity: 0, y: 30 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }} className="p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors card-shadow group">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <pillar.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display font-semibold mb-2">{pillar.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{pillar.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
