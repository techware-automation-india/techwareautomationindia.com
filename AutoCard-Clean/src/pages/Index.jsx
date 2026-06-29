import Navbar from "../components/Navbar.jsx";
import HeroSection from "../components/HeroSection.jsx";
import AboutSection from "../components/AboutSection.jsx";
import ServicesSection from "../components/ServicesSection.jsx";
import MachinesSection from "../components/MachinesSection.jsx";
import LiveDemoSection from "../components/LiveDemoSection.jsx";
import BenefitsSection from "../components/BenefitsSection.jsx";
import IndustriesSection from "../components/IndustriesSection.jsx";
import ContactSection from "../components/ContactSection.jsx";
import Footer from "../components/Footer.jsx";


const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <HeroSection />
      <AboutSection />
      <ServicesSection />
      <MachinesSection />
      
      <LiveDemoSection />
      <BenefitsSection />
      <IndustriesSection />
      <ContactSection />
      <Footer />
    </div>
  );
};

export default Index;
