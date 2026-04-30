import { ArrowRight, MessageCircle, Sparkles, Star } from "lucide-react";
import { whatsappLink } from "@/config/site";

export default function Hero() {
  return (
    <section
      id="top"
      data-testid="hero-section"
      className="relative min-h-[100vh] pt-32 pb-24 overflow-hidden bg-hero"
    >
      {/* Floating accent shapes */}
      <div
        aria-hidden
        className="absolute top-32 -left-24 w-[420px] h-[420px] rounded-full float-slow"
        style={{
          background:
            "radial-gradient(closest-side, rgba(0,245,212,0.20), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute bottom-0 -right-32 w-[520px] h-[520px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(58,134,255,0.18), transparent 70%)",
        }}
      />
      <div aria-hidden className="absolute inset-0 dot-grid-dark opacity-40" />

      <div className="relative max-w-5xl mx-auto px-6 lg:px-10 text-center fade-up">
        {/* Trust line */}
        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 mb-8">
          <div className="flex -space-x-1">
            {[0, 1, 2, 3].map((i) => (
              <Star
                key={i}
                size={12}
                className="fill-[var(--primary)] text-[var(--primary)]"
              />
            ))}
            <Star size={12} className="fill-[var(--primary)] text-[var(--primary)]" />
          </div>
          <span className="font-mono-accent text-white">
            Trusted by local businesses
          </span>
        </div>

        <h1 className="font-display font-extrabold tracking-tight text-white leading-[0.96] text-[clamp(2.75rem,7vw,6rem)]">
          Websites That Bring You
          <br />
          <span className="relative inline-block">
            <span className="text-gradient">Customers</span>
          </span>{" "}
          —<br className="md:hidden" /> Not Just Traffic.
        </h1>

        <p className="mt-8 text-base sm:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
          We build conversion-focused websites for local businesses — designed
          to generate leads, fill calendars, and grow revenue. Not just look
          pretty.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#contact"
            data-testid="hero-design-btn"
            className="btn-primary inline-flex items-center gap-2.5 px-7 py-4 text-sm font-semibold rounded-full"
          >
            <Sparkles size={18} />
            Request Your Custom Website Mockup
          </a>
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noreferrer"
            data-testid="hero-whatsapp-btn"
            className="btn-outline inline-flex items-center gap-2 px-7 py-4 text-sm font-semibold rounded-full"
          >
            <MessageCircle size={16} />
            Chat on WhatsApp
          </a>
        </div>

        {/* Trust strip */}
        <div className="mt-16 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
          {[
            { k: "7–14 days", v: "Avg. delivery" },
            { k: "100%", v: "Mobile-first" },
            { k: "Direct", v: "1:1 support" },
          ].map((s) => (
            <div
              key={s.v}
              className="text-center md:text-left md:pl-6 md:border-l md:border-white/10"
            >
              <div className="font-display font-extrabold text-2xl text-white">
                {s.k}
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-1 font-mono-accent">
                {s.v}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex items-center justify-center gap-3 text-sm text-[var(--text-muted)]">
          <span className="w-10 h-px bg-white/15" />
          <span className="font-mono-accent">
            Full-stack developer · Built for performance & results
          </span>
          <span className="w-10 h-px bg-white/15" />
        </div>
      </div>
    </section>
  );
}
