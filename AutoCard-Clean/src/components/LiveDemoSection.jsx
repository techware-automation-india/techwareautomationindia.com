import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import demoVideo_1 from "../video/VID-20240805-WA0001.mp4";
import demoVideo_2 from "../video/SHEET COLLATION MACHINE WORKING TEST.mp4"
import demoVideo_3 from "../video/demo_3.mp4"
const demos = [
  { title: "Card Sorting Machine", desc: "High-speed automated sorting with multi-bin classification.", video: demoVideo_1 },
  { title: "QR Validation System", desc: "Real-time QR and barcode scanning with pass/fail logic.", video: demoVideo_2 },
  { title: "Card Feeding System", desc: "Precision feeding mechanism for continuous production.", video: demoVideo_3 },

];

const LiveDemoSection = () => {
  const ref = useRef(null);
  const scrollRef = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -400 : 400, behavior: "smooth" });
  };

  return (
    <section className="section-padding relative" ref={ref}>
      <div className="section-container">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <motion.span initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}} className="text-sm font-semibold text-primary uppercase tracking-widest">Live Demo</motion.span>
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.1 }} className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mt-3 mb-4">
            See It <span className="gradient-text">In Action</span>
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}} transition={{ delay: 0.2 }} className="text-muted-foreground text-lg">
            Watch our machines working in real production environments
          </motion.p>
        </div>

        <div className="flex justify-end gap-2 mb-6">
          <button onClick={() => scroll("left")} className="w-10 h-10 rounded-full border border-border bg-card flex items-center justify-center hover:bg-secondary transition-colors">
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <button onClick={() => scroll("right")} className="w-10 h-10 rounded-full border border-border bg-card flex items-center justify-center hover:bg-secondary transition-colors">
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.3 }} ref={scrollRef} className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {demos.map((demo) => (
            <div key={demo.title} className="flex-shrink-0 w-[340px] md:w-[420px] snap-start rounded-2xl overflow-hidden bg-card border border-border card-shadow group">
              <div className="relative aspect-video">
                <video autoPlay muted loop playsInline className="w-full h-full object-cover">
                  <source src={demo.video} type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-foreground/10 group-hover:bg-transparent transition-colors" />
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-primary/90 text-white text-xs font-semibold flex items-center gap-1">
                  <Play className="h-3 w-3" /> Live
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-display text-lg font-semibold mb-1">{demo.title}</h3>
                <p className="text-sm text-muted-foreground">{demo.desc}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default LiveDemoSection;
