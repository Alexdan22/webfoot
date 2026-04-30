import { Check, Zap, Smartphone, Target, MessageSquare, Layers } from "lucide-react";

const highlights = [
  { icon: Zap, label: "Fast delivery (7–14 days)" },
  { icon: Target, label: "Conversion-focused design" },
  { icon: Smartphone, label: "Mobile-first approach" },
  { icon: MessageSquare, label: "Direct 1:1 communication" },
  { icon: Layers, label: "Full-stack capability" },
];

export default function WhyChooseMe() {
  return (
    <section
      id="why"
      data-testid="why-section"
      className="relative py-24 lg:py-32 bg-[var(--bg)] overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute -top-32 right-0 w-[480px] h-[480px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(0,245,212,0.16), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute bottom-0 -left-24 w-[420px] h-[420px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(58,134,255,0.18), transparent 70%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-5">
          <div className="font-mono-accent text-[var(--primary)] mb-4">
            / Why Work With Me
          </div>
          <h2 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.02] text-white">
            Direct. Fast.
            <br />
            <span className="text-gradient">Built for results.</span>
          </h2>
          <p className="mt-6 text-[var(--text-secondary)] text-lg max-w-md">
            You talk to me. I build it. If it breaks, I fix it. No agency
            overhead, no account managers — just shipped work.
          </p>
        </div>

        <div className="lg:col-span-7">
          <div className="card-elevated rounded-2xl p-8 lg:p-10">
            <ul className="space-y-5" data-testid="why-highlights">
              {highlights.map((h) => {
                const Icon = h.icon;
                return (
                  <li
                    key={h.label}
                    className="flex items-center gap-5 group"
                  >
                    <span className="w-12 h-12 rounded-xl bg-[var(--primary-soft)] border border-[var(--primary)]/30 grid place-items-center text-[var(--primary)] shrink-0">
                      <Icon size={20} strokeWidth={1.8} />
                    </span>
                    <span className="text-base sm:text-lg text-white font-medium">
                      {h.label}
                    </span>
                    <Check
                      size={18}
                      className="ml-auto text-[var(--primary)] opacity-70"
                      strokeWidth={2.4}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
