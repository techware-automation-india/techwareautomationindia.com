import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";

import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import machines from "../data/machines.js";

const ITEMS_PER_PAGE = 6;

const Machines = () => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(machines.length / ITEMS_PER_PAGE);

  const currentMachines = machines.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [currentPage]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar staticPosition />

      <main className="relative overflow-hidden">
        <div className="absolute inset-0 grid-overlay opacity-30" />

        <section className="section-container relative pb-20 md:pb-28">
          <Link
            to="/#machines"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="max-w-3xl mb-12">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-semibold text-primary uppercase tracking-widest"
            >
              Complete Machine Range
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mt-3 mb-5"
            >
              Automation Machines Built for{" "}
              <span className="gradient-text">Card Production</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-muted-foreground text-lg leading-relaxed"
            >
              Explore Techware Automation India's machines for punching,
              inspection, feeding, validation, and quality control workflows.
            </motion.p>
          </div>

          {/* Product Grid */}
          <div className="grid gap-8">
            {currentMachines.map((machine, index) => (
              <motion.article
                key={`${machine.name}-${index}`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="grid lg:grid-cols-[0.9fr_1.1fr] overflow-hidden rounded-2xl bg-card border border-border card-shadow"
              >
                <div className="h-64 lg:h-full min-h-[300px] overflow-hidden">
                  <img
                    src={machine.image}
                    alt={machine.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="p-6 md:p-8 lg:p-10 flex flex-col justify-center">
                  <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">
                    {machine.name}
                  </h2>

                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {machine.desc}
                  </p>

                  <div className="grid sm:grid-cols-2 gap-3">
                    {machine.features.map((feature) => (
                      <div
                        key={feature}
                        className="flex items-start gap-3 rounded-lg bg-secondary/70 px-4 py-3"
                      >
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm font-medium">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.article>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-12 flex-wrap">
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.max(prev - 1, 1))
                }
                disabled={currentPage === 1}
                className="px-5 py-2 rounded-lg border border-border disabled:opacity-40 hover:bg-primary hover:text-white transition"
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPage(index + 1)}
                  className={`w-10 h-10 rounded-lg font-semibold transition ${
                    currentPage === index + 1
                      ? "bg-primary text-white"
                      : "border border-border hover:bg-primary hover:text-white"
                  }`}
                >
                  {index + 1}
                </button>
              ))}

              <button
                onClick={() =>
                  setCurrentPage((prev) =>
                    Math.min(prev + 1, totalPages)
                  )
                }
                disabled={currentPage === totalPages}
                className="px-5 py-2 rounded-lg border border-border disabled:opacity-40 hover:bg-primary hover:text-white transition"
              >
                Next
              </button>
            </div>
          )}

          <div className="mt-12 flex justify-center">
            <Link
              to="/#machines"
              className="inline-flex items-center gap-2 cta-gradient text-white font-semibold px-7 py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Machines;