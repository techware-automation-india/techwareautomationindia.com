
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import heroMachine from "../assets/herobackground_img.jpg"; // Your machine image

const HeroSection = () => {
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center overflow-hidden bg-slate-950"
    >
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.15),transparent_40%)]" />
      </div>

      <div className="container mx-auto px-6 relative z-10 pt-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* LEFT CONTENT */}
          <div>
           

            <motion.h1
  initial={{ opacity: 0, y: 30 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6 }}
 className="text-4xl sm:text-5xl md:text-[46px] lg:text-[52px] xl:text-[58px] 2xl:text-[64px] font-extrabold leading-[1.1] tracking-tight text-white mb-6 max-w-[680px]"
>
  Techware Automation
  <br />

  <span className="text-white">(INDIA)</span>
  <br />

  Machines for{" "}
  <span className="text-amber-400">
    Card Manufacturing
  </span>

  <br />

  Industry
</motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-slate-300 max-w-xl mb-10"
            >Delivering Industrial Automation, PLC Integration, Custom Machines, Software Solutions, and Card Validation for efficient and reliable operations.
            </motion.p>

            {/* Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap gap-4 mb-12"
            >
              <a
                href="#machines"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold flex items-center gap-2 transition"
              >
                View Products
                <ArrowRight size={18} />
              </a>

              <a
                href="#contact"
                className="border border-white/20 hover:bg-white/10 text-white px-8 py-4 rounded-xl font-semibold flex items-center gap-2 transition"
              >
                <Play size={18} />
                Contact Us
              </a>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="grid grid-cols-3 gap-6 border-t border-white/10 pt-8"
            >
              <div>
                <h3 className="text-3xl font-bold text-amber-400">
                  100+
                </h3>
                <p className="text-slate-400 text-sm">
                  Machines Deployed
                </p>
              </div>

              <div>
                <h3 className="text-3xl font-bold text-amber-400">
                  99.8%
                </h3>
                <p className="text-slate-400 text-sm">
                  Accuracy Rate
                </p>
              </div>

              <div>
                <h3 className="text-3xl font-bold text-amber-400">
                  20+
                </h3>
                <p className="text-slate-400 text-sm">
                  Years Experience
                </p>
              </div>
            </motion.div>
          </div>

          {/* RIGHT IMAGE */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="hidden lg:flex justify-center relative"
          >
            <img
              src={heroMachine}
              alt="Techware Automation Machine"
              className="w-full max-w-2xl object-contain drop-shadow-[0_25px_50px_rgba(59,130,246,0.35)]"
            />

            {/* Floating Tags */}
            <div className="absolute top-10 left-0 bg-white rounded-xl px-4 py-2 shadow-xl">
              <span className="font-semibold text-slate-800">
                PLC Integration
              </span>
            </div>

            <div className="absolute bottom-16 right-0 bg-white rounded-xl px-4 py-2 shadow-xl">
              <span className="font-semibold text-slate-800">
                 Card Testing
              </span>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default HeroSection;

