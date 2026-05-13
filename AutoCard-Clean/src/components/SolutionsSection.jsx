import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { CheckCircle2 } from "lucide-react";

const solutions = [
  { title: "Card Sequence Validator System", problem: "Incorrect card sequencing causing downstream production errors and customer complaints.", solution: "Dual-scanner inline validation system with real-time sequence checking and auto-correction.", result: "98% reduction in sequence errors, 3x faster throughput.", tags: ["Banking Cards", "Sequence Validation"] },
  { title: "Dual Scanner Validation System", problem: "Manual QR/barcode validation causing bottlenecks and inconsistent quality checks.", solution: "Automated dual-scanner system with pass/fail logic, real-time logging, and reject bin routing.", result: "99.8% validation accuracy, eliminated manual inspection.", tags: ["Smart Cards", "QR Validation"] },
  { title: "Automated Sorting Line", problem: "Mixed card types on a single production line requiring manual sorting and classification.", solution: "Vision-guided sorting system with classification engine and multi-bin output.", result: "5000+ cards/hour sorted, zero cross-contamination.", tags: ["SIM Cards", "ID Cards"] },
];

const SolutionsSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="solutions" className="section-padding bg-card/50 relative">
      <div className="absolute inset-0 grid-overlay opacity-30" />
      <div className="section-container relative" ref={ref}>
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.span initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}} className="text-sm font-semibold text-primary uppercase tracking-widest">Projects & Solutions</motion.span>
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.1 }} className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mt-3 mb-4">
            Real <span className="gradient-text">Implementations</span>
          </motion.h2>
        </div>

        <div className="space-y-8">
          {solutions.map((sol, i) => (
            <motion.div key={sol.title} initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }} animate={isInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.2 * i }} className="rounded-2xl bg-background border border-border p-8 md:p-10 card-shadow hover:border-primary/20 transition-colors">
              <div className="flex flex-wrap gap-2 mb-4">
                {sol.tags.map((tag) => (
                  <span key={tag} className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">{tag}</span>
                ))}
              </div>
              <h3 className="font-display text-xl md:text-2xl font-bold mb-6">{sol.title}</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm font-semibold text-destructive mb-2">⚠ Problem</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{sol.problem}</p>
                </div>
                <div>
                  <div className="text-sm font-semibold text-primary mb-2">⚙ Solution</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{sol.solution}</p>
                </div>
                <div>
                  <div className="text-sm font-semibold text-amber-500 mb-2 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Result</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{sol.result}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SolutionsSection;
