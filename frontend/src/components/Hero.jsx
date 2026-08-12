import { lazy, Suspense } from "react";
import { ArrowRight, MessageCircle, Sparkles, Star } from "lucide-react";
import { whatsappLink } from "@/config/site";
import "@/components/hero/hero.css";

const strandHeroEnabled = process.env.REACT_APP_WEBFOOT_STRAND_HERO !== "0";
const HeroStrandVisual = strandHeroEnabled
  ? lazy(() => import("@/components/hero/HeroStrandVisual"))
  : null;
const HeroParticleVisual = strandHeroEnabled
  ? null
  : lazy(() => import("@/components/hero/HeroParticleVisual"));

const trustMetrics = [
  { k: "7–14 days", v: "Avg. delivery" },
  { k: "100%", v: "Mobile-first" },
  { k: "Direct", v: "1:1 support" },
];

export default function Hero() {
  return (
    <section
      id="top"
      data-testid="hero-section"
      className="webfoot-hero"
    >
      <div aria-hidden="true" className="webfoot-hero-grid" />
      <div aria-hidden="true" className="webfoot-hero-aura webfoot-hero-aura-cyan" />
      <div aria-hidden="true" className="webfoot-hero-aura webfoot-hero-aura-violet" />

      <div className={`webfoot-hero-shell${HeroStrandVisual ? " webfoot-hero-shell--strands" : ""}`}>
        <div className="webfoot-hero-copy fade-up">
          <div className="webfoot-hero-trust">
            <div className="flex -space-x-1" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((index) => (
                <Star
                  key={index}
                  size={11}
                  className="fill-[var(--primary)] text-[var(--primary)]"
                />
              ))}
            </div>
            <span className="font-mono-accent">Trusted by local businesses</span>
          </div>

          <p className="webfoot-hero-eyebrow font-mono-accent">
            / Digital presence, built to move
          </p>

          <h1 className="webfoot-hero-title font-display">
            Websites That Bring You
            <span className="webfoot-hero-title-accent">Customers</span>
            <span className="webfoot-hero-title-end">— Not Just Traffic.</span>
          </h1>

          <p className="webfoot-hero-description">
            We build conversion-focused websites for local businesses — designed
            to generate leads, fill calendars, and grow revenue. Not just look
            pretty.
          </p>

          <div className="webfoot-hero-actions">
            <a
              href="#contact"
              data-testid="hero-design-btn"
              className="btn-primary webfoot-hero-primary-cta"
            >
              <Sparkles size={17} />
              Get Free Homepage Design
              <ArrowRight size={17} className="webfoot-hero-cta-arrow" />
            </a>
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noreferrer"
              data-testid="hero-whatsapp-btn"
              className="btn-outline webfoot-hero-secondary-cta"
            >
              <MessageCircle size={16} />
              Chat on WhatsApp
            </a>
          </div>

          <div className="webfoot-hero-metrics" aria-label="Webfoot service highlights">
            {trustMetrics.map((metric) => (
              <div key={metric.v}>
                <strong className="font-display">{metric.k}</strong>
                <span className="font-mono-accent">{metric.v}</span>
              </div>
            ))}
          </div>

          <div className="webfoot-hero-signoff">
            <span aria-hidden="true" />
            <p className="font-mono-accent">
              Full-stack developer · Built for performance &amp; results
            </p>
          </div>
        </div>

        <div className="webfoot-hero-visual">
          {HeroStrandVisual ? (
            <Suspense fallback={null}>
              <HeroStrandVisual />
            </Suspense>
          ) : HeroParticleVisual ? (
            <Suspense fallback={null}>
              <HeroParticleVisual />
            </Suspense>
          ) : (
            null
          )}
        </div>
      </div>
    </section>
  );
}
