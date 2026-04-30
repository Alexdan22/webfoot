import { MessageCircle, Sparkles } from "lucide-react";
import { whatsappLink } from "@/config/site";

export default function CTABanner() {
  return (
    <section
      data-testid="cta-banner-section"
      className="relative py-20 lg:py-24 bg-section-alt"
    >
      <div className="relative max-w-6xl mx-auto px-6 lg:px-10">
        <div
          className="relative overflow-hidden rounded-3xl px-8 sm:px-12 py-16 lg:py-20 text-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,245,212,0.18) 0%, rgba(58,134,255,0.18) 100%), #0E1422",
            boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6)",
          }}
        >
          <div
            aria-hidden
            className="absolute -top-20 -left-20 w-72 h-72 rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(0,245,212,0.35), transparent 70%)",
            }}
          />
          <div
            aria-hidden
            className="absolute -bottom-24 -right-12 w-80 h-80 rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(58,134,255,0.35), transparent 70%)",
            }}
          />

          <div className="relative">
            <div className="font-mono-accent text-[var(--primary)] mb-6">
              / ready when you are
            </div>
            <h2 className="font-display font-extrabold tracking-tight text-white text-4xl sm:text-5xl lg:text-6xl leading-[1.02]">
              Your Website Should Work.
              <br />
              <span className="text-gradient">Not Just Exist.</span>
            </h2>
            <p className="mt-6 text-white/75 max-w-xl mx-auto">
              One message. Quick reply. Free homepage design — no commitment,
              no pitch decks.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <a
                href="#contact"
                data-testid="cta-banner-design-btn"
                className="btn-primary inline-flex items-center gap-3 px-8 py-4 text-base font-semibold rounded-full"
              >
                <Sparkles size={20} />
                Book a Free Strategy Call
              </a>
              <a
                href={whatsappLink()}
                target="_blank"
                rel="noreferrer"
                data-testid="cta-banner-whatsapp-btn"
                className="btn-whatsapp inline-flex items-center gap-3 px-8 py-4 text-base font-semibold rounded-full"
              >
                <MessageCircle size={20} />
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
