import { lazy, Suspense } from "react";
import Navbar from "../components/Navbar.jsx";
import HeroSection from "../components/HeroSection.jsx";
import AboutSection from "../components/AboutSection.jsx";
import ServicesSection from "../components/ServicesSection.jsx";
import MachinesSection from "../components/MachinesSection.jsx";
import LazySection from "../components/LazySection.jsx";

const LiveDemoSection = lazy(() => import("../components/LiveDemoSection.jsx"));
const BenefitsSection = lazy(() => import("../components/BenefitsSection.jsx"));
const IndustriesSection = lazy(() => import("../components/IndustriesSection.jsx"));
const ContactSection = lazy(() => import("../components/ContactSection.jsx"));
const Footer = lazy(() => import("../components/Footer.jsx"));

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <HeroSection />
      <AboutSection />
      <ServicesSection />
      <MachinesSection />

      <LazySection>
        <LiveDemoSection />
      </LazySection>
      <LazySection>
        <BenefitsSection />
      </LazySection>
      <LazySection>
        <IndustriesSection />
      </LazySection>
      <LazySection>
        <ContactSection />
      </LazySection>
      <LazySection>
        <Footer />
      </LazySection>
    </div>
  );
};

export default Index;
