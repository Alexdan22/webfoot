import { Search, Hammer, Rocket } from "lucide-react";

const steps = [
  {
    no: "1",
    icon: Search,
    title: "Understand Business",
    body:
      "A free strategy call to learn your business, customers, and what success actually looks like for you.",
  },
  {
    no: "2",
    icon: Hammer,
    title: "Build & Optimize",
    body:
      "I design and develop a fast, mobile-first site — wired with the right CTAs, forms, and integrations.",
  },
  {
    no: "3",
    icon: Rocket,
    title: "Launch & Generate Leads",
    body:
      "Go live with confidence. I monitor, iterate, and tune so the site keeps bringing customers.",
  },
];

export default function Process() {
  return (
    <section
      id="process"
      data-testid="process-section"
      className="relative py-24 lg:py-32 bg-section-alt"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="max-w-3xl mb-20">
          <div className="font-mono-accent text-[var(--primary)] mb-4">
            / Process
          </div>
          <h2 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.02] text-white">
            Three steps.
            <br />
            <span className="text-[var(--text-muted)]">From idea to leads.</span>
          </h2>
        </div>

        <div className="relative">
          <div
            aria-hidden
            className="hidden md:block absolute top-12 left-[14%] right-[14%] border-t-2 border-dashed border-white/15"
          />

          <div className="grid md:grid-cols-3 gap-10 md:gap-6 relative">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.no}
                  data-testid={`process-step-${i}`}
                  className="relative flex flex-col items-start md:items-center md:text-center"
                >
                  <div className="relative z-10 mb-6">
                    <div className="w-24 h-24 rounded-full grid place-items-center bg-[var(--surface-1)] border border-white/10 shadow-lg">
                      <div
                        className="w-16 h-16 rounded-full grid place-items-center text-[var(--bg)]"
                        style={{ background: "var(--gradient-primary)" }}
                      >
                        <Icon size={24} strokeWidth={2} />
                      </div>
                    </div>
                    <span className="absolute -top-2 -right-2 w-9 h-9 rounded-full bg-[var(--bg)] border border-white/15 grid place-items-center font-display font-extrabold text-white">
                      {s.no}
                    </span>
                  </div>

                  <div className="card-surface rounded-2xl p-7 md:max-w-xs w-full">
                    <h3 className="font-display font-extrabold text-2xl mb-3 text-white">
                      {s.title}
                    </h3>
                    <p className="text-[var(--text-secondary)] text-sm">
                      {s.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
