import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Portfolio from "@/components/Portfolio";
import Services from "@/components/Services";
import TechCapabilities from "@/components/TechCapabilities";
import Process from "@/components/Process";
import WhyChooseMe from "@/components/WhyChooseMe";
import CTABanner from "@/components/CTABanner";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import StickyWhatsApp from "@/components/StickyWhatsApp";

export default function Landing() {
  return (
    <main data-testid="landing-page" className="bg-[var(--bg)] text-white">
      <Navbar />
      <Hero />
      <Portfolio />
      <Services />
      <TechCapabilities />
      <Process />
      <WhyChooseMe />
      <CTABanner />
      <Contact />
      <Footer />
      <StickyWhatsApp />
    </main>
  );
}
